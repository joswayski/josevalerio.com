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
  biomeHeightAt,
  directionFromOffset,
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
  style: "blossom" | "broadleaf" | "conifer" | "palm";
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

const UP = new Vector3(0, 1, 0);
const TERRAIN_SEGMENTS = 84;
const TERRAIN_RINGS = 28;
const VEGETATION_INTERACTION_ANGLE = 0.105;

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

function directionForPolarOffset(
  center: Vector3,
  distance: number,
  angle: number,
) {
  return directionFromOffset(
    center,
    Math.cos(angle) * distance,
    Math.sin(angle) * distance,
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

  for (let ring = 0; ring <= TERRAIN_RINGS; ring += 1) {
    const ringProgress = ring / TERRAIN_RINGS;
    const angularRadius = biome.angularRadius * ringProgress;

    for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
      const angle =
        (segment / TERRAIN_SEGMENTS) * Math.PI * 2 +
        (ring % 2) * 0.038;
      const edgeJitter =
        ring === TERRAIN_RINGS
          ? (random() - 0.5) * biome.angularRadius * 0.035
          : 0;
      const direction = directionForPolarOffset(
        biome.center,
        Math.max(0, angularRadius + edgeJitter),
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
        .lerp(ground, 0.5 + heightMix * 0.42)
        .lerp(
          highlight,
          biome.id === "highlands"
            ? Math.max(0, heightMix - 0.7) * 0.55
            : Math.max(0, heightMix - 0.82) * 0.25,
        )
        .multiplyScalar(0.92 + random() * 0.12);

      positions.push(position.x, position.y, position.z);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let ring = 0; ring < TERRAIN_RINGS; ring += 1) {
    for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
      const nextSegment = (segment + 1) % TERRAIN_SEGMENTS;
      const current = ring * TERRAIN_SEGMENTS + segment;
      const next = ring * TERRAIN_SEGMENTS + nextSegment;
      const outer = (ring + 1) * TERRAIN_SEGMENTS + segment;
      const outerNext =
        (ring + 1) * TERRAIN_SEGMENTS + nextSegment;

      if ((ring + segment) % 2 === 0) {
        indices.push(current, outer, next, next, outer, outerNext);
      } else {
        indices.push(current, outer, outerNext, current, outerNext, next);
      }
    }
  }

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
  const ringRadius = biome.angularRadius * 0.81;

  for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
    const angle = (segment / TERRAIN_SEGMENTS) * Math.PI * 2;
    const direction = directionForPolarOffset(
      biome.center,
      ringRadius +
        Math.sin(segment * 2.17 + biome.seed) *
          biome.angularRadius *
          0.012,
      angle,
    );
    const topRadius =
      PLANET_RADIUS + biomeHeightAt(direction, biome) + 0.005;
    const bottomRadius = PLANET_RADIUS + 0.012;
    const top = direction.clone().multiplyScalar(topRadius);
    const bottom = direction.clone().multiplyScalar(bottomRadius);
    const shade = 0.78 + (segment % 5) * 0.035;
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
    const top = segment * 2;
    const bottom = top + 1;
    const nextTop = next * 2;
    const nextBottom = nextTop + 1;

    indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
  }

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
        <meshStandardMaterial
          vertexColors
          roughness={0.95}
          metalness={0}
          flatShading
        />
      </mesh>
      <mesh
        geometry={cliffGeometry}
        castShadow
        receiveShadow
        renderOrder={1}
      >
        <meshStandardMaterial
          vertexColors
          roughness={1}
          metalness={0}
          flatShading
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
          <meshStandardMaterial
            color={biome.path}
            roughness={1}
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
          Math.abs(movementVelocityRef.current) / 1.05,
          0,
          1,
        )
      : 0;
  });

  return (
    <mesh renderOrder={1} receiveShadow>
      <sphereGeometry args={[OCEAN_SURFACE_RADIUS, 128, 64]} />
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
              0.88 + fresnel * 0.08
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
  const segments = 120;
  const oceanHeight = OCEAN_SURFACE_RADIUS - PLANET_RADIUS;

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    let shoreDistance = biome.angularRadius * 0.66;

    for (let sample = 0; sample <= 36; sample += 1) {
      const distance =
        biome.angularRadius * (0.66 + (sample / 36) * 0.34);
      const direction = directionForPolarOffset(
        biome.center,
        distance,
        angle,
      );

      if (biomeHeightAt(direction, biome) > oceanHeight + 0.008) {
        shoreDistance = distance;
      } else {
        break;
      }
    }

    const ripple =
      Math.sin(segment * 1.91 + biome.seed) *
      biome.angularRadius *
      0.004;

    for (const offset of [-0.006, 0.006]) {
      const direction = directionForPolarOffset(
        biome.center,
        shoreDistance + ripple + offset,
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
    const inner = segment * 2;
    const outer = inner + 1;
    const nextInner = next * 2;
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
  const geometry = useMemo(
    () => createCoastlineFoamGeometry(biome),
    [biome],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={4}>
      <meshBasicMaterial
        color="#effaf0"
        transparent
        opacity={0.58}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
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
    case "suncoast":
      return "palm";
    case "highlands":
      return "conifer";
    case "garden":
      return "blossom";
    default:
      return "broadleaf";
  }
}

function createVegetation() {
  return BIOMES.flatMap((biome) => {
    const random = createSeededRandom(biome.seed * 101);
    const plants: VegetationDefinition[] = [];
    const count = biome.id === "garden" ? 26 : 22;

    for (let index = 0; index < count; index += 1) {
      let direction = biome.center;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const distance =
          (0.18 + Math.pow(random(), 0.72) * 0.68) *
          biome.angularRadius;
        const angle = random() * Math.PI * 2;
        const candidate = directionForPolarOffset(
          biome.center,
          distance,
          angle,
        );
        const farFromPlaces = Array.from(PLACE_DIRECTIONS.values()).every(
          (placeDirection) =>
            angularDistance(candidate, placeDirection) > 0.075,
        );

        if (!isWaterDirection(candidate) && farFromPlaces) {
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
        <mesh position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.027, 0.042, 0.34, 6]} />
          <meshStandardMaterial color="#8a6344" flatShading />
        </mesh>
        {[0, 1, 2, 3, 4].map((leaf) => (
          <mesh
            key={leaf}
            position={[0, 0.36, 0]}
            rotation={[
              0.15,
              (leaf / 5) * Math.PI * 2,
              Math.PI / 2.9,
            ]}
            castShadow
          >
            <coneGeometry args={[0.065, 0.25, 4]} />
            <meshStandardMaterial color="#43856b" flatShading />
          </mesh>
        ))}
      </>
    );
  }

  if (style === "conifer") {
    return (
      <>
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.024, 0.04, 0.26, 6]} />
          <meshStandardMaterial color="#74543f" flatShading />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <coneGeometry args={[0.14, 0.4, 7]} />
          <meshStandardMaterial color="#3e6f5e" flatShading />
        </mesh>
        <mesh position={[0, 0.43, 0]} castShadow>
          <coneGeometry args={[0.105, 0.3, 7]} />
          <meshStandardMaterial color="#527d68" flatShading />
        </mesh>
      </>
    );
  }

  const blossom = style === "blossom";

  return (
    <>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.044, 0.28, 6]} />
        <meshStandardMaterial color="#785644" flatShading />
      </mesh>
      <mesh position={[0, 0.34, 0]} scale={[1.15, 0.82, 1]} castShadow>
        <dodecahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color={blossom ? "#e9a7ad" : "#5d966b"}
          flatShading
        />
      </mesh>
      <mesh
        position={[0.09, 0.38, -0.03]}
        scale={[0.75, 0.65, 0.72]}
        castShadow
      >
        <dodecahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial
          color={blossom ? "#f1c2bd" : "#78a66c"}
          flatShading
        />
      </mesh>
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

    for (let index = 0; index < 5; index += 1) {
      const direction = directionForPolarOffset(
        biome.center,
        biome.angularRadius * (0.22 + random() * 0.55),
        random() * Math.PI * 2,
      );

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
          biome.id === "garden"
            ? "#8e817a"
            : biome.id === "suncoast"
              ? "#a77e57"
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
          <meshStandardMaterial
            color={prop.color}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function LandmarkTerrain() {
  const highlands = BIOME_BY_ID.get("highlands")!;
  const garden = BIOME_BY_ID.get("garden")!;
  const suncoast = BIOME_BY_ID.get("suncoast")!;
  const mountainDirections = [
    directionFromOffset(highlands.center, 0.2, 0.2),
    directionFromOffset(highlands.center, 0.27, 0.11),
    directionFromOffset(highlands.center, 0.13, 0.27),
  ];
  const beachDirection = directionFromOffset(
    suncoast.center,
    0.26,
    -0.05,
  );
  const gardenHill = directionFromOffset(garden.center, 0.23, -0.2);

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
            <coneGeometry args={[0.32 - index * 0.03, 0.65 + index * 0.15, 7]} />
            <meshStandardMaterial
              color={index === 1 ? "#7d766b" : "#8c816d"}
              roughness={1}
              flatShading
            />
          </mesh>
          <mesh
            position={[0, 0.55 + index * 0.08, 0]}
            rotation={[0, index * 0.8, 0]}
          >
            <coneGeometry args={[0.13, 0.25, 7]} />
            <meshStandardMaterial color="#e8ded0" flatShading />
          </mesh>
        </group>
      ))}

      <group
        position={beachDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(beachDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, beachDirection)}
      >
        <mesh position={[0, 0.025, 0]} receiveShadow>
          <cylinderGeometry args={[0.32, 0.38, 0.05, 12]} />
          <meshStandardMaterial color="#e4c47e" flatShading />
        </mesh>
        <mesh position={[0.12, 0.12, -0.04]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.24, 0.025, 0.13]} />
          <meshStandardMaterial color="#db6956" />
        </mesh>
      </group>

      <group
        position={gardenHill
          .clone()
          .multiplyScalar(surfaceRadiusAt(gardenHill))}
        quaternion={new Quaternion().setFromUnitVectors(UP, gardenHill)}
      >
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.25, 0.24, 8]} />
          <meshStandardMaterial color="#657965" flatShading />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <torusGeometry args={[0.13, 0.025, 5, 10, Math.PI]} />
          <meshStandardMaterial color="#d45248" flatShading />
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
