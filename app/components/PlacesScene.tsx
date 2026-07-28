import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferAttribute,
  type Group,
  type Material,
  type Object3D,
  type Object3DEventMap,
  type ShaderMaterial,
  type Vector3Tuple,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  placeCountries,
  type Place,
  type PlaceLandmark,
} from "../data/places";

export type ExploreInput = {
  forward: number;
  strafe: number;
  sprint: boolean;
  jumpSequence: number;
};

export type TraversalMode = "kayak" | "land";

type PlacesSceneProps = {
  exploreMode: boolean;
  exploreInputRef: MutableRefObject<ExploreInput>;
  reduceMotion: boolean;
  selectedPlaceId: string;
  onSelect: (placeId: string) => void;
  onNearbyChange: (placeId: string | null) => void;
  onTraversalChange: (mode: TraversalMode) => void;
};

type CountryRegion = {
  id: string;
  center: Vector3;
  angularRadius: number;
  grass: Color;
  accent: Color;
  vegetation: GalaxyAssetName;
  plantCount: number;
};

type PlaceNode = {
  place: Place;
  direction: Vector3;
  orientation: Quaternion;
  position: Vector3;
  rotation: number;
};

type VegetationNode = {
  id: string;
  asset: GalaxyAssetName;
  direction: Vector3;
  position: Vector3;
  orientation: Quaternion;
  rotation: number;
  scale: number;
};

type BirdDefinition = {
  id: string;
  startDirection: Vector3;
  orbitAxis: Vector3;
  altitude: number;
  speed: number;
  phase: number;
  scale: number;
  color: string;
};

type PlayerApi = {
  direction: Vector3;
  heading: Vector3;
  position: Vector3;
  mode: TraversalMode;
};

type GalaxyAssetName =
  | "avatar_torso"
  | "avatar_head"
  | "avatar_arm"
  | "avatar_leg"
  | "avatar_shoe"
  | "avatar_backpack"
  | "kayak"
  | "paddle"
  | "tree_deciduous"
  | "tree_cherry"
  | "tree_pine"
  | "tree_palm"
  | "bush"
  | "rock"
  | "landmark_skyline"
  | "landmark_lighthouse"
  | "landmark_sailboat"
  | "landmark_barbecue"
  | "landmark_orange"
  | "landmark_palm"
  | "landmark_mosque"
  | "landmark_mountain"
  | "landmark_tower"
  | "landmark_torii"
  | "landmark_sushi";

const ASSET_LIBRARY_URL = "/places/models/places-world.glb";
const WORLD_RADIUS = 4;
const CORE_RADIUS = 3.6;
const UP = new Vector3(0, 1, 0);
const SUN_DIRECTION = new Vector3(0.58, 0.74, 0.35).normalize();
const LAND_CLEARANCE = 0.005;
const KAYAK_CLEARANCE = 0.085;
const WATER_ENTRY_MARGIN = 0.025;

const WATER_WAVES = [
  {
    direction: new Vector3(0.82, 0.18, 0.54).normalize(),
    amplitude: 0.055,
    frequency: 7,
    speed: 0.55,
  },
  {
    direction: new Vector3(-0.38, 0.72, 0.58).normalize(),
    amplitude: 0.032,
    frequency: 11,
    speed: -0.42,
  },
  {
    direction: new Vector3(0.12, -0.64, 0.76).normalize(),
    amplitude: 0.02,
    frequency: 17,
    speed: 0.76,
  },
  {
    direction: new Vector3(-0.68, -0.22, 0.7).normalize(),
    amplitude: 0.012,
    frequency: 23,
    speed: -0.61,
  },
] as const;

const LANDMARK_ASSETS: Record<PlaceLandmark, GalaxyAssetName> = {
  barbecue: "landmark_barbecue",
  lighthouse: "landmark_lighthouse",
  mosque: "landmark_mosque",
  mountain: "landmark_mountain",
  orange: "landmark_orange",
  palm: "landmark_palm",
  sailboat: "landmark_sailboat",
  skyline: "landmark_skyline",
  sushi: "landmark_sushi",
  torii: "landmark_torii",
  tower: "landmark_tower",
};

function directionFromAngles(longitude: number, latitude: number) {
  const longitudeRadians = MathUtils.degToRad(longitude);
  const latitudeRadians = MathUtils.degToRad(latitude);
  const latitudeRadius = Math.cos(latitudeRadians);

  return new Vector3(
    Math.sin(longitudeRadians) * latitudeRadius,
    Math.sin(latitudeRadians),
    Math.cos(longitudeRadians) * latitudeRadius,
  ).normalize();
}

const COUNTRY_REGIONS: CountryRegion[] = [
  {
    id: "united-states",
    center: directionFromAngles(-52, 16),
    angularRadius: 0.54,
    grass: new Color("#56aa68"),
    accent: new Color("#80ce72"),
    vegetation: "tree_deciduous",
    plantCount: 12,
  },
  {
    id: "dominican-republic",
    center: directionFromAngles(-26, -15),
    angularRadius: 0.31,
    grass: new Color("#62ba69"),
    accent: new Color("#a0d875"),
    vegetation: "tree_palm",
    plantCount: 7,
  },
  {
    id: "turkiye",
    center: directionFromAngles(0, 23),
    angularRadius: 0.49,
    grass: new Color("#72aa63"),
    accent: new Color("#accb75"),
    vegetation: "tree_pine",
    plantCount: 10,
  },
  {
    id: "south-korea",
    center: directionFromAngles(28, -12),
    angularRadius: 0.35,
    grass: new Color("#4fa367"),
    accent: new Color("#78c676"),
    vegetation: "tree_pine",
    plantCount: 7,
  },
  {
    id: "japan",
    center: directionFromAngles(53, 20),
    angularRadius: 0.38,
    grass: new Color("#5bac6a"),
    accent: new Color("#91ce78"),
    vegetation: "tree_cherry",
    plantCount: 9,
  },
];

const REGION_BY_ID = new Map(
  COUNTRY_REGIONS.map((region) => [region.id, region]),
);

const PLACE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-0.32, 0.2],
  [0.32, 0.18],
  [-0.28, -0.25],
  [0.27, -0.27],
  [0, 0.34],
];

function tangentBasis(direction: Vector3) {
  const east = new Vector3().crossVectors(UP, direction);
  if (east.lengthSq() < 0.0001) {
    east.set(1, 0, 0);
  } else {
    east.normalize();
  }
  const north = new Vector3().crossVectors(direction, east).normalize();
  return { east, north };
}

function directionFromOffset(
  center: Vector3,
  eastOffset: number,
  northOffset: number,
) {
  const { east, north } = tangentBasis(center);
  return center
    .clone()
    .addScaledVector(east, eastOffset)
    .addScaledVector(north, northOffset)
    .normalize();
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = MathUtils.clamp(
    (value - edge0) / (edge1 - edge0),
    0,
    1,
  );
  return normalized * normalized * (3 - 2 * normalized);
}

function angularDistance(a: Vector3, b: Vector3) {
  return Math.acos(MathUtils.clamp(a.dot(b), -1, 1));
}

function regionInfluence(direction: Vector3, region: CountryRegion) {
  const distance = angularDistance(direction, region.center);
  const { east, north } = tangentBasis(region.center);
  const edgeAngle = Math.atan2(
    direction.dot(north),
    direction.dot(east),
  );
  const regionSeed = region.id.length * 0.73;
  const irregularRadius =
    region.angularRadius *
    (0.92 +
      Math.sin(edgeAngle * 3 + regionSeed) * 0.055 +
      Math.sin(edgeAngle * 7 - regionSeed * 1.7) * 0.035);
  return 1 - smoothstep(
    irregularRadius * 0.12,
    irregularRadius,
    distance,
  );
}

function terrainSample(direction: Vector3) {
  let strongestRegion: CountryRegion | null = null;
  let strongestInfluence = 0;

  for (const region of COUNTRY_REGIONS) {
    const influence = regionInfluence(direction, region);
    if (influence > strongestInfluence) {
      strongestInfluence = influence;
      strongestRegion = region;
    }
  }

  const broadNoise =
    Math.sin(direction.x * 19 + direction.y * 11) *
      Math.sin(direction.z * 17 - direction.x * 7) *
      0.024 +
    Math.sin(direction.x * 41 + direction.y * 29 + direction.z * 37) *
      0.011;
  const radius =
    CORE_RADIUS +
    strongestInfluence * 0.76 +
    broadNoise * strongestInfluence * strongestInfluence;

  return {
    radius,
    influence: strongestInfluence,
    region: strongestRegion,
    noise: broadNoise,
  };
}

function terrainRadiusAt(direction: Vector3) {
  return terrainSample(direction).radius;
}

function sampleWaterHeight(direction: Vector3, time: number) {
  let height = 0;
  for (const wave of WATER_WAVES) {
    height +=
      Math.sin(
        direction.dot(wave.direction) * wave.frequency +
          time * wave.speed,
      ) * wave.amplitude;
  }
  return height;
}

function createPlaceNodes(): PlaceNode[] {
  return placeCountries.flatMap((country) => {
    const region = REGION_BY_ID.get(country.id);
    if (!region) {
      return [];
    }

    return country.places.map((place, index) => {
      const [horizontal, vertical] =
        PLACE_OFFSETS[index % PLACE_OFFSETS.length];
      const direction = directionFromOffset(
        region.center,
        horizontal * region.angularRadius * 1.42,
        vertical * region.angularRadius * 1.42,
      );

      return {
        place,
        direction,
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        position: direction
          .clone()
          .multiplyScalar(terrainRadiusAt(direction) + 0.012),
        rotation: (index * 2.399963 + country.id.length) % Math.PI,
      };
    });
  });
}

const PLACE_NODES = createPlaceNodes();

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function createVegetationNodes() {
  const nodes: VegetationNode[] = [];

  COUNTRY_REGIONS.forEach((region, regionIndex) => {
    const random = createSeededRandom(12_731 + regionIndex * 9_973);
    const total = region.plantCount + Math.round(region.plantCount * 0.42);

    for (let index = 0; index < total; index += 1) {
      let direction = region.center.clone();

      for (let attempt = 0; attempt < 28; attempt += 1) {
        const angle = random() * Math.PI * 2;
        const radius =
          Math.sqrt(random()) * region.angularRadius * 0.63;
        const candidate = directionFromOffset(
          region.center,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
        const clearOfLandmarks = PLACE_NODES.every(
          (place) =>
            place.place.countryId !== region.id ||
            angularDistance(candidate, place.direction) > 0.115,
        );

        if (
          clearOfLandmarks &&
          terrainRadiusAt(candidate) > WORLD_RADIUS + 0.055
        ) {
          direction = candidate;
          break;
        }
      }

      const isBush = index >= region.plantCount;
      nodes.push({
        id: `${region.id}-plant-${index}`,
        asset: isBush ? "bush" : region.vegetation,
        direction,
        position: direction
          .clone()
          .multiplyScalar(terrainRadiusAt(direction) + 0.005),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        rotation: random() * Math.PI * 2,
        scale: isBush
          ? 0.38 + random() * 0.25
          : 0.46 + random() * 0.28,
      });
    }

    const rockRandom = createSeededRandom(84_731 + regionIndex * 5_917);
    for (let index = 0; index < 5; index += 1) {
      const angle = rockRandom() * Math.PI * 2;
      const radius =
        Math.sqrt(rockRandom()) * region.angularRadius * 0.58;
      const direction = directionFromOffset(
        region.center,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
      nodes.push({
        id: `${region.id}-rock-${index}`,
        asset: "rock",
        direction,
        position: direction
          .clone()
          .multiplyScalar(terrainRadiusAt(direction) + 0.005),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        rotation: rockRandom() * Math.PI * 2,
        scale: 0.48 + rockRandom() * 0.42,
      });
    }
  });

  return nodes;
}

const VEGETATION_NODES = createVegetationNodes();

function createBirdDefinitions() {
  const random = createSeededRandom(440_221);
  const colors = ["#fff5dc", "#dbe8e8", "#f5c47e", "#586b72"];

  return Array.from({ length: 19 }, (_, index): BirdDefinition => {
    const longitude = random() * Math.PI * 2;
    const vertical = random() * 1.4 - 0.7;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const startDirection = new Vector3(
      Math.cos(longitude) * horizontal,
      vertical,
      Math.sin(longitude) * horizontal,
    ).normalize();
    const randomAxis = new Vector3(
      random() * 2 - 1,
      random() * 2 - 1,
      random() * 2 - 1,
    ).normalize();
    const orbitAxis = new Vector3()
      .crossVectors(startDirection, randomAxis)
      .normalize();

    if (orbitAxis.lengthSq() < 0.001) {
      orbitAxis.set(0, 1, 0);
    }

    return {
      id: `bird-${index}`,
      startDirection,
      orbitAxis,
      altitude: 1.25 + random() * 1.65,
      speed: 0.035 + random() * 0.055,
      phase: random() * Math.PI * 2,
      scale: 0.72 + random() * 0.72,
      color: colors[index % colors.length],
    };
  });
}

const BIRD_DEFINITIONS = createBirdDefinitions();

function createTerrainGeometry() {
  const geometry = new SphereGeometry(1, 176, 112);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const sand = new Color("#e9d494");
  const underwater = new Color("#315f59");
  const workingDirection = new Vector3();
  const workingColor = new Color();

  for (let index = 0; index < positions.count; index += 1) {
    workingDirection
      .fromBufferAttribute(positions, index)
      .normalize();
    const sample = terrainSample(workingDirection);
    positions.setXYZ(
      index,
      workingDirection.x * sample.radius,
      workingDirection.y * sample.radius,
      workingDirection.z * sample.radius,
    );

    if (sample.radius < WORLD_RADIUS - 0.04 || !sample.region) {
      workingColor.copy(underwater);
    } else if (sample.radius < WORLD_RADIUS + 0.11) {
      workingColor.copy(sand);
    } else {
      const colorMix = MathUtils.clamp(
        0.46 + sample.noise * 8 + workingDirection.y * 0.12,
        0.15,
        0.82,
      );
      workingColor
        .copy(sample.region.grass)
        .lerp(sample.region.accent, colorMix);
    }

    colors[index * 3] = workingColor.r;
    colors[index * 3 + 1] = workingColor.g;
    colors[index * 3 + 2] = workingColor.b;
  }

  positions.needsUpdate = true;
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createWaterGeometry() {
  const geometry = new SphereGeometry(WORLD_RADIUS, 192, 128);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const shore = new Float32Array(positions.count);
  const direction = new Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const difference = Math.abs(terrainRadiusAt(direction) - WORLD_RADIUS);
    shore[index] =
      1 - smoothstep(0.018, 0.115, difference);
  }

  geometry.setAttribute("shore", new Float32BufferAttribute(shore, 1));
  return geometry;
}

function configureClone(
  object: Object3D<Object3DEventMap>,
  assetName: GalaxyAssetName,
) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = assetName !== "kayak" && assetName !== "paddle";
    child.frustumCulled = false;
    const tuneMaterial = (material: Material) => {
      if (!(material instanceof MeshStandardMaterial)) {
        return material;
      }
      const tuned = material.clone();
      tuned.metalness = Math.min(tuned.metalness, 0.22);
      tuned.roughness = Math.max(tuned.roughness, 0.58);
      tuned.envMapIntensity = 0.35;
      return tuned;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(tuneMaterial)
      : tuneMaterial(child.material);
  });
}

function GalaxyAsset({
  library,
  name,
  position,
  rotation,
  scale = 1,
}: {
  library: Group;
  name: GalaxyAssetName;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number | Vector3Tuple;
}) {
  const object = useMemo(() => {
    const source = library.getObjectByName(name);
    if (!source) {
      console.error(`Missing Places asset: ${name}`);
      return null;
    }
    const clone = source.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.quaternion.identity();
    clone.scale.set(1, 1, 1);
    configureClone(clone, name);
    return clone;
  }, [library, name]);

  if (!object) {
    return null;
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={object} dispose={null} />
    </group>
  );
}

function SkyDome() {
  return (
    <mesh scale={38} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vDirection;
          void main() {
            float horizon = smoothstep(-0.25, 0.82, vDirection.y);
            vec3 horizonColor = vec3(0.59, 0.79, 0.87);
            vec3 zenithColor = vec3(0.18, 0.49, 0.73);
            vec3 color = mix(horizonColor, zenithColor, horizon);
            float sunGlow = pow(max(dot(
              normalize(vDirection),
              normalize(vec3(0.58, 0.74, 0.35))
            ), 0.0), 32.0);
            color += vec3(1.0, 0.76, 0.42) * sunGlow * 0.22;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Terrain() {
  const geometry = useMemo(createTerrainGeometry, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0}
      />
    </mesh>
  );
}

function WaterVolume({ reduceMotion }: { reduceMotion: boolean }) {
  const surfaceRef = useRef<ShaderMaterial>(null);
  const geometry = useMemo(createWaterGeometry, []);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      motion: { value: reduceMotion ? 0 : 1 },
      sunDirection: { value: SUN_DIRECTION.clone() },
    }),
    [reduceMotion],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!surfaceRef.current) {
      return;
    }
    surfaceRef.current.uniforms.time.value = clock.elapsedTime;
    surfaceRef.current.uniforms.motion.value = reduceMotion ? 0 : 1;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[CORE_RADIUS - 0.025, 96, 64]} />
        <meshStandardMaterial
          color="#073b49"
          roughness={1}
          metalness={0}
        />
      </mesh>
      <mesh geometry={geometry} receiveShadow>
        <shaderMaterial
          ref={surfaceRef}
          uniforms={uniforms}
          side={DoubleSide}
          depthWrite
          transparent={false}
          vertexShader={`
            uniform float time;
            uniform float motion;
            attribute float shore;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec3 vDirection;
            varying float vShore;
            varying float vCrest;

            void addWave(
              vec3 direction,
              vec3 waveDirection,
              float amplitude,
              float frequency,
              float speed,
              inout float height,
              inout vec3 gradient
            ) {
              vec3 normalizedWave = normalize(waveDirection);
              float phase =
                dot(direction, normalizedWave) * frequency +
                time * speed;
              height += sin(phase) * amplitude;
              gradient +=
                normalizedWave *
                cos(phase) *
                amplitude *
                frequency;
            }

            void main() {
              vec3 direction = normalize(position);
              float height = 0.0;
              vec3 gradient = vec3(0.0);
              addWave(
                direction,
                vec3(0.82, 0.18, 0.54),
                0.055,
                7.0,
                0.55,
                height,
                gradient
              );
              addWave(
                direction,
                vec3(-0.38, 0.72, 0.58),
                0.032,
                11.0,
                -0.42,
                height,
                gradient
              );
              addWave(
                direction,
                vec3(0.12, -0.64, 0.76),
                0.02,
                17.0,
                0.76,
                height,
                gradient
              );
              addWave(
                direction,
                vec3(-0.68, -0.22, 0.7),
                0.012,
                23.0,
                -0.61,
                height,
                gradient
              );

              height *= motion;
              vec3 tangentGradient =
                gradient - direction * dot(direction, gradient);
              vec3 localNormal = normalize(
                direction - tangentGradient * motion * 0.43
              );
              vec3 displaced = direction * (${WORLD_RADIUS.toFixed(1)} + height);
              vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);

              vWorldPosition = worldPosition.xyz;
              vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
              vDirection = direction;
              vShore = shore;
              vCrest = smoothstep(0.035, 0.072, height);
              gl_Position =
                projectionMatrix *
                viewMatrix *
                worldPosition;
            }
          `}
          fragmentShader={`
            uniform float time;
            uniform vec3 sunDirection;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec3 vDirection;
            varying float vShore;
            varying float vCrest;

            void main() {
              vec3 normal = normalize(vWorldNormal);
              vec3 viewDirection = normalize(
                cameraPosition - vWorldPosition
              );
              vec3 lightDirection = normalize(sunDirection);
              vec3 halfDirection = normalize(
                lightDirection + viewDirection
              );
              float fresnel = pow(
                1.0 - max(dot(normal, viewDirection), 0.0),
                3.2
              );
              float diffuse = 0.64 + max(
                dot(normal, lightDirection),
                0.0
              ) * 0.36;
              float specular = pow(
                max(dot(normal, halfDirection), 0.0),
                84.0
              );
              float latitudeLight =
                smoothstep(-0.75, 0.85, vDirection.y);
              vec3 deep = vec3(0.045, 0.33, 0.41);
              vec3 shallow = vec3(0.09, 0.57, 0.65);
              vec3 skyReflection = vec3(0.46, 0.73, 0.83);
              vec3 water = mix(
                deep,
                shallow,
                0.34 + latitudeLight * 0.18
              );
              water = mix(water, skyReflection, fresnel * 0.46);
              water *= diffuse;
              water += vec3(1.0, 0.82, 0.56) * specular * 0.025;
              water = mix(
                water,
                vec3(0.2, 0.62, 0.69),
                vCrest * 0.18
              );

              float shorePulse =
                0.64 +
                sin(
                  time * 1.7 +
                  vDirection.x * 31.0 +
                  vDirection.z * 27.0
                ) * 0.18;
              float foam = max(
                vShore * shorePulse,
                vCrest * 0.55
              );
              foam = smoothstep(0.46, 0.86, foam);
              water = mix(
                water,
                vec3(0.88, 0.97, 0.94),
                foam * 0.82
              );

              gl_FragColor = vec4(water, 1.0);
            }
          `}
        />
      </mesh>
    </group>
  );
}

function Vegetation({ library }: { library: Group }) {
  return (
    <group>
      {VEGETATION_NODES.map((node) => (
        <group
          key={node.id}
          position={node.position}
          quaternion={node.orientation}
        >
          <group rotation={[0, node.rotation, 0]} scale={node.scale}>
            <GalaxyAsset library={library} name={node.asset} />
          </group>
        </group>
      ))}
    </group>
  );
}

function Destination({
  library,
  node,
  selected,
  onSelect,
}: {
  library: Group;
  node: PlaceNode;
  selected: boolean;
  onSelect: (placeId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const scale =
    node.place.landmark === "mountain"
      ? 0.62
      : node.place.landmark === "skyline"
        ? 0.58
        : 0.64;

  return (
    <group
      position={node.position}
      quaternion={node.orientation}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(node.place.id);
      }}
    >
      <group
        rotation={[0, node.rotation, 0]}
        scale={scale * (hovered || selected ? 1.07 : 1)}
      >
        <mesh position={[0, 0.012, 0]} receiveShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.024, 24]} />
          <meshStandardMaterial
            color={selected ? "#ffe38d" : "#ead7a2"}
            roughness={0.9}
          />
        </mesh>
        <GalaxyAsset
          library={library}
          name={LANDMARK_ASSETS[node.place.landmark]}
        />
      </group>
    </group>
  );
}

function Destinations({
  library,
  selectedPlaceId,
  onSelect,
}: {
  library: Group;
  selectedPlaceId: string;
  onSelect: (placeId: string) => void;
}) {
  return (
    <group>
      {PLACE_NODES.map((node) => (
        <Destination
          key={node.place.id}
          library={library}
          node={node}
          selected={selectedPlaceId === node.place.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function Bird({
  definition,
  reduceMotion,
}: {
  definition: BirdDefinition;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Mesh>(null);
  const rightWingRef = useRef<Mesh>(null);
  const directionRef = useRef(new Vector3());
  const tangentRef = useRef(new Vector3());
  const positionRef = useRef(new Vector3());

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const elapsed = reduceMotion ? 0 : clock.elapsedTime;
    const direction = directionRef.current
      .copy(definition.startDirection)
      .applyAxisAngle(
        definition.orbitAxis,
        elapsed * definition.speed + definition.phase,
      )
      .normalize();
    const tangent = tangentRef.current
      .crossVectors(definition.orbitAxis, direction)
      .normalize();
    const position = positionRef.current
      .copy(direction)
      .multiplyScalar(WORLD_RADIUS + definition.altitude);

    group.position.copy(position);
    group.up.copy(direction);
    group.lookAt(position.clone().add(tangent));

    const flap = reduceMotion
      ? 0.2
      : Math.sin(elapsed * (7.2 + definition.speed * 30) + definition.phase);
    if (leftWingRef.current) {
      leftWingRef.current.rotation.z = -0.18 - flap * 0.42;
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.z = 0.18 + flap * 0.42;
    }
  });

  return (
    <group ref={groupRef} scale={definition.scale}>
      <mesh scale={[0.62, 0.48, 1.28]} castShadow>
        <sphereGeometry args={[0.065, 10, 6]} />
        <meshStandardMaterial
          color={definition.color}
          roughness={0.86}
        />
      </mesh>
      <mesh
        ref={leftWingRef}
        position={[-0.08, 0, 0]}
        rotation={[0, 0, -0.3]}
        scale={[0.13, 0.018, 0.055]}
        castShadow
      >
        <sphereGeometry args={[1, 8, 5]} />
        <meshStandardMaterial
          color={definition.color}
          roughness={0.86}
        />
      </mesh>
      <mesh
        ref={rightWingRef}
        position={[0.08, 0, 0]}
        rotation={[0, 0, 0.3]}
        scale={[0.13, 0.018, 0.055]}
        castShadow
      >
        <sphereGeometry args={[1, 8, 5]} />
        <meshStandardMaterial
          color={definition.color}
          roughness={0.86}
        />
      </mesh>
    </group>
  );
}

function Birds({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <group>
      {BIRD_DEFINITIONS.map((definition) => (
        <Bird
          key={definition.id}
          definition={definition}
          reduceMotion={reduceMotion}
        />
      ))}
    </group>
  );
}

function AvatarModel({
  library,
  mode,
  moving,
  elapsed,
  reduceMotion,
}: {
  library: Group;
  mode: TraversalMode;
  moving: number;
  elapsed: number;
  reduceMotion: boolean;
}) {
  const landCycle = reduceMotion ? 0 : Math.sin(elapsed * 8) * moving;
  const paddleCycle = reduceMotion ? 0 : Math.sin(elapsed * 4.2) * moving;

  if (mode === "kayak") {
    return (
      <group>
        <GalaxyAsset library={library} name="kayak" scale={1.18} />
        <group position={[0, 0.125, -0.015]}>
          <GalaxyAsset library={library} name="avatar_torso" />
          <GalaxyAsset
            library={library}
            name="avatar_head"
            position={[0, 0.46, 0]}
          />
          <GalaxyAsset
            library={library}
            name="avatar_backpack"
            position={[0, 0.24, -0.095]}
          />
          <GalaxyAsset
            library={library}
            name="avatar_arm"
            position={[-0.125, 0.34, 0.02]}
            rotation={[0.28, 0, -0.8 - paddleCycle * 0.32]}
          />
          <GalaxyAsset
            library={library}
            name="avatar_arm"
            position={[0.125, 0.34, 0.02]}
            rotation={[-0.28, 0, 0.8 + paddleCycle * 0.32]}
          />
        </group>
        <GalaxyAsset
          library={library}
          name="paddle"
          position={[0, 0.315, 0.06]}
          rotation={[0.08, 0, paddleCycle * 0.42]}
          scale={1.05}
        />
      </group>
    );
  }

  return (
    <group>
      <GalaxyAsset
        library={library}
        name="avatar_leg"
        position={[-0.052, 0.23, 0]}
        rotation={[landCycle * 0.45, 0, 0]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_leg"
        position={[0.052, 0.23, 0]}
        rotation={[-landCycle * 0.45, 0, 0]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_shoe"
        position={[-0.052, 0.035, 0.025]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_shoe"
        position={[0.052, 0.035, 0.025]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_torso"
        position={[0, 0.22, 0]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_head"
        position={[0, 0.68, 0]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_backpack"
        position={[0, 0.45, -0.095]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_arm"
        position={[-0.13, 0.55, 0]}
        rotation={[-landCycle * 0.32, 0, 0.05]}
      />
      <GalaxyAsset
        library={library}
        name="avatar_arm"
        position={[0.13, 0.55, 0]}
        rotation={[landCycle * 0.32, 0, -0.05]}
      />
    </group>
  );
}

function PlayerController({
  library,
  inputRef,
  exploreMode,
  reduceMotion,
  playerApiRef,
  onNearbyChange,
  onTraversalChange,
}: {
  library: Group;
  inputRef: MutableRefObject<ExploreInput>;
  exploreMode: boolean;
  reduceMotion: boolean;
  playerApiRef: MutableRefObject<PlayerApi>;
  onNearbyChange: (placeId: string | null) => void;
  onTraversalChange: (mode: TraversalMode) => void;
}) {
  const groupRef = useRef<Group>(null);
  const [mode, setMode] = useState<TraversalMode>("land");
  const nearbyRef = useRef<string | null>(null);
  const lastJumpSequenceRef = useRef(inputRef.current.jumpSequence);
  const jumpVelocityRef = useRef(0);
  const jumpOffsetRef = useRef(0);
  const movementRef = useRef(0);
  const orientationRef = useRef(new Quaternion());
  const orientationMatrixRef = useRef(new Matrix4());
  const rightRef = useRef(new Vector3());
  const desiredMoveRef = useRef(new Vector3());
  const workingDirectionRef = useRef(new Vector3());
  const [animationState, setAnimationState] = useState({
    moving: 0,
    elapsed: 0,
  });
  const animationAccumulatorRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const frameDelta = Math.min(delta, 0.05);
    const input = inputRef.current;
    const api = playerApiRef.current;
    const direction = api.direction;
    const heading = api.heading;
    const right = rightRef.current
      .crossVectors(direction, heading)
      .normalize();
    const desiredMove = desiredMoveRef.current
      .copy(heading)
      .multiplyScalar(input.forward)
      .addScaledVector(right, input.strafe);
    const inputStrength = MathUtils.clamp(desiredMove.length(), 0, 1);
    const currentTerrainRadius = terrainRadiusAt(direction);
    const nextMode: TraversalMode =
      currentTerrainRadius < WORLD_RADIUS + WATER_ENTRY_MARGIN
        ? "kayak"
        : "land";

    if (mode !== nextMode) {
      setMode(nextMode);
      api.mode = nextMode;
      onTraversalChange(nextMode);
      jumpVelocityRef.current = 0;
      jumpOffsetRef.current = 0;
    }

    if (exploreMode && inputStrength > 0.01) {
      desiredMove.normalize();
      const speed =
        nextMode === "kayak"
          ? input.sprint
            ? 0.56
            : 0.38
          : input.sprint
            ? 0.62
            : 0.42;
      workingDirectionRef.current
        .copy(direction)
        .addScaledVector(desiredMove, speed * frameDelta)
        .normalize();
      direction.copy(workingDirectionRef.current);
      heading
        .copy(desiredMove)
        .addScaledVector(direction, -desiredMove.dot(direction))
        .normalize();
    } else {
      heading
        .addScaledVector(direction, -heading.dot(direction))
        .normalize();
    }

    if (
      input.jumpSequence !== lastJumpSequenceRef.current
    ) {
      lastJumpSequenceRef.current = input.jumpSequence;
      if (nextMode === "land" && jumpOffsetRef.current < 0.01) {
        jumpVelocityRef.current = 1.15;
      }
    }

    if (nextMode === "land") {
      jumpVelocityRef.current -= 2.75 * frameDelta;
      jumpOffsetRef.current = Math.max(
        0,
        jumpOffsetRef.current + jumpVelocityRef.current * frameDelta,
      );
      if (jumpOffsetRef.current <= 0) {
        jumpVelocityRef.current = 0;
      }
    }

    const surfaceRadius =
      nextMode === "kayak"
        ? WORLD_RADIUS +
          sampleWaterHeight(direction, clock.elapsedTime) +
          KAYAK_CLEARANCE
        : terrainRadiusAt(direction) +
          LAND_CLEARANCE +
          jumpOffsetRef.current;
    api.position.copy(direction).multiplyScalar(surfaceRadius);
    movementRef.current = MathUtils.damp(
      movementRef.current,
      inputStrength,
      9,
      frameDelta,
    );

    const localRight = rightRef.current
      .crossVectors(direction, heading)
      .normalize();
    orientationMatrixRef.current.makeBasis(
      localRight,
      direction,
      heading,
    );
    orientationRef.current.setFromRotationMatrix(
      orientationMatrixRef.current,
    );
    group.position.copy(api.position);
    group.quaternion.slerp(
      orientationRef.current,
      1 - Math.exp(-frameDelta * 12),
    );

    let nearby: PlaceNode | null = null;
    let nearbyDistance = Number.POSITIVE_INFINITY;
    for (const node of PLACE_NODES) {
      const distance = angularDistance(direction, node.direction);
      if (distance < 0.095 && distance < nearbyDistance) {
        nearby = node;
        nearbyDistance = distance;
      }
    }
    const nextNearbyId = nearby?.place.id ?? null;
    if (nearbyRef.current !== nextNearbyId) {
      nearbyRef.current = nextNearbyId;
      onNearbyChange(nextNearbyId);
    }

    animationAccumulatorRef.current += frameDelta;
    if (animationAccumulatorRef.current > 1 / 18) {
      animationAccumulatorRef.current = 0;
      setAnimationState({
        moving: movementRef.current,
        elapsed: clock.elapsedTime,
      });
    }
  });

  return (
    <group ref={groupRef} scale={0.82}>
      <AvatarModel
        library={library}
        mode={mode}
        moving={animationState.moving}
        elapsed={animationState.elapsed}
        reduceMotion={reduceMotion}
      />
    </group>
  );
}

function CameraRig({
  exploreMode,
  reduceMotion,
  playerApiRef,
}: {
  exploreMode: boolean;
  reduceMotion: boolean;
  playerApiRef: MutableRefObject<PlayerApi>;
}) {
  const { camera, gl } = useThree();
  const yawRef = useRef(-0.18);
  const pitchRef = useRef(0.24);
  const distanceRef = useRef(13.4);
  const draggingRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const desiredPositionRef = useRef(new Vector3());
  const desiredTargetRef = useRef(new Vector3());
  const orbitDirectionRef = useRef(new Vector3());
  const sideRef = useRef(new Vector3());

  useEffect(() => {
    const element = gl.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      draggingRef.current = true;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      const deltaX = event.clientX - pointerRef.current.x;
      const deltaY = event.clientY - pointerRef.current.y;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      yawRef.current -= deltaX * 0.006;
      pitchRef.current = MathUtils.clamp(
        pitchRef.current + deltaY * 0.004,
        -0.12,
        0.72,
      );
    };
    const handlePointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (exploreMode) {
        return;
      }
      event.preventDefault();
      distanceRef.current = MathUtils.clamp(
        distanceRef.current + event.deltaY * 0.006,
        10.5,
        16,
      );
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerUp);
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerUp);
      element.removeEventListener("wheel", handleWheel);
    };
  }, [exploreMode, gl]);

  useFrame(({ clock }, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    if (!exploreMode) {
      if (!draggingRef.current && !reduceMotion) {
        yawRef.current += frameDelta * 0.045;
      }
      const cosPitch = Math.cos(pitchRef.current);
      desiredPositionRef.current.set(
        Math.sin(yawRef.current) * cosPitch,
        Math.sin(pitchRef.current),
        Math.cos(yawRef.current) * cosPitch,
      );
      desiredPositionRef.current.multiplyScalar(distanceRef.current);
      camera.position.lerp(
        desiredPositionRef.current,
        1 - Math.exp(-frameDelta * 4),
      );
      camera.up.lerp(UP, 1 - Math.exp(-frameDelta * 5)).normalize();
      camera.lookAt(0, 0, 0);
      return;
    }

    const api = playerApiRef.current;
    const orbitDirection = orbitDirectionRef.current
      .copy(api.heading)
      .applyAxisAngle(api.direction, yawRef.current * 0.35)
      .normalize();
    const side = sideRef.current
      .crossVectors(api.direction, orbitDirection)
      .normalize();
    desiredPositionRef.current
      .copy(api.position)
      .addScaledVector(api.direction, 1.28 + pitchRef.current * 0.42)
      .addScaledVector(orbitDirection, -3.05)
      .addScaledVector(side, 0.12);
    desiredTargetRef.current
      .copy(api.position)
      .addScaledVector(api.direction, 0.48)
      .addScaledVector(api.heading, 0.62);
    camera.position.lerp(
      desiredPositionRef.current,
      1 - Math.exp(-frameDelta * 6),
    );
    camera.up.lerp(
      api.direction,
      1 - Math.exp(-frameDelta * 7),
    ).normalize();
    camera.lookAt(desiredTargetRef.current);
    void clock;
  });

  return null;
}

function GalaxyWorld({
  exploreMode,
  exploreInputRef,
  reduceMotion,
  selectedPlaceId,
  onSelect,
  onNearbyChange,
  onTraversalChange,
}: PlacesSceneProps) {
  const { scene: library } = useLoader(
    GLTFLoader,
    ASSET_LIBRARY_URL,
  );
  const startingRegion =
    REGION_BY_ID.get("united-states") ?? COUNTRY_REGIONS[0];
  const initialDirection = directionFromOffset(
    startingRegion.center,
    0,
    -startingRegion.angularRadius * 0.34,
  );
  const initialHeading = tangentBasis(initialDirection).north;
  const playerApiRef = useRef<PlayerApi>({
    direction: initialDirection,
    heading: initialHeading,
    position: initialDirection
      .clone()
      .multiplyScalar(terrainRadiusAt(initialDirection) + LAND_CLEARANCE),
    mode: "land",
  });

  return (
    <>
      <SkyDome />
      <ambientLight intensity={0.32} />
      <hemisphereLight args={["#fff4db", "#476a72", 1.06]} />
      <directionalLight
        position={[8, 10, 7]}
        color="#fff0cf"
        intensity={1.72}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={28}
        shadow-bias={-0.00008}
        shadow-normalBias={0.035}
      />
      <directionalLight
        position={[-6, 2, 5]}
        color="#a9d8e3"
        intensity={0.38}
      />
      <Terrain />
      <WaterVolume reduceMotion={reduceMotion} />
      <Vegetation library={library} />
      <Destinations
        library={library}
        selectedPlaceId={selectedPlaceId}
        onSelect={onSelect}
      />
      <Birds reduceMotion={reduceMotion} />
      <PlayerController
        library={library}
        inputRef={exploreInputRef}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
        playerApiRef={playerApiRef}
        onNearbyChange={onNearbyChange}
        onTraversalChange={onTraversalChange}
      />
      <CameraRig
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
        playerApiRef={playerApiRef}
      />
    </>
  );
}

export function PlacesScene(props: PlacesSceneProps) {
  return (
    <Canvas
      className="places-canvas"
      aria-hidden="true"
      camera={{
        position: [0, 2.4, 11.2],
        fov: 42,
        near: 0.05,
        far: 70,
      }}
      dpr={[1, 1.75]}
      shadows="percentage"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#91c5d8"), 1);
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.16;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = PCFShadowMap;
      }}
    >
      <fog attach="fog" args={["#8fc4d6", 17, 36]} />
      <Suspense fallback={null}>
        <GalaxyWorld {...props} />
      </Suspense>
    </Canvas>
  );
}

useLoader.preload(GLTFLoader, ASSET_LIBRARY_URL);
