import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  MathUtils,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import {
  BIOMES,
  BIOME_BY_ID,
  OCEAN_SURFACE_RADIUS,
  PLACE_DIRECTIONS,
  PLANET_RADIUS,
  WATER_FEATURES,
  biomeForDirection,
  biomeHeightAt,
  directionFromOffset,
  islandPartDirection,
  isOceanDirection,
  isWaterDirection,
  surfaceRadiusAt,
  tangentBasis,
  waterSurfaceRadius,
  type BiomeDefinition,
  type BiomeKind,
  type WaterFeature,
} from "../data/planetoid";

type SkyPhase = "day" | "twilight" | "night";

type PlanetoidWorldProps = {
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  exploreMode: boolean;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
};

type VegetationDefinition = {
  id: string;
  biomeId: BiomeKind;
  direction: Vector3;
  position: Vector3;
  orientation: Quaternion;
  scale: number;
  rotation: number;
  phase: number;
  style:
    | "blossom"
    | "broadleaf"
    | "conifer"
    | "cypress"
    | "palm"
    | "pine";
};

type LoosePropState = {
  id: string;
  direction: Vector3;
  tangentVelocity: Vector3;
  orientation: Quaternion;
  scale: number;
  color: string;
  contactCooldown: number;
};

type FishDefinition = {
  id: string;
  direction: Vector3;
  orbitAxis: Vector3;
  phase: number;
  speed: number;
  bobPhase: number;
  scale: number;
  color: string;
};

const UP = new Vector3(0, 1, 0);
const TERRAIN_SEGMENTS = 108;
const TERRAIN_RINGS = 36;
const VEGETATION_INTERACTION_ANGLE = 0.105;
const MAX_OCEAN_TRAVEL_SPEED = 0.34;
const FLAG_STAR = (() => {
  const shape = new Shape();

  for (let point = 0; point < 10; point += 1) {
    const angle = Math.PI / 2 + (point / 10) * Math.PI * 2;
    const radius = point % 2 === 0 ? 0.033 : 0.014;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (point === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  shape.closePath();
  return shape;
})();

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function angularDistance(a: Vector3, b: Vector3) {
  return Math.acos(
    MathUtils.clamp(a.dot(b) / (a.length() * b.length()), -1, 1),
  );
}

function createTerrainChunkGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const ground = new Color(biome.ground);
  const groundDark = new Color(biome.groundDark);
  const highlight = new Color("#d2d38d");
  const random = createSeededRandom(biome.seed);

  biome.parts.forEach((part, partIndex) => {
    const vertexOffset = positions.length / 3;

    for (let ring = 0; ring <= TERRAIN_RINGS; ring += 1) {
      const ringProgress = ring / TERRAIN_RINGS;

      for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
        const angle =
          (segment / TERRAIN_SEGMENTS) * Math.PI * 2 +
          (ring % 2) * 0.026;
        const edgeJitter =
          ring === TERRAIN_RINGS ? (random() - 0.5) * 0.018 : 0;
        const direction = islandPartDirection(
          biome,
          part,
          Math.max(0, ringProgress + edgeJitter),
          angle,
        );
        const height = biomeHeightAt(direction, biome);
        const position = direction
          .clone()
          .multiplyScalar(surfaceRadiusAt(direction) + 0.006);
        const heightMix = MathUtils.clamp(
          height / (biome.baseHeight + biome.peakHeight * 0.7),
          0,
          1,
        );
        const color = groundDark
          .clone()
          .lerp(ground, 0.48 + heightMix * 0.46)
          .lerp(
            highlight,
            biome.id === "turkiye" || biome.id === "south-korea"
              ? Math.max(0, heightMix - 0.64) * 0.62
              : Math.max(0, heightMix - 0.8) * 0.28,
          )
          .multiplyScalar(
            0.9 + random() * 0.14 + partIndex * 0.012,
          );

        positions.push(position.x, position.y, position.z);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let ring = 0; ring < TERRAIN_RINGS; ring += 1) {
      for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
        const nextSegment = (segment + 1) % TERRAIN_SEGMENTS;
        const current =
          vertexOffset + ring * TERRAIN_SEGMENTS + segment;
        const next =
          vertexOffset + ring * TERRAIN_SEGMENTS + nextSegment;
        const outer =
          vertexOffset + (ring + 1) * TERRAIN_SEGMENTS + segment;
        const outerNext =
          vertexOffset +
          (ring + 1) * TERRAIN_SEGMENTS +
          nextSegment;

        if ((ring + segment + partIndex) % 2 === 0) {
          indices.push(current, outer, next, next, outer, outerNext);
        } else {
          indices.push(
            current,
            outer,
            outerNext,
            current,
            outerNext,
            next,
          );
        }
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "color",
    new Float32BufferAttribute(colors, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function createEscarpmentGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cliff = new Color(biome.cliff);
  const cliffDark = cliff.clone().multiplyScalar(0.62);
  biome.parts.forEach((part, partIndex) => {
    const vertexOffset = positions.length / 3;

    for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
      const angle = (segment / TERRAIN_SEGMENTS) * Math.PI * 2;
      const direction = islandPartDirection(
        biome,
        part,
        0.86 +
          Math.sin(segment * 2.17 + biome.seed + partIndex) * 0.008,
        angle,
      );
      const topRadius = surfaceRadiusAt(direction) + 0.005;
      const bottomRadius = OCEAN_SURFACE_RADIUS - 0.045;
      const top = direction.clone().multiplyScalar(topRadius);
      const bottom = direction.clone().multiplyScalar(bottomRadius);
      const shade = 0.75 + (segment % 6) * 0.035;
      const topColor = cliff.clone().multiplyScalar(shade);
      const bottomColor = cliffDark.clone().multiplyScalar(shade);

      positions.push(top.x, top.y, top.z, bottom.x, bottom.y, bottom.z);
      colors.push(
        topColor.r,
        topColor.g,
        topColor.b,
        bottomColor.r,
        bottomColor.g,
        bottomColor.b,
      );
    }

    for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
      const next = (segment + 1) % TERRAIN_SEGMENTS;
      const top = vertexOffset + segment * 2;
      const bottom = top + 1;
      const nextTop = vertexOffset + next * 2;
      const nextBottom = nextTop + 1;

      indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "color",
    new Float32BufferAttribute(colors, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function TerrainChunk({ biome }: { biome: BiomeDefinition }) {
  const terrainGeometry = useMemo(
    () => createTerrainChunkGeometry(biome),
    [biome],
  );
  const cliffGeometry = useMemo(
    () => createEscarpmentGeometry(biome),
    [biome],
  );

  useEffect(
    () => () => {
      terrainGeometry.dispose();
      cliffGeometry.dispose();
    },
    [cliffGeometry, terrainGeometry],
  );

  return (
    <group>
      <mesh
        geometry={terrainGeometry}
        castShadow
        receiveShadow
        renderOrder={2}
      >
        <meshToonMaterial
          vertexColors
        />
      </mesh>
      <mesh
        geometry={cliffGeometry}
        castShadow
        receiveShadow
        renderOrder={1}
      >
        <meshToonMaterial
          vertexColors
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function createPathGeometry(
  biome: BiomeDefinition,
  destination: Vector3,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const { east: centerEast } = tangentBasis(biome.center);
  const steps = 18;
  const width = 0.045;

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const direction = biome.center
      .clone()
      .lerp(destination, progress)
      .normalize();
    const sideways = new Vector3()
      .crossVectors(direction, centerEast)
      .cross(direction)
      .normalize();
    const radius = surfaceRadiusAt(direction) + 0.018;

    for (const side of [-1, 1]) {
      const position = direction
        .clone()
        .multiplyScalar(radius)
        .addScaledVector(sideways, side * width);
      positions.push(position.x, position.y, position.z);
    }
  }

  for (let step = 0; step < steps; step += 1) {
    const current = step * 2;
    const next = current + 2;
    indices.push(current, next, current + 1, current + 1, next, next + 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function BiomePaths({ biome }: { biome: BiomeDefinition }) {
  const directions = useMemo(
    () =>
      Array.from(PLACE_DIRECTIONS.entries())
        .filter(([, direction]) => {
          return angularDistance(direction, biome.center) < biome.angularRadius;
        })
        .map(([, direction]) => direction),
    [biome],
  );
  const geometries = useMemo(
    () =>
      directions.map((direction) =>
        createPathGeometry(biome, direction),
      ),
    [biome, directions],
  );

  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  return (
    <group>
      {geometries.map((geometry, index) => (
        <mesh
          key={`${biome.id}-path-${index}`}
          geometry={geometry}
          receiveShadow
          renderOrder={3}
        >
          <meshToonMaterial
            color={biome.path}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}

function createWaterGeometry(radius: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = 24;
  const segments = 72;

  for (let ring = 0; ring <= rings; ring += 1) {
    const ringProgress = ring / rings;

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edgeScale =
        1 +
        Math.sin(angle * 3 + 0.6) * 0.025 +
        Math.sin(angle * 7 - 0.4) * 0.015;
      const ringRadius = radius * ringProgress * edgeScale;

      positions.push(
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius,
        0,
      );
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const current = ring * segments + segment;
      const next = ring * segments + nextSegment;
      const outer = (ring + 1) * segments + segment;
      const outerNext = (ring + 1) * segments + nextSegment;

      indices.push(current, outer, next, next, outer, outerNext);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function OceanSurface({
  travelerDirectionRef,
  movementVelocityRef,
  exploreMode,
  reduceMotion,
  skyPhase,
}: PlanetoidWorldProps) {
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      motion: { value: reduceMotion ? 0 : 1 },
      interaction: { value: 0 },
      travelerDirection: { value: new Vector3(0, 1, 0) },
      deepColor: {
        value:
          skyPhase === "night"
            ? new Color("#102b42")
            : new Color("#1f7387"),
      },
      shallowColor: {
        value:
          skyPhase === "night"
            ? new Color("#285a70")
            : new Color("#62c4c0"),
      },
      foamColor: {
        value:
          skyPhase === "night"
            ? new Color("#a8d1d4")
            : new Color("#eafbf2"),
      },
    }),
    [reduceMotion, skyPhase],
  );

  useFrame(({ clock }) => {
    const travelerDirection = travelerDirectionRef.current;
    const oceanTravel = exploreMode && isOceanDirection(travelerDirection);

    uniforms.time.value = clock.elapsedTime;
    uniforms.travelerDirection.value.copy(travelerDirection);
    uniforms.interaction.value = oceanTravel
      ? MathUtils.clamp(
          Math.abs(movementVelocityRef.current) /
            MAX_OCEAN_TRAVEL_SPEED,
          0,
          1,
        )
      : 0;
  });

  return (
    <mesh renderOrder={1} receiveShadow>
      <sphereGeometry args={[OCEAN_SURFACE_RADIUS, 160, 80]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          uniform float time;
          uniform float motion;
          uniform float interaction;
          uniform vec3 travelerDirection;
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          varying float vWave;
          varying float vWake;

          void main() {
            vec3 direction = normalize(position);
            float radius = length(position);
            float broadWave = (
              sin(direction.x * 19.0 + time * 0.72) +
              sin(direction.z * 23.0 - time * 0.58) +
              sin((direction.x + direction.y) * 17.0 + time * 0.44)
            ) / 3.0;
            float detailWave = (
              sin(direction.y * 41.0 - time * 1.15) +
              sin((direction.z - direction.x) * 37.0 + time * 0.92)
            ) * 0.5;
            float travelerDistance = acos(clamp(
              dot(direction, normalize(travelerDirection)),
              -1.0,
              1.0
            ));
            float wake = sin(
              travelerDistance * 105.0 - time * 9.0
            ) * exp(-travelerDistance * 34.0) * interaction;
            float displacement = motion * (
              broadWave * 0.028 +
              detailWave * 0.01 +
              wake * 0.052
            );
            vec3 displacedPosition =
              direction * (radius + displacement);
            vec4 worldPosition =
              modelMatrix * vec4(displacedPosition, 1.0);

            vWave = clamp(
              0.5 + broadWave * 0.34 + detailWave * 0.12,
              0.0,
              1.0
            );
            vWake = wake;
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(
              mat3(modelMatrix) * direction
            );
            gl_Position = projectionMatrix * modelViewMatrix * vec4(
              displacedPosition,
              1.0
            );
          }
        `}
        fragmentShader={`
          uniform vec3 deepColor;
          uniform vec3 shallowColor;
          uniform vec3 foamColor;
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          varying float vWave;
          varying float vWake;

          void main() {
            vec3 normal = normalize(vWorldNormal);
            vec3 viewDirection = normalize(
              cameraPosition - vWorldPosition
            );
            float fresnel = pow(
              1.0 - abs(dot(normal, viewDirection)),
              2.25
            );
            vec3 lightDirection = normalize(
              vec3(-0.45, 0.82, 0.34)
            );
            float glint = pow(
              max(
                dot(
                  reflect(-lightDirection, normal),
                  viewDirection
                ),
                0.0
              ),
              38.0
            );
            float crest = smoothstep(0.67, 0.82, vWave);
            float wakeFoam = smoothstep(0.36, 0.82, abs(vWake));
            vec3 water = mix(
              deepColor,
              shallowColor,
              0.22 + fresnel * 0.44 + vWave * 0.12
            );
            water += glint * vec3(0.74, 0.94, 0.9);
            water = mix(
              water,
              foamColor,
              max(crest * 0.08, wakeFoam * 0.72)
            );

            gl_FragColor = vec4(
              water,
              0.7 + fresnel * 0.18 + crest * 0.025
            );
          }
        `}
        transparent
        depthWrite
      />
    </mesh>
  );
}

function createCoastlineFoamGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 112;
  const oceanHeight = OCEAN_SURFACE_RADIUS - PLANET_RADIUS;

  biome.parts.forEach((part, partIndex) => {
    const vertexOffset = positions.length / 3;

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      let shoreProgress = 0.68;

      for (let sample = 0; sample <= 40; sample += 1) {
        const progress = 0.68 + (sample / 40) * 0.32;
        const direction = islandPartDirection(
          biome,
          part,
          progress,
          angle,
        );

        if (biomeHeightAt(direction, biome) > oceanHeight + 0.006) {
          shoreProgress = progress;
        } else {
          break;
        }
      }

      const ripple =
        Math.sin(segment * 1.91 + biome.seed + partIndex) * 0.004;

      for (const offset of [-0.008, 0.008]) {
        const direction = islandPartDirection(
          biome,
          part,
          shoreProgress + ripple + offset,
          angle,
        );
        const position = direction
          .clone()
          .multiplyScalar(OCEAN_SURFACE_RADIUS + 0.014);

        positions.push(position.x, position.y, position.z);
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const inner = vertexOffset + segment * 2;
      const outer = inner + 1;
      const nextInner = vertexOffset + next * 2;
      const nextOuter = nextInner + 1;

      indices.push(
        inner,
        outer,
        nextInner,
        nextInner,
        outer,
        nextOuter,
      );
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createBeachGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 112;
  const oceanHeight = OCEAN_SURFACE_RADIUS - PLANET_RADIUS;

  biome.parts.forEach((part) => {
    const vertexOffset = positions.length / 3;

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      let shoreProgress = 0.68;

      for (let sample = 0; sample <= 40; sample += 1) {
        const progress = 0.68 + (sample / 40) * 0.32;
        const direction = islandPartDirection(
          biome,
          part,
          progress,
          angle,
        );

        if (biomeHeightAt(direction, biome) > oceanHeight + 0.008) {
          shoreProgress = progress;
        } else {
          break;
        }
      }

      for (const offset of [-0.055, -0.008]) {
        const direction = islandPartDirection(
          biome,
          part,
          Math.max(0.55, shoreProgress + offset),
          angle,
        );
        const position = direction
          .clone()
          .multiplyScalar(surfaceRadiusAt(direction) + 0.011);

        positions.push(position.x, position.y, position.z);
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const inner = vertexOffset + segment * 2;
      const outer = inner + 1;
      const nextInner = vertexOffset + next * 2;
      const nextOuter = nextInner + 1;

      indices.push(
        inner,
        outer,
        nextInner,
        nextInner,
        outer,
        nextOuter,
      );
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function CoastlineFoam({ biome }: { biome: BiomeDefinition }) {
  const foamGeometry = useMemo(
    () => createCoastlineFoamGeometry(biome),
    [biome],
  );
  const beachGeometry = useMemo(
    () => createBeachGeometry(biome),
    [biome],
  );

  useEffect(
    () => () => {
      foamGeometry.dispose();
      beachGeometry.dispose();
    },
    [beachGeometry, foamGeometry],
  );

  return (
    <group>
      <mesh
        geometry={beachGeometry}
        receiveShadow
        renderOrder={3}
      >
        <meshToonMaterial
          color={biome.shore}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh geometry={foamGeometry} renderOrder={4}>
        <meshBasicMaterial
          color="#effaf0"
          transparent
          opacity={0.68}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function WaterPool({
  water,
  travelerDirectionRef,
  movementVelocityRef,
  reduceMotion,
  skyPhase,
}: {
  water: WaterFeature;
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
}) {
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, water.center),
    [water.center],
  );
  const inverseOrientation = useMemo(
    () => orientation.clone().invert(),
    [orientation],
  );
  const radius = water.angularRadius * PLANET_RADIUS * 0.98;
  const surfaceRadius = waterSurfaceRadius(water);
  const position = useMemo(
    () =>
      water.center
        .clone()
        .multiplyScalar(surfaceRadius + 0.008),
    [surfaceRadius, water.center],
  );
  const waterGeometry = useMemo(
    () => createWaterGeometry(radius),
    [radius],
  );
  const travelerWorldPositionRef = useRef(new Vector3());
  const travelerLocalPositionRef = useRef(new Vector3());
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      interaction: { value: 0 },
      motion: { value: reduceMotion ? 0 : 1 },
      travelerPosition: { value: new Vector2(20, 20) },
      deepColor: {
        value:
          skyPhase === "night"
            ? new Color("#102d42")
            : new Color(water.color).multiplyScalar(0.58),
      },
      shallowColor: {
        value:
          skyPhase === "night"
            ? new Color("#2c6873")
            : new Color(water.color).lerp(new Color("#8ce1d1"), 0.46),
      },
      foamColor: {
        value:
          skyPhase === "night"
            ? new Color("#b9d8d7")
            : new Color("#eefcf5"),
      },
    }),
    [reduceMotion, skyPhase, water.color],
  );

  useEffect(() => () => waterGeometry.dispose(), [waterGeometry]);

  useFrame(({ clock }) => {
    const nearby = MathUtils.clamp(
      1 -
        angularDistance(
          travelerDirectionRef.current,
          water.center,
        ) /
          (water.angularRadius * 1.25),
      0,
      1,
    );
    const movement = MathUtils.clamp(
      Math.abs(movementVelocityRef.current) /
        (isWaterDirection(travelerDirectionRef.current) ? 0.36 : 0.7),
      0,
      1,
    );

    uniforms.time.value = clock.elapsedTime;
    uniforms.interaction.value = nearby * movement;
    const travelerWorldPosition = travelerWorldPositionRef.current
      .copy(travelerDirectionRef.current)
      .multiplyScalar(surfaceRadius);
    const travelerLocalPosition = travelerLocalPositionRef.current
      .copy(travelerWorldPosition)
      .sub(position)
      .applyQuaternion(inverseOrientation);

    uniforms.travelerPosition.value.set(
      travelerLocalPosition.x,
      -travelerLocalPosition.z,
    );
  });

  return (
    <group position={position} quaternion={orientation}>
      <mesh
        geometry={waterGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={5}
      >
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={`
            uniform float time;
            uniform float interaction;
            uniform float motion;
            uniform vec2 travelerPosition;
            varying vec3 vWorldPosition;
            varying float vDepth;
            varying float vCrest;
            varying float vFoam;

            void main() {
              float radialDistance = length(position.xy);
              float polarAngle = atan(position.y, position.x);
              float edgeScale =
                1.0 +
                sin(polarAngle * 3.0 + 0.6) * 0.025 +
                sin(polarAngle * 7.0 - 0.4) * 0.015;
              float normalizedRadius =
                radialDistance / (${radius.toFixed(5)} * edgeScale);
              float ambientWave = (
                sin(position.x * 8.0 + time * 1.25) +
                sin(position.y * 10.0 - time * 0.95) +
                sin((position.x + position.y) * 6.5 + time * 0.72)
              ) / 3.0;
              vec2 fromTraveler =
                position.xy - travelerPosition;
              float travelerDistance = length(fromTraveler);
              float wake = sin(
                travelerDistance * 29.0 - time * 8.0
              ) * exp(-travelerDistance * 3.3) * interaction;
              float shorelineNoise =
                sin(polarAngle * 9.0 + time * 0.45) *
                0.5 + 0.5;
              float sphericalSag =
                sqrt(max(
                  ${surfaceRadius.toFixed(5)} *
                    ${surfaceRadius.toFixed(5)} -
                    radialDistance * radialDistance,
                  0.0
                )) -
                ${surfaceRadius.toFixed(5)};
              float displacement = motion * (
                ambientWave * 0.026 +
                wake * 0.058
              );
              vec3 displacedPosition =
                position + normal * (sphericalSag + displacement);
              vec4 worldPosition =
                modelMatrix * vec4(displacedPosition, 1.0);

              vCrest = clamp(
                0.5 + ambientWave * 0.24 + wake * 0.8,
                0.0,
                1.0
              );
              vDepth = 1.0 - smoothstep(
                0.15,
                0.92,
                normalizedRadius
              );
              float shoreline = smoothstep(
                0.78 + shorelineNoise * 0.035,
                0.93 + shorelineNoise * 0.025,
                normalizedRadius
              );
              float wakeFoam = smoothstep(0.52, 0.84, abs(wake));
              vFoam = clamp(
                shoreline * (0.58 + shorelineNoise * 0.52) +
                wakeFoam * interaction,
                0.0,
                1.0
              );
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(
                displacedPosition,
                1.0
              );
            }
          `}
          fragmentShader={`
            uniform vec3 deepColor;
            uniform vec3 shallowColor;
            uniform vec3 foamColor;
            varying vec3 vWorldPosition;
            varying float vDepth;
            varying float vCrest;
            varying float vFoam;

            void main() {
              vec3 normal = normalize(cross(
                dFdx(vWorldPosition),
                dFdy(vWorldPosition)
              ));

              if (!gl_FrontFacing) {
                normal *= -1.0;
              }

              vec3 viewDirection = normalize(
                cameraPosition - vWorldPosition
              );
              float fresnel = pow(
                1.0 - abs(dot(normal, viewDirection)),
                2.2
              );
              vec3 lightDirection = normalize(
                vec3(-0.45, 0.82, 0.34)
              );
              float glint = pow(
                max(
                  dot(
                    reflect(-lightDirection, normal),
                    viewDirection
                  ),
                  0.0
                ),
                34.0
              );
              vec3 water = mix(
                shallowColor,
                deepColor,
                vDepth * 0.88
              );
              water = mix(
                water,
                shallowColor * 1.16,
                fresnel * 0.32 + vCrest * 0.12
              );
              water += glint * vec3(0.72, 0.9, 0.86);
              float crestLine = smoothstep(0.66, 0.77, vCrest);
              float foamMix = max(
                smoothstep(0.38, 0.9, vFoam),
                crestLine * 0.2
              );
              vec3 color = mix(
                water,
                foamColor,
                foamMix
              );
              float alpha = mix(0.78, 0.94, fresnel + vFoam * 0.4);

              gl_FragColor = vec4(color, alpha);
            }
          `}
          transparent
          depthWrite
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function vegetationStyleForBiome(
  biomeId: BiomeKind,
): VegetationDefinition["style"] {
  switch (biomeId) {
    case "dominican-republic":
      return "palm";
    case "turkiye":
      return "cypress";
    case "south-korea":
      return "pine";
    case "japan":
      return "blossom";
    default:
      return "broadleaf";
  }
}

function createVegetation() {
  return BIOMES.flatMap((biome) => {
    const random = createSeededRandom(biome.seed * 101);
    const plants: VegetationDefinition[] = [];
    const count =
      biome.id === "united-states"
        ? 48
        : biome.id === "turkiye"
          ? 36
          : biome.id === "japan"
            ? 38
            : biome.id === "south-korea"
              ? 30
              : 26;

    for (let index = 0; index < count; index += 1) {
      let direction = biome.center;

      for (let attempt = 0; attempt < 18; attempt += 1) {
        const candidate = directionFromOffset(
          biome.center,
          (random() - 0.5) * biome.angularRadius * 1.8,
          (random() - 0.5) * biome.angularRadius * 1.8,
        );
        const farFromPlaces = Array.from(PLACE_DIRECTIONS.values()).every(
          (placeDirection) =>
            angularDistance(candidate, placeDirection) > 0.075,
        );

        if (
          biomeForDirection(candidate)?.id === biome.id &&
          !isWaterDirection(candidate) &&
          farFromPlaces
        ) {
          direction = candidate;
          break;
        }
      }

      const surfaceRadius = surfaceRadiusAt(direction);

      plants.push({
        id: `${biome.id}-plant-${index}`,
        biomeId: biome.id,
        direction,
        position: direction.clone().multiplyScalar(surfaceRadius),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        scale: 0.72 + random() * 0.78,
        rotation: random() * Math.PI * 2,
        phase: random() * Math.PI * 2,
        style: vegetationStyleForBiome(biome.id),
      });
    }

    return plants;
  });
}

function TreeModel({
  style,
}: {
  style: VegetationDefinition["style"];
}) {
  if (style === "palm") {
    return (
      <>
        <mesh
          position={[0.015, 0.2, 0]}
          rotation={[0, 0, -0.08]}
          castShadow
        >
          <cylinderGeometry args={[0.025, 0.048, 0.4, 8]} />
          <meshToonMaterial color="#93633e" />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6].map((leaf) => (
          <mesh
            key={leaf}
            position={[0.03, 0.405, 0]}
            rotation={[
              0.08 + (leaf % 2) * 0.12,
              (leaf / 7) * Math.PI * 2,
              Math.PI / 2.75,
            ]}
            castShadow
          >
            <coneGeometry args={[0.068, 0.3, 5]} />
            <meshToonMaterial
              color={leaf % 2 === 0 ? "#3f8c64" : "#58a76e"}
            />
          </mesh>
        ))}
        {[0, 1, 2].map((coconut) => (
          <mesh
            key={`coconut-${coconut}`}
            position={[
              -0.015 + coconut * 0.025,
              0.385 - (coconut % 2) * 0.018,
              0.015,
            ]}
            castShadow
          >
            <dodecahedronGeometry args={[0.026, 0]} />
            <meshToonMaterial color="#6e4932" />
          </mesh>
        ))}
      </>
    );
  }

  if (style === "conifer" || style === "pine") {
    const pine = style === "pine";

    return (
      <>
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.023, 0.044, 0.32, 7]} />
          <meshToonMaterial color="#76513a" />
        </mesh>
        {[
          [0.23, 0.18, 0.24],
          [0.34, 0.15, 0.23],
          [0.44, 0.115, 0.2],
        ].map(([height, radius, length], tier) => (
          <mesh key={tier} position={[0, height, 0]} castShadow>
            <coneGeometry args={[radius, length, pine ? 9 : 7]} />
            <meshToonMaterial
              color={
                pine
                  ? tier === 1
                    ? "#39725a"
                    : "#4c8263"
                  : tier === 1
                    ? "#416e59"
                    : "#537c63"
              }
            />
          </mesh>
        ))}
      </>
    );
  }

  if (style === "cypress") {
    return (
      <>
        <mesh position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.035, 0.34, 7]} />
          <meshToonMaterial color="#70513b" />
        </mesh>
        <mesh position={[0, 0.32, 0]} scale={[0.7, 1.55, 0.7]} castShadow>
          <dodecahedronGeometry args={[0.12, 1]} />
          <meshToonMaterial color="#3d684f" />
        </mesh>
        <mesh position={[0.01, 0.47, 0]} scale={[0.48, 1.25, 0.48]} castShadow>
          <dodecahedronGeometry args={[0.1, 1]} />
          <meshToonMaterial color="#52785a" />
        </mesh>
      </>
    );
  }

  const blossom = style === "blossom";
  const crownColors = blossom
    ? ["#e795a7", "#f0afb7", "#f6c5c4", "#dc829d"]
    : ["#4f8a5c", "#639c64", "#78aa69", "#5a9460"];
  const crownPositions: [number, number, number, number][] = [
    [-0.055, 0.34, 0.01, 0.12],
    [0.065, 0.355, -0.025, 0.135],
    [0.005, 0.43, 0.015, 0.13],
    [0.105, 0.41, 0.035, 0.095],
  ];

  return (
    <>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.047, 0.34, 8]} />
        <meshToonMaterial color="#78513d" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.045, 0.27, 0]}
          rotation={[0, 0, side * -0.62]}
          castShadow
        >
          <cylinderGeometry args={[0.012, 0.016, 0.16, 6]} />
          <meshToonMaterial color="#78513d" />
        </mesh>
      ))}
      {crownPositions.map(([x, y, z, radius], index) => (
        <mesh
          key={index}
          position={[x, y, z]}
          scale={[1.12, 0.86, 1]}
          castShadow
        >
          <dodecahedronGeometry args={[radius, 1]} />
          <meshToonMaterial color={crownColors[index]} />
        </mesh>
      ))}
    </>
  );
}

function VegetationField({
  travelerDirectionRef,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  reduceMotion: boolean;
}) {
  const plants = useMemo(createVegetation, []);
  const plantRefs = useRef<Array<Group | null>>([]);
  const bendAxisRef = useRef(new Vector3());
  const baseOrientationRef = useRef(new Quaternion());
  const bendRef = useRef(new Quaternion());

  useFrame(({ clock }, delta) => {
    const ease = 1 - Math.exp(-Math.min(delta, 0.05) * 7);

    plants.forEach((plant, index) => {
      const group = plantRefs.current[index];

      if (!group) {
        return;
      }

      const travelerDistance = angularDistance(
        plant.direction,
        travelerDirectionRef.current,
      );
      const travelerBend =
        1 -
        MathUtils.smoothstep(
          travelerDistance,
          0.015,
          VEGETATION_INTERACTION_ANGLE,
        );
      const wind =
        reduceMotion
          ? 0
          : Math.sin(clock.elapsedTime * 1.2 + plant.phase) * 0.035;
      const bend = Math.min(
        0.34,
        wind + travelerBend * 0.3,
      );
      const bendTarget =
        travelerBend > 0.01 ? travelerDirectionRef.current : UP;
      const bendAxis = bendAxisRef.current
        .crossVectors(plant.direction, bendTarget)
        .normalize();

      if (bendAxis.lengthSq() < 0.0001) {
        bendAxis.set(1, 0, 0);
      }

      const baseOrientation = baseOrientationRef.current
        .copy(plant.orientation)
        .multiply(
          new Quaternion().setFromAxisAngle(UP, plant.rotation),
        );
      const target = bendRef.current
        .setFromAxisAngle(bendAxis, bend)
        .multiply(baseOrientation);

      group.quaternion.slerp(target, ease);
    });
  });

  return (
    <group>
      {plants.map((plant, index) => (
        <group
          key={plant.id}
          ref={(group) => {
            plantRefs.current[index] = group;
          }}
          position={plant.position}
          quaternion={plant.orientation}
          scale={plant.scale}
        >
          <TreeModel style={plant.style} />
        </group>
      ))}
    </group>
  );
}

function createLooseProps() {
  const props: LoosePropState[] = [];

  BIOMES.forEach((biome) => {
    const random = createSeededRandom(biome.seed * 307);

    for (let index = 0; index < 6; index += 1) {
      let direction = biome.center;

      for (let attempt = 0; attempt < 16; attempt += 1) {
        const candidate = directionFromOffset(
          biome.center,
          (random() - 0.5) * biome.angularRadius * 1.65,
          (random() - 0.5) * biome.angularRadius * 1.65,
        );

        if (
          biomeForDirection(candidate)?.id === biome.id &&
          !isWaterDirection(candidate)
        ) {
          direction = candidate;
          break;
        }
      }

      if (isWaterDirection(direction)) {
        continue;
      }

      props.push({
        id: `${biome.id}-loose-prop-${index}`,
        direction,
        tangentVelocity: new Vector3(),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        scale: 0.1 + random() * 0.11,
        color:
          biome.id === "japan"
            ? "#8e817a"
            : biome.id === "dominican-republic"
              ? "#a77e57"
              : biome.id === "turkiye"
                ? "#8e7460"
              : "#776e64",
        contactCooldown: 0,
      });
    }
  });

  return props;
}

function LooseProps({
  travelerDirectionRef,
  movementVelocityRef,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const props = useMemo(createLooseProps, []);
  const propRefs = useRef<Array<Mesh | null>>([]);
  const impulseRef = useRef(new Vector3());
  const axisRef = useRef(new Vector3());
  const nextDirectionRef = useRef(new Vector3());
  const orientationRef = useRef(new Quaternion());

  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05);

    props.forEach((prop, index) => {
      const mesh = propRefs.current[index];

      if (!mesh) {
        return;
      }

      const travelerDistance = angularDistance(
        prop.direction,
        travelerDirectionRef.current,
      );
      prop.contactCooldown = Math.max(
        0,
        prop.contactCooldown - frameDelta,
      );

      if (
        exploreMode &&
        travelerDistance < 0.055 &&
        prop.contactCooldown === 0 &&
        Math.abs(movementVelocityRef.current) > 0.08
      ) {
        const impulse = impulseRef.current
          .copy(prop.direction)
          .sub(travelerDirectionRef.current)
          .addScaledVector(
            prop.direction,
            -prop.direction
              .clone()
              .sub(travelerDirectionRef.current)
              .dot(prop.direction),
          );

        if (impulse.lengthSq() > 0.00001) {
          prop.tangentVelocity.addScaledVector(
            impulse.normalize(),
            0.52 + Math.abs(movementVelocityRef.current) * 0.42,
          );
        } else {
          prop.tangentVelocity.addScaledVector(
            tangentBasis(prop.direction).east,
            0.48,
          );
        }

        prop.contactCooldown = 0.34;
      }

      prop.tangentVelocity.multiplyScalar(
        Math.exp(-frameDelta * (reduceMotion ? 9 : 4.2)),
      );

      if (prop.tangentVelocity.lengthSq() > 0.000001) {
        const speed = prop.tangentVelocity.length();
        const axis = axisRef.current
          .crossVectors(prop.tangentVelocity, prop.direction)
          .normalize();
        const angle = speed * frameDelta;
        const nextDirection = nextDirectionRef.current
          .copy(prop.direction)
          .applyAxisAngle(axis, angle)
          .normalize();

        if (isWaterDirection(nextDirection)) {
          prop.tangentVelocity.multiplyScalar(-0.28);
          prop.contactCooldown = Math.max(
            prop.contactCooldown,
            0.18,
          );
        } else {
          prop.direction.copy(nextDirection);
          prop.tangentVelocity
            .addScaledVector(
              prop.direction,
              -prop.tangentVelocity.dot(prop.direction),
            )
            .normalize()
            .multiplyScalar(speed);
          mesh.rotateX(angle * 5.4);
          mesh.rotateZ(angle * 3.1);
        }
      }

      mesh.position
        .copy(prop.direction)
        .multiplyScalar(surfaceRadiusAt(prop.direction) + prop.scale);
      const orientation = orientationRef.current.setFromUnitVectors(
        UP,
        prop.direction,
      );
      mesh.quaternion.slerp(
        orientation,
        1 - Math.exp(-frameDelta * 2.5),
      );
    });
  });

  return (
    <group>
      {props.map((prop, index) => (
        <mesh
          key={prop.id}
          ref={(mesh) => {
            propRefs.current[index] = mesh;
          }}
          position={prop.direction
            .clone()
            .multiplyScalar(surfaceRadiusAt(prop.direction) + prop.scale)}
          quaternion={prop.orientation}
          scale={[prop.scale * 1.15, prop.scale, prop.scale * 0.9]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshToonMaterial
            color={prop.color}
          />
        </mesh>
      ))}
    </group>
  );
}

function FlagRectangle({
  color,
  position,
  size,
  rotation = 0,
}: {
  color: string;
  position: [number, number, number];
  size: [number, number];
  rotation?: number;
}) {
  return (
    <mesh
      position={position}
      rotation={[0, 0, rotation]}
      renderOrder={position[2] > 0 ? 30 + Math.round(position[2] * 1000) : 20}
    >
      <planeGeometry args={size} />
      <meshToonMaterial
        color={color}
        side={DoubleSide}
        depthTest={position[2] <= 0}
        depthWrite={position[2] <= 0}
      />
    </mesh>
  );
}

function CountryFlagPattern({ biomeId }: { biomeId: BiomeKind }) {
  if (biomeId === "united-states") {
    return (
      <>
        <FlagRectangle
          color="#f7f2e8"
          position={[0, 0, 0]}
          size={[0.56, 0.34]}
        />
        {Array.from({ length: 7 }, (_, stripe) => (
          <FlagRectangle
            key={stripe}
            color="#c73c43"
            position={[0, 0.145 - stripe * 0.048, 0.003]}
            size={[0.56, 0.024]}
          />
        ))}
        <FlagRectangle
          color="#315487"
          position={[-0.17, 0.075, 0.006]}
          size={[0.22, 0.17]}
        />
        {[
          [-0.225, 0.105],
          [-0.17, 0.105],
          [-0.115, 0.105],
          [-0.2, 0.055],
          [-0.145, 0.055],
          [-0.09, 0.055],
        ].map(([x, y], star) => (
          <mesh key={star} position={[x, y, 0.009]} renderOrder={42}>
            <circleGeometry args={[0.009, 5]} />
            <meshBasicMaterial
              color="#ffffff"
              side={DoubleSide}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        ))}
      </>
    );
  }

  if (biomeId === "dominican-republic") {
    return (
      <>
        <FlagRectangle
          color="#ffffff"
          position={[0, 0, 0]}
          size={[0.56, 0.34]}
        />
        {[
          [-0.155, 0.095, "#224a93"],
          [0.155, 0.095, "#c63842"],
          [-0.155, -0.095, "#c63842"],
          [0.155, -0.095, "#224a93"],
        ].map(([x, y, color], panel) => (
          <FlagRectangle
            key={panel}
            color={color as string}
            position={[x as number, y as number, 0.003]}
            size={[0.23, 0.12]}
          />
        ))}
        <mesh position={[0, 0, 0.007]} renderOrder={41}>
          <circleGeometry args={[0.032, 12]} />
          <meshToonMaterial
            color="#438459"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </>
    );
  }

  if (biomeId === "turkiye") {
    return (
      <>
        <FlagRectangle
          color="#cf343c"
          position={[0, 0, 0]}
          size={[0.56, 0.34]}
        />
        <mesh position={[-0.07, 0, 0.004]} renderOrder={38}>
          <circleGeometry args={[0.09, 24]} />
          <meshBasicMaterial
            color="#ffffff"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-0.035, 0.012, 0.007]} renderOrder={40}>
          <circleGeometry args={[0.072, 24]} />
          <meshBasicMaterial
            color="#cf343c"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh
          position={[0.075, 0, 0.008]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <shapeGeometry args={[FLAG_STAR]} />
          <meshBasicMaterial
            color="#ffffff"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </>
    );
  }

  if (biomeId === "south-korea") {
    return (
      <>
        <FlagRectangle
          color="#fbfaf5"
          position={[0, 0, 0]}
          size={[0.56, 0.34]}
        />
        <mesh position={[0, 0.018, 0.004]} renderOrder={38}>
          <circleGeometry args={[0.078, 24, 0, Math.PI]} />
          <meshBasicMaterial
            color="#c83e48"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh
          position={[0, -0.018, 0.004]}
          rotation={[0, 0, Math.PI]}
          renderOrder={39}
        >
          <circleGeometry args={[0.078, 24, 0, Math.PI]} />
          <meshBasicMaterial
            color="#31578f"
            side={DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {[
          [-0.19, 0.085, -0.42],
          [-0.19, 0.045, -0.42],
          [0.19, -0.045, -0.42],
          [0.19, -0.085, -0.42],
        ].map(([x, y, rotation], bar) => (
          <FlagRectangle
            key={bar}
            color="#26272a"
            position={[x, y, 0.006]}
            size={[0.09, 0.014]}
            rotation={rotation}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <FlagRectangle
        color="#fffdf6"
        position={[0, 0, 0]}
        size={[0.56, 0.34]}
      />
      <mesh position={[0, 0, 0.004]} renderOrder={38}>
        <circleGeometry args={[0.092, 28]} />
        <meshBasicMaterial
          color="#cf3f47"
          side={DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function CountryFlag({
  biome,
  reduceMotion,
}: {
  biome: BiomeDefinition;
  reduceMotion: boolean;
}) {
  const clothRef = useRef<Group>(null);
  const direction = useMemo(
    () =>
      directionFromOffset(
        biome.center,
        biome.flagOffset[0],
        biome.flagOffset[1],
      ),
    [biome],
  );
  const position = useMemo(
    () =>
      direction
        .clone()
        .multiplyScalar(surfaceRadiusAt(direction) + 0.005),
    [direction],
  );
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, direction),
    [direction],
  );

  useFrame(({ clock }) => {
    if (!clothRef.current) {
      return;
    }

    clothRef.current.rotation.y = reduceMotion
      ? 0
      : Math.sin(clock.elapsedTime * 1.45 + biome.seed) * 0.12;
    clothRef.current.rotation.z = reduceMotion
      ? 0
      : Math.sin(clock.elapsedTime * 1.1 + biome.seed * 0.2) * 0.025;
  });

  return (
    <group position={position} quaternion={orientation}>
      <mesh position={[0, 0.035, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.13, 0.17, 0.07, 12]} />
        <meshToonMaterial color={biome.cliff} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.026, 1.1, 10]} />
        <meshToonMaterial color="#4e5154" />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshToonMaterial color="#d9ad4c" />
      </mesh>
      <group ref={clothRef} position={[0.3, 0.92, 0]}>
        <CountryFlagPattern biomeId={biome.id} />
        <mesh
          position={[-0.286, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.009, 0.009, 0.34, 6]} />
          <meshToonMaterial color="#d5d0c1" />
        </mesh>
      </group>
    </group>
  );
}

function LandmarkTerrain() {
  const unitedStates = BIOME_BY_ID.get("united-states")!;
  const dominicanRepublic = BIOME_BY_ID.get("dominican-republic")!;
  const turkiye = BIOME_BY_ID.get("turkiye")!;
  const southKorea = BIOME_BY_ID.get("south-korea")!;
  const japan = BIOME_BY_ID.get("japan")!;
  const mountainDirections = [
    directionFromOffset(turkiye.center, 0.15, 0.1),
    directionFromOffset(turkiye.center, 0.24, 0.065),
    directionFromOffset(turkiye.center, 0.32, 0.03),
  ];
  const beachDirection = directionFromOffset(
    dominicanRepublic.center,
    0.1,
    -0.025,
  );
  const barnDirection = directionFromOffset(
    unitedStates.center,
    -0.29,
    -0.07,
  );
  const koreaDirection = directionFromOffset(
    southKorea.center,
    0.03,
    0.14,
  );
  const gardenHill = directionFromOffset(
    japan.center,
    -0.025,
    0.13,
  );

  return (
    <group>
      {mountainDirections.map((direction, index) => (
        <group
          key={`mountain-${index}`}
          position={direction
            .clone()
            .multiplyScalar(surfaceRadiusAt(direction) - 0.03)}
          quaternion={new Quaternion().setFromUnitVectors(UP, direction)}
        >
          <mesh
            position={[0, 0.25 + index * 0.06, 0]}
            rotation={[0, index * 0.8, 0]}
            castShadow
            receiveShadow
          >
            <coneGeometry
              args={[0.28 - index * 0.025, 0.58 + index * 0.14, 9]}
            />
            <meshToonMaterial
              color={index === 1 ? "#7d766b" : "#8c816d"}
            />
          </mesh>
          <mesh
            position={[0, 0.49 + index * 0.09, 0]}
            rotation={[0, index * 0.8, 0]}
          >
            <coneGeometry args={[0.11, 0.21, 9]} />
            <meshToonMaterial color="#e8ded0" />
          </mesh>
        </group>
      ))}

      <group
        position={barnDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(barnDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, barnDirection)}
      >
        <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.2, 0.2]} />
          <meshToonMaterial color="#a94a3e" />
        </mesh>
        <mesh position={[0, 0.245, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.19, 0.15, 4]} />
          <meshToonMaterial color="#e3d4b9" />
        </mesh>
        <mesh position={[0, 0.1, 0.102]}>
          <planeGeometry args={[0.075, 0.11]} />
          <meshToonMaterial color="#f3e8d2" />
        </mesh>
        <mesh position={[0.22, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.07, 0.32, 10]} />
          <meshToonMaterial color="#b6c0b8" />
        </mesh>
        <mesh position={[0.22, 0.34, 0]}>
          <coneGeometry args={[0.08, 0.08, 10]} />
          <meshToonMaterial color="#8d9895" />
        </mesh>
      </group>

      <group
        position={beachDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(beachDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, beachDirection)}
      >
        <mesh position={[0, 0.025, 0]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.05, 16]} />
          <meshToonMaterial color="#edd08a" />
        </mesh>
        <mesh position={[0.08, 0.13, -0.02]} rotation={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.009, 0.012, 0.25, 7]} />
          <meshToonMaterial color="#80624d" />
        </mesh>
        <mesh position={[0.08, 0.25, -0.02]} rotation={[0, 0, -0.18]}>
          <coneGeometry args={[0.14, 0.07, 12]} />
          <meshToonMaterial color="#e35d58" />
        </mesh>
      </group>

      <group
        position={koreaDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(koreaDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, koreaDirection)}
      >
        {[0, 1, 2].map((tier) => (
          <group key={tier} position={[0, 0.08 + tier * 0.105, 0]}>
            <mesh castShadow>
              <boxGeometry
                args={[
                  0.2 - tier * 0.045,
                  0.07,
                  0.17 - tier * 0.035,
                ]}
              />
              <meshToonMaterial
                color={tier % 2 === 0 ? "#78766d" : "#918b7e"}
              />
            </mesh>
            <mesh position={[0, 0.055, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry
                args={[0.15 - tier * 0.035, 0.055, 4]}
              />
              <meshToonMaterial color="#4f6e5d" />
            </mesh>
          </group>
        ))}
      </group>

      <group
        position={gardenHill
          .clone()
          .multiplyScalar(surfaceRadiusAt(gardenHill))}
        quaternion={new Quaternion().setFromUnitVectors(UP, gardenHill)}
      >
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.25, 0.24, 8]} />
          <meshToonMaterial color="#657965" />
        </mesh>
        <mesh position={[-0.12, 0.34, 0]} castShadow>
          <boxGeometry args={[0.035, 0.34, 0.045]} />
          <meshToonMaterial color="#c94a42" />
        </mesh>
        <mesh position={[0.12, 0.34, 0]} castShadow>
          <boxGeometry args={[0.035, 0.34, 0.045]} />
          <meshToonMaterial color="#c94a42" />
        </mesh>
        <mesh position={[0, 0.49, 0]} castShadow>
          <boxGeometry args={[0.32, 0.04, 0.055]} />
          <meshToonMaterial color="#d45449" />
        </mesh>
        <mesh position={[0, 0.445, 0]} castShadow>
          <boxGeometry args={[0.25, 0.035, 0.05]} />
          <meshToonMaterial color="#e16858" />
        </mesh>
      </group>
    </group>
  );
}

function BasePlanetoid({ skyPhase }: { skyPhase: SkyPhase }) {
  const geometry = useMemo(() => {
    const nextGeometry = new IcosahedronGeometry(PLANET_RADIUS, 5);
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={skyPhase === "night" ? "#142a35" : "#285158"}
        roughness={1}
        metalness={0}
        flatShading
      />
    </mesh>
  );
}

function createFishDefinitions() {
  const random = createSeededRandom(81_527);
  const colors = ["#e9b44c", "#e56b5d", "#63b7af", "#8ac0d0"];
  const definitions: FishDefinition[] = [];

  for (let school = 0; school < 4; school += 1) {
    const longitude = random() * Math.PI * 2;
    const vertical = random() * 1.5 - 0.75;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const center = new Vector3(
      Math.cos(longitude) * horizontal,
      vertical,
      Math.sin(longitude) * horizontal,
    ).normalize();
    const { east, north } = tangentBasis(center);
    const travelDirection = east
      .clone()
      .multiplyScalar(0.75 + random() * 0.25)
      .addScaledVector(north, (random() - 0.5) * 0.55)
      .normalize();
    const orbitAxis = new Vector3()
      .crossVectors(center, travelDirection)
      .normalize();
    const schoolSpeed = 0.018 + random() * 0.012;

    for (let fish = 0; fish < 4; fish += 1) {
      definitions.push({
        id: `fish-${school}-${fish}`,
        direction: directionFromOffset(
          center,
          (random() - 0.5) * 0.18,
          (random() - 0.5) * 0.12,
        ),
        orbitAxis: orbitAxis.clone(),
        phase: (random() - 0.5) * 0.08,
        speed: schoolSpeed * (0.92 + random() * 0.16),
        bobPhase: random() * Math.PI * 2,
        scale: 0.78 + random() * 0.42,
        color: colors[(school + fish) % colors.length],
      });
    }
  }

  return definitions;
}

function SwimmingFish({
  definition,
  reduceMotion,
}: {
  definition: FishDefinition;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const directionRef = useRef(new Vector3());
  const positionRef = useRef(new Vector3());
  const tangentRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());

  useFrame(({ clock }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const elapsed = reduceMotion ? 0 : clock.elapsedTime;
    const direction = directionRef.current
      .copy(definition.direction)
      .applyAxisAngle(
        definition.orbitAxis,
        definition.phase + elapsed * definition.speed,
      )
      .normalize();

    group.visible = isOceanDirection(direction);

    if (!group.visible) {
      return;
    }

    const swimDepth = reduceMotion
      ? 0.072
      : 0.066 +
        (Math.sin(elapsed * 1.35 + definition.bobPhase) * 0.5 + 0.5) *
          0.018;
    const position = positionRef.current
      .copy(direction)
      .multiplyScalar(OCEAN_SURFACE_RADIUS - swimDepth);
    const tangent = tangentRef.current
      .crossVectors(definition.orbitAxis, direction)
      .normalize();

    group.position.copy(position);
    group.up.copy(direction);
    group.lookAt(lookTargetRef.current.copy(position).add(tangent));
    group.rotation.z = reduceMotion
      ? 0
      : Math.sin(elapsed * 3.2 + definition.bobPhase) * 0.08;
  });

  return (
    <group ref={groupRef} scale={definition.scale}>
      <mesh scale={[0.055, 0.06, 0.15]} castShadow renderOrder={4}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh
        position={[0, 0, -0.16]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.075, 0.07, 0.045]}
        castShadow
        renderOrder={4}
      >
        <coneGeometry args={[1, 1, 3]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh
        position={[0, 0.055, -0.02]}
        rotation={[0, 0, Math.PI]}
        scale={[0.035, 0.06, 0.04]}
        castShadow
        renderOrder={4}
      >
        <coneGeometry args={[1, 1, 3]} />
        <meshToonMaterial color="#f5df8b" />
      </mesh>
      <mesh position={[0.031, 0.018, 0.105]} renderOrder={5}>
        <sphereGeometry args={[0.012, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
      <mesh position={[-0.031, 0.018, 0.105]} renderOrder={5}>
        <sphereGeometry args={[0.012, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
    </group>
  );
}

function OceanLife({ reduceMotion }: { reduceMotion: boolean }) {
  const fish = useMemo(createFishDefinitions, []);

  return (
    <group>
      {fish.map((definition) => (
        <SwimmingFish
          key={definition.id}
          definition={definition}
          reduceMotion={reduceMotion}
        />
      ))}
    </group>
  );
}

export function PlanetoidWorld({
  travelerDirectionRef,
  movementVelocityRef,
  exploreMode,
  reduceMotion,
  skyPhase,
}: PlanetoidWorldProps) {
  return (
    <group>
      <BasePlanetoid skyPhase={skyPhase} />
      <OceanSurface
        travelerDirectionRef={travelerDirectionRef}
        movementVelocityRef={movementVelocityRef}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
        skyPhase={skyPhase}
      />
      <OceanLife reduceMotion={reduceMotion} />

      {BIOMES.map((biome) => (
        <group key={biome.id}>
          <TerrainChunk biome={biome} />
          <BiomePaths biome={biome} />
          <CoastlineFoam biome={biome} />
        </group>
      ))}

      {WATER_FEATURES.map((water) => (
        <WaterPool
          key={water.id}
          water={water}
          travelerDirectionRef={travelerDirectionRef}
          movementVelocityRef={movementVelocityRef}
          reduceMotion={reduceMotion}
          skyPhase={skyPhase}
        />
      ))}

      {BIOMES.map((biome) => (
        <CountryFlag
          key={`${biome.id}-flag`}
          biome={biome}
          reduceMotion={reduceMotion}
        />
      ))}

      <LandmarkTerrain />
      <VegetationField
        travelerDirectionRef={travelerDirectionRef}
        reduceMotion={reduceMotion}
      />
      <LooseProps
        travelerDirectionRef={travelerDirectionRef}
        movementVelocityRef={movementVelocityRef}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
      />
    </group>
  );
}
