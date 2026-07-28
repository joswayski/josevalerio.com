import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  LinearFilter,
  MathUtils,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  type Sprite as ThreeSprite,
  type SpriteMaterial,
  type Group,
  type InstancedMesh,
  type Mesh,
} from "three";
import {
  BIOMES,
  BIOME_BY_ID,
  OCEAN_FLOOR_RADIUS,
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
  oceanShoreProximityAt,
  surfaceRadiusAt,
  tangentBasis,
  traversalSurfaceRadiusAt,
  waterSurfaceRadius,
  type BiomeDefinition,
  type BiomeKind,
  type WaterFeature,
} from "../data/planetoid";
import {
  BlenderAsset,
  type PlacesAssetName,
} from "./BlenderAsset";
import {
  NatureAsset,
  type NatureAssetName,
} from "./NatureAsset";

type SkyPhase = "day" | "twilight" | "night";

type PlanetoidWorldProps = {
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  traversalModeRef: MutableRefObject<"boat" | "land" | "swim">;
  waterSurfaceRef: MutableRefObject<OceanSurfaceApi | null>;
  loosePropInteractionRef: MutableRefObject<
    LoosePropInteractionApi | null
  >;
  onLoosePropImpact: (strength: number, variation: number) => void;
  onLoosePropSplash: (strength: number, variation: number) => void;
  onVegetationBrush: (
    strength: number,
    kind: VegetationKind,
    variation: number,
  ) => void;
  exploreMode: boolean;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
};

export type OceanSurfaceApi = {
  sampleRadius: (direction: Vector3) => number;
  sampleNormal: (
    direction: Vector3,
    forward: Vector3,
    target: Vector3,
  ) => Vector3;
  disturb: (
    direction: Vector3,
    strength: number,
    angularRadius?: number,
  ) => void;
};

export type LoosePropInteractionApi = {
  beginInteraction: () => boolean;
  endInteraction: () => boolean;
  cancelInteraction: () => boolean;
};

type VegetationKind = "bush" | "tree";

type VegetationDefinition = {
  id: string;
  biomeId: BiomeKind;
  direction: Vector3;
  position: Vector3;
  orientation: Quaternion;
  windAxis: Vector3;
  scale: number;
  rotation: number;
  phase: number;
  kind: VegetationKind;
  touching: boolean;
  style:
    | "blossom"
    | "broadleaf"
    | "conifer"
    | "cypress"
    | "palm"
    | "pine";
};

type SurfaceDetailDefinition = {
  id: string;
  kind: "grass" | "rock";
  position: Vector3;
  orientation: Quaternion;
  rotation: number;
  scale: Vector3;
  variant: number;
};

type LoosePropState = {
  id: string;
  spawnDirection: Vector3;
  direction: Vector3;
  tangentVelocity: Vector3;
  worldPosition: Vector3;
  linearVelocity: Vector3;
  orientation: Quaternion;
  scale: number;
  color: string;
  accentColor: string;
  contactCooldown: number;
  motion: "airborne" | "ground" | "held" | "sinking";
  charge: number;
  sinkElapsed: number;
  splashElapsed: number;
};

type LoosePropInteractionPhase = "idle" | "carrying" | "charging";
type LoosePropPromptKind = "pickup" | "carrying" | "charging";

type FishDefinition = {
  id: string;
  kind: "fish" | "shark" | "dolphin";
  direction: Vector3;
  orbitAxis: Vector3;
  phase: number;
  speed: number;
  bobPhase: number;
  scale: number;
  color: string;
  reactsToTraveler: boolean;
};

type BirdDefinition = {
  id: string;
  direction: Vector3;
  orbitAxis: Vector3;
  phase: number;
  speed: number;
  altitude: number;
  scale: number;
  color: string;
  cycleDuration: number;
  activeDuration: number;
  cycleOffset: number;
};

const UP = new Vector3(0, 1, 0);
const TERRAIN_SEGMENTS = 144;
const TERRAIN_RINGS = 56;
const TERRAIN_SHELF_RINGS = 14;
const TERRAIN_TOTAL_RINGS = TERRAIN_RINGS + TERRAIN_SHELF_RINGS;
const TERRAIN_SHELF_EXTENT = 0.14;
const TREE_INTERACTION_ANGLE = 0.052;
const BUSH_INTERACTION_ANGLE = 0.088;
const FISH_SCURRY_ENTER_ANGLE = 0.115;
const FISH_SCURRY_EXIT_ANGLE = 0.18;
const FISH_SHORE_AVOIDANCE = 0.48;
const FISH_KAYAK_AVOID_ANGLE = 0.23;
const LOOSE_PROP_INTERACTION_ANGLE = 0.145;
const LOOSE_PROP_PROMPT_ANGLE = LOOSE_PROP_INTERACTION_ANGLE;
const LOOSE_PROP_CHARGE_SECONDS = 1.25;
const LOOSE_PROP_GRAVITY = 6.8;
const LOOSE_PROP_TRAJECTORY_POINTS = 15;
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

function createLoosePropPromptTexture(
  title: string,
  detail?: string,
) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = detail ? 240 : 176;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const inset = 10;
  const radius = 34;
  context.beginPath();
  context.roundRect(
    inset,
    inset,
    canvas.width - inset * 2,
    canvas.height - inset * 2,
    radius,
  );
  context.fillStyle = "rgba(7, 14, 24, 0.9)";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "#ffd65c";
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fffdf6";
  context.font = '700 62px "Space Mono", monospace';
  context.fillText(
    title,
    canvas.width / 2,
    detail ? 88 : canvas.height / 2,
  );

  if (detail) {
    context.fillStyle = "#c9d6df";
    context.font = '700 35px "Space Mono", monospace';
    context.fillText(detail, canvas.width / 2, 166);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function angularDistance(a: Vector3, b: Vector3) {
  return Math.acos(
    MathUtils.clamp(a.dot(b) / (a.length() * b.length()), -1, 1),
  );
}

function isOccludedBySphere(
  worldPosition: Vector3,
  cameraPosition: Vector3,
  radius: number,
  ray: Vector3,
  closestPoint: Vector3,
) {
  ray.copy(worldPosition).sub(cameraPosition);
  const rayLengthSq = ray.lengthSq();

  if (rayLengthSq < 0.000001) {
    return false;
  }

  const closestProgress = MathUtils.clamp(
    -cameraPosition.dot(ray) / rayLengthSq,
    0,
    1,
  );

  if (closestProgress <= 0 || closestProgress >= 1) {
    return false;
  }

  closestPoint
    .copy(cameraPosition)
    .addScaledVector(ray, closestProgress);

  return closestPoint.lengthSq() < radius * radius;
}

function HorizonOccludedGroup({
  position,
  quaternion,
  revealHeight = 0.08,
  children,
}: {
  position: Vector3;
  quaternion: Quaternion;
  revealHeight?: number;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  const probeRef = useRef(new Vector3());
  const normalRef = useRef(position.clone().normalize());
  const rayRef = useRef(new Vector3());
  const closestPointRef = useRef(new Vector3());

  useFrame(({ camera }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const probe = probeRef.current
      .copy(position)
      .addScaledVector(normalRef.current, revealHeight);

    group.visible = !isOccludedBySphere(
      probe,
      camera.position,
      OCEAN_SURFACE_RADIUS + 0.025,
      rayRef.current,
      closestPointRef.current,
    );
  });

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      {children}
    </group>
  );
}

function createTerrainChunkGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const colors: number[] = [];
  const causticVisibility: number[] = [];
  const indices: number[] = [];
  const ground = new Color(biome.ground);
  const groundDark = new Color(biome.groundDark);
  const shore = new Color(biome.shore);
  const cliff = new Color(biome.cliff);
  const cliffDark = cliff.clone().multiplyScalar(0.62);
  const seabed = new Color("#155263");
  const highlight = new Color("#c9ce83");
  biome.parts.forEach((part, partIndex) => {
    const vertexOffset = positions.length / 3;

    for (let ring = 0; ring <= TERRAIN_TOTAL_RINGS; ring += 1) {
      const shelfProgress = MathUtils.clamp(
        (ring - TERRAIN_RINGS) / TERRAIN_SHELF_RINGS,
        0,
        1,
      );
      const isShelf = ring > TERRAIN_RINGS;
      const ringProgress = isShelf
        ? 1 + shelfProgress * TERRAIN_SHELF_EXTENT
        : ring / TERRAIN_RINGS;

      for (let segment = 0; segment < TERRAIN_SEGMENTS; segment += 1) {
        const angle =
          (segment / TERRAIN_SEGMENTS) * Math.PI * 2;
        const edgeJitter =
          ring >= TERRAIN_RINGS
            ? Math.sin(
                segment * 2.17 + biome.seed + partIndex,
              ) * 0.006
            : 0;
        const direction = islandPartDirection(
          biome,
          part,
          Math.max(0, ringProgress + edgeJitter),
          angle,
        );
        const height = biomeHeightAt(direction, biome);
        const landRadius = surfaceRadiusAt(direction) + 0.006;
        const shelfFalloff = Math.pow(shelfProgress, 1.65);
        const radius = isShelf
          ? MathUtils.lerp(
              landRadius,
              OCEAN_FLOOR_RADIUS + 0.015,
              shelfFalloff,
            )
          : landRadius;
        const position = direction.clone().multiplyScalar(radius);
        const heightMix = MathUtils.clamp(
          height / (biome.baseHeight + biome.peakHeight * 0.7),
          0,
          1,
        );
        const coastMix = MathUtils.smoothstep(
          ringProgress,
          0.76,
          1,
        );
        const color = isShelf
          ? shore
              .clone()
              .lerp(
                cliff,
                MathUtils.smoothstep(shelfProgress, 0.18, 0.72),
              )
              .lerp(
                cliffDark,
                MathUtils.smoothstep(shelfProgress, 0.24, 0.52),
              )
              .lerp(
                seabed,
                MathUtils.smoothstep(shelfProgress, 0.3, 0.72),
              )
          : groundDark
              .clone()
              .lerp(ground, 0.48 + heightMix * 0.46)
              .lerp(shore, coastMix * 0.82)
              .lerp(
                highlight,
                biome.id === "turkiye" ||
                  biome.id === "south-korea"
                  ? Math.max(0, heightMix - 0.64) * 0.62
                  : Math.max(0, heightMix - 0.8) * 0.28,
              );

        const broadVariation =
          Math.sin(
            direction.x * 9.7 +
              direction.y * 7.1 +
              direction.z * 11.3 +
              biome.seed * 0.31,
          ) *
            0.5 +
          0.5;
        const detailVariation =
          Math.sin(
            direction.x * 19.1 -
              direction.y * 15.7 +
              direction.z * 17.9 +
              biome.seed * 0.73,
          ) *
            0.5 +
          0.5;

        color.multiplyScalar(
          0.94 +
            broadVariation * 0.075 +
            detailVariation * 0.025 +
            partIndex * 0.006,
        );

        positions.push(position.x, position.y, position.z);
        colors.push(color.r, color.g, color.b);
        causticVisibility.push(
          isShelf
            ? MathUtils.smoothstep(shelfProgress, 0.04, 0.2) *
                (1 -
                  MathUtils.smoothstep(
                    shelfProgress,
                    0.58,
                    0.98,
                  ))
            : 0,
        );
      }
    }

    for (let ring = 0; ring < TERRAIN_TOTAL_RINGS; ring += 1) {
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
  geometry.setAttribute(
    "causticVisibility",
    new Float32BufferAttribute(causticVisibility, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function TerrainChunk({
  biome,
  reduceMotion,
  skyPhase,
  solarDirection,
}: {
  biome: BiomeDefinition;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
}) {
  const terrainGeometry = useMemo(
    () => createTerrainChunkGeometry(biome),
    [biome],
  );
  const causticUniforms = useMemo(
    () => ({
      time: { value: 0 },
      motion: { value: reduceMotion ? 0.18 : 1 },
      causticColor: {
        value: new Color(
          skyPhase === "night"
            ? "#3c8295"
            : skyPhase === "twilight"
              ? "#d2d6af"
              : "#bdebd7",
        ),
      },
      sunDirection: {
        value: new Vector3(...solarDirection).normalize(),
      },
    }),
    [reduceMotion, skyPhase, solarDirection],
  );

  useEffect(
    () => () => {
      terrainGeometry.dispose();
    },
    [terrainGeometry],
  );

  useFrame(({ clock }) => {
    causticUniforms.time.value = clock.elapsedTime;
    causticUniforms.motion.value = reduceMotion ? 0.18 : 1;
    causticUniforms.sunDirection.value
      .set(...solarDirection)
      .normalize();
  });

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
          roughness={0.86}
          metalness={0}
        />
      </mesh>
      <mesh
        geometry={terrainGeometry}
        renderOrder={3}
      >
        <shaderMaterial
          uniforms={causticUniforms}
          vertexShader={`
            attribute float causticVisibility;
            varying float vCausticVisibility;
            varying vec3 vWorldPosition;

            void main() {
              vec4 worldPosition =
                modelMatrix * vec4(position, 1.0);

              vCausticVisibility = causticVisibility;
              vWorldPosition = worldPosition.xyz;
              gl_Position =
                projectionMatrix *
                viewMatrix *
                worldPosition;
            }
          `}
          fragmentShader={`
            uniform float time;
            uniform float motion;
            uniform vec3 causticColor;
            uniform vec3 sunDirection;
            varying float vCausticVisibility;
            varying vec3 vWorldPosition;

            void main() {
              vec3 samplePosition = vWorldPosition * 5.2;
              float phase = time * motion;
              float fieldA =
                sin(
                  samplePosition.x +
                  samplePosition.z * 0.82 +
                  phase * 0.72
                ) +
                sin(
                  samplePosition.y * 1.16 -
                  samplePosition.x * 0.74 -
                  phase * 0.51
                );
              float fieldB =
                sin(
                  samplePosition.z * 1.24 -
                  samplePosition.y * 0.9 -
                  phase * 0.61
                ) +
                sin(
                  samplePosition.x * 0.68 +
                  samplePosition.y * 1.06 +
                  phase * 0.43
                );
              float ribbons = 1.0 - smoothstep(
                0.08,
                0.48,
                abs(fieldA - fieldB)
              );
              ribbons = pow(ribbons, 2.4);
              float daylight = 0.34 + 0.66 * max(
                dot(
                  normalize(vWorldPosition),
                  normalize(sunDirection)
                ),
                0.0
              );
              float alpha =
                vCausticVisibility *
                ribbons *
                daylight *
                0.11;

              if (alpha < 0.012) {
                discard;
              }

              gl_FragColor = vec4(causticColor, alpha);
            }
          `}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          polygonOffset
          polygonOffsetFactor={-2}
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
  const rings = 48;
  const segments = 128;

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

const OCEAN_SEGMENTS = 192;
const OCEAN_RINGS = 96;
const OCEAN_VERTEX_STRIDE = OCEAN_SEGMENTS + 1;
const OCEAN_SIMULATION_STEP = 1 / 45;

function oceanGridCoordinates(direction: Vector3) {
  const normalized = direction.clone().normalize();
  const phi = Math.atan2(normalized.z, -normalized.x);
  const wrappedPhi = phi < 0 ? phi + Math.PI * 2 : phi;

  return {
    x: (wrappedPhi / (Math.PI * 2)) * OCEAN_SEGMENTS,
    y:
      (Math.acos(MathUtils.clamp(normalized.y, -1, 1)) / Math.PI) *
      OCEAN_RINGS,
  };
}

function oceanGridIndex(x: number, y: number) {
  const wrappedX =
    ((x % OCEAN_SEGMENTS) + OCEAN_SEGMENTS) % OCEAN_SEGMENTS;
  const clampedY = MathUtils.clamp(y, 0, OCEAN_RINGS);

  return clampedY * OCEAN_VERTEX_STRIDE + wrappedX;
}

function ambientOceanHeight(
  direction: Vector3,
  elapsedTime: number,
  motion: number,
  openWater: number,
) {
  if (motion === 0) {
    return 0;
  }

  const swell =
    Math.sin(
      direction.x * 8.6 +
        direction.z * 4.4 +
        elapsedTime * 0.58,
    ) *
      0.035 +
    Math.sin(
      direction.y * 11.2 -
        direction.x * 5.4 -
        elapsedTime * 0.46,
    ) *
      0.024;
  const crossingWave =
    Math.sin(
      (direction.x + direction.y) * 18 +
        elapsedTime * 0.74,
    ) *
      0.012 +
    Math.sin(
      (direction.z - direction.x) * 24 -
        elapsedTime * 0.69,
    ) *
      0.008;
  const windRipple =
    Math.sin(
      direction.x * 34 +
        direction.z * 19 -
        direction.y * 8 +
        elapsedTime * 1.12,
    ) * 0.004;

  return (swell + crossingWave + windRipple) * openWater * motion;
}

function shorelineOceanHeight(
  direction: Vector3,
  elapsedTime: number,
  motion: number,
  shoreProximity: number,
) {
  if (motion === 0 || shoreProximity < 0.08) {
    return 0;
  }

  const shoreMask = MathUtils.smoothstep(shoreProximity, 0.08, 0.88);
  const advancingWave = Math.sin(
    elapsedTime * 1.22 -
      shoreProximity * 13.5 +
      direction.x * 5.3 +
      direction.z * 3.7,
  );
  const secondaryWave = Math.sin(
    elapsedTime * 0.72 -
      shoreProximity * 8.2 -
      direction.y * 4.1,
  );

  return (
    (advancingWave * 0.014 + secondaryWave * 0.006) *
    shoreMask *
    motion
  );
}

function createOceanSurfaceGeometry() {
  const geometry = new SphereGeometry(
    OCEAN_SURFACE_RADIUS,
    OCEAN_SEGMENTS,
    OCEAN_RINGS,
  );
  const positionAttribute = geometry.getAttribute(
    "position",
  ) as Float32BufferAttribute;
  const shoreProximity = new Float32Array(positionAttribute.count);
  const waveEnergy = new Float32Array(positionAttribute.count);
  const direction = new Vector3();

  positionAttribute.setUsage(DynamicDrawUsage);

  for (let vertex = 0; vertex < positionAttribute.count; vertex += 1) {
    direction
      .set(
        positionAttribute.getX(vertex),
        positionAttribute.getY(vertex),
        positionAttribute.getZ(vertex),
      )
      .normalize();
    shoreProximity[vertex] = oceanShoreProximityAt(direction);
  }

  geometry.setAttribute(
    "shoreProximity",
    new Float32BufferAttribute(shoreProximity, 1),
  );
  const waveEnergyAttribute = new Float32BufferAttribute(waveEnergy, 1);
  waveEnergyAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("waveEnergy", waveEnergyAttribute);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  if (geometry.boundingSphere) {
    geometry.boundingSphere.radius = OCEAN_SURFACE_RADIUS + 0.32;
  }

  return geometry;
}

function OceanSurface({
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  traversalModeRef,
  waterSurfaceRef,
  exploreMode,
  reduceMotion,
  skyPhase,
  solarDirection,
}: Omit<
  PlanetoidWorldProps,
  | "loosePropInteractionRef"
  | "onLoosePropImpact"
  | "onLoosePropSplash"
  | "onVegetationBrush"
>) {
  const geometry = useMemo(createOceanSurfaceGeometry, []);
  const simulation = useMemo(() => {
    const positionAttribute = geometry.getAttribute(
      "position",
    ) as Float32BufferAttribute;
    const directions = new Float32Array(positionAttribute.count * 3);

    for (let vertex = 0; vertex < positionAttribute.count; vertex += 1) {
      const offset = vertex * 3;
      const x = positionAttribute.getX(vertex);
      const y = positionAttribute.getY(vertex);
      const z = positionAttribute.getZ(vertex);
      const inverseLength = 1 / Math.hypot(x, y, z);
      directions[offset] = x * inverseLength;
      directions[offset + 1] = y * inverseLength;
      directions[offset + 2] = z * inverseLength;
    }

    return {
      directions,
      heights: new Float32Array(positionAttribute.count),
      velocities: new Float32Array(positionAttribute.count),
      nextVelocities: new Float32Array(positionAttribute.count),
      accumulatedTime: 0,
      elapsedTime: 0,
      disturbanceAccumulator: 0,
    };
  }, [geometry]);
  const uniforms = useMemo(
    () => ({
      deepColor: {
        value:
          skyPhase === "night"
            ? new Color("#041a2e")
            : skyPhase === "twilight"
              ? new Color("#174e62")
              : new Color("#064d63"),
      },
      shallowColor: {
        value:
          skyPhase === "night"
            ? new Color("#1d5c70")
            : skyPhase === "twilight"
              ? new Color("#438a93")
              : new Color("#2895a5"),
      },
      foamColor: {
        value:
          skyPhase === "night"
            ? new Color("#b5d4e2")
            : new Color("#edf8ff"),
      },
      horizonColor: {
        value: new Color(
          skyPhase === "night"
            ? "#31435f"
            : skyPhase === "twilight"
              ? "#b97f73"
              : "#a9cbd3",
        ),
      },
      zenithColor: {
        value: new Color(
          skyPhase === "night"
            ? "#071127"
            : skyPhase === "twilight"
              ? "#41465f"
              : "#4c7e9d",
        ),
      },
      sunDirection: {
        value: new Vector3(...solarDirection).normalize(),
      },
      time: { value: 0 },
      floorRadius: {
        value: OCEAN_FLOOR_RADIUS + 0.025,
      },
      surfaceRadius: {
        value: OCEAN_SURFACE_RADIUS,
      },
    }),
    [skyPhase, solarDirection],
  );
  const wakeDirectionRef = useRef(new Vector3());
  const wakeSideRef = useRef(new Vector3());
  const wakeLeftRef = useRef(new Vector3());
  const wakeRightRef = useRef(new Vector3());

  const sampleDynamicHeight = (direction: Vector3) => {
    const coordinates = oceanGridCoordinates(direction);
    const x0 = Math.floor(coordinates.x) % OCEAN_SEGMENTS;
    const x1 = (x0 + 1) % OCEAN_SEGMENTS;
    const y0 = MathUtils.clamp(
      Math.floor(coordinates.y),
      0,
      OCEAN_RINGS,
    );
    const y1 = Math.min(OCEAN_RINGS, y0 + 1);
    const xBlend = coordinates.x - Math.floor(coordinates.x);
    const yBlend = coordinates.y - Math.floor(coordinates.y);
    const top = MathUtils.lerp(
      simulation.heights[oceanGridIndex(x0, y0)],
      simulation.heights[oceanGridIndex(x1, y0)],
      xBlend,
    );
    const bottom = MathUtils.lerp(
      simulation.heights[oceanGridIndex(x0, y1)],
      simulation.heights[oceanGridIndex(x1, y1)],
      xBlend,
    );

    return MathUtils.lerp(top, bottom, yBlend);
  };

  const sampleRadius = (direction: Vector3) => {
    const normalized = direction.clone().normalize();
    const shoreProximity = oceanShoreProximityAt(normalized);
    const openWater = MathUtils.lerp(
      1,
      0.1,
      shoreProximity,
    );
    const ambientHeight = ambientOceanHeight(
      normalized,
      simulation.elapsedTime,
      reduceMotion ? 0 : 1,
      openWater,
    ) +
      shorelineOceanHeight(
        normalized,
        simulation.elapsedTime,
        reduceMotion ? 0 : 1,
        shoreProximity,
      );
    const simulatedHeight =
      sampleDynamicHeight(normalized) * openWater;

    return (
      OCEAN_SURFACE_RADIUS +
      MathUtils.clamp(ambientHeight + simulatedHeight, -0.16, 0.2)
    );
  };

  const disturb = (
    direction: Vector3,
    strength: number,
    angularRadius = 0.055,
  ) => {
    const normalized = direction.clone().normalize();
    const coordinates = oceanGridCoordinates(normalized);
    const latitude = Math.acos(
      MathUtils.clamp(normalized.y, -1, 1),
    );
    const verticalRange =
      Math.ceil((angularRadius / Math.PI) * OCEAN_RINGS) + 1;
    const horizontalRange =
      Math.ceil(
        (angularRadius /
          (Math.PI * 2 * Math.max(0.16, Math.sin(latitude)))) *
          OCEAN_SEGMENTS,
      ) + 1;
    const centerX = Math.round(coordinates.x);
    const centerY = Math.round(coordinates.y);

    for (
      let y = Math.max(1, centerY - verticalRange);
      y <= Math.min(OCEAN_RINGS - 1, centerY + verticalRange);
      y += 1
    ) {
      for (
        let x = centerX - horizontalRange;
        x <= centerX + horizontalRange;
        x += 1
      ) {
        const index = oceanGridIndex(x, y);
        const offset = index * 3;
        const dot = MathUtils.clamp(
          normalized.x * simulation.directions[offset] +
            normalized.y * simulation.directions[offset + 1] +
            normalized.z * simulation.directions[offset + 2],
          -1,
          1,
        );
        const distance = Math.acos(dot);

        if (distance >= angularRadius) {
          continue;
        }

        const progress = 1 - distance / angularRadius;
        const falloff = progress * progress * (3 - 2 * progress);
        simulation.velocities[index] += strength * falloff;
      }
    }
  };

  const sampleNormal = (
    direction: Vector3,
    forward: Vector3,
    target: Vector3,
  ) => {
    const up = direction.clone().normalize();
    const tangentForward = forward
      .clone()
      .addScaledVector(up, -forward.dot(up));

    if (tangentForward.lengthSq() < 0.0001) {
      tangentForward.copy(tangentBasis(up).north);
    } else {
      tangentForward.normalize();
    }

    const tangentRight = new Vector3()
      .crossVectors(tangentForward, up)
      .normalize();
    const sampleAngle = 0.012;
    const cosine = Math.cos(sampleAngle);
    const sine = Math.sin(sampleAngle);
    const aheadDirection = up
      .clone()
      .multiplyScalar(cosine)
      .addScaledVector(tangentForward, sine)
      .normalize();
    const rightDirection = up
      .clone()
      .multiplyScalar(cosine)
      .addScaledVector(tangentRight, sine)
      .normalize();
    const center = up.multiplyScalar(sampleRadius(up));
    const ahead = aheadDirection.multiplyScalar(
      sampleRadius(aheadDirection),
    );
    const right = rightDirection.multiplyScalar(
      sampleRadius(rightDirection),
    );

    target
      .crossVectors(
        right.sub(center),
        ahead.sub(center),
      )
      .normalize();

    if (target.dot(direction) < 0) {
      target.multiplyScalar(-1);
    }

    return target;
  };

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const api: OceanSurfaceApi = {
      sampleRadius,
      sampleNormal,
      disturb,
    };
    waterSurfaceRef.current = api;

    return () => {
      if (waterSurfaceRef.current === api) {
        waterSurfaceRef.current = null;
      }
    };
  });

  useFrame(({ clock }, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    const travelerDirection = travelerDirectionRef.current;
    const oceanTravel =
      exploreMode && isOceanDirection(travelerDirection);
    const movementBlend = MathUtils.clamp(
      Math.abs(movementVelocityRef.current) /
        MAX_OCEAN_TRAVEL_SPEED,
      0,
      1,
    );
    simulation.elapsedTime = clock.elapsedTime;
    simulation.disturbanceAccumulator += frameDelta;
    uniforms.time.value = clock.elapsedTime;
    uniforms.sunDirection.value
      .set(...solarDirection)
      .normalize();

    if (
      oceanTravel &&
      movementBlend > 0.035 &&
      simulation.disturbanceAccumulator >=
        (traversalModeRef.current === "boat" ? 0.07 : 0.11)
    ) {
      simulation.disturbanceAccumulator = 0;
      const travelerForward = travelerForwardRef.current;
      const behindAngle =
        traversalModeRef.current === "boat" ? 0.028 : 0.018;
      const sideAngle =
        traversalModeRef.current === "boat" ? 0.026 : 0.016;
      const cosine = Math.cos(behindAngle);
      const sine = Math.sin(behindAngle);
      const sideCosine = Math.cos(sideAngle);
      const sideSine = Math.sin(sideAngle);
      const wakeDirection = wakeDirectionRef.current
        .copy(travelerDirection)
        .multiplyScalar(cosine)
        .addScaledVector(travelerForward, -sine)
        .normalize();
      const wakeSide = wakeSideRef.current
        .crossVectors(travelerForward, travelerDirection)
        .normalize();
      const wakeStrength =
        (traversalModeRef.current === "boat" ? -0.72 : -0.42) *
        movementBlend;

      disturb(
        wakeDirection,
        wakeStrength,
        traversalModeRef.current === "boat" ? 0.06 : 0.045,
      );
      wakeLeftRef.current
        .copy(wakeDirection)
        .multiplyScalar(sideCosine)
        .addScaledVector(wakeSide, sideSine)
        .normalize();
      wakeRightRef.current
        .copy(wakeDirection)
        .multiplyScalar(sideCosine)
        .addScaledVector(wakeSide, -sideSine)
        .normalize();
      disturb(
        wakeLeftRef.current,
        -wakeStrength * 0.42,
        0.036,
      );
      disturb(
        wakeRightRef.current,
        -wakeStrength * 0.42,
        0.036,
      );
    }

    simulation.accumulatedTime = Math.min(
      simulation.accumulatedTime + frameDelta,
      OCEAN_SIMULATION_STEP * 3,
    );

    while (simulation.accumulatedTime >= OCEAN_SIMULATION_STEP) {
      simulation.accumulatedTime -= OCEAN_SIMULATION_STEP;
      const damping = Math.exp(
        -OCEAN_SIMULATION_STEP * (reduceMotion ? 4.6 : 1.35),
      );
      const propagation = reduceMotion ? 21 : 42;

      for (let y = 1; y < OCEAN_RINGS; y += 1) {
        for (let x = 0; x < OCEAN_SEGMENTS; x += 1) {
          const index = oceanGridIndex(x, y);
          const left = oceanGridIndex(x - 1, y);
          const right = oceanGridIndex(x + 1, y);
          const above = oceanGridIndex(x, y - 1);
          const below = oceanGridIndex(x, y + 1);
          const height = simulation.heights[index];
          const laplacian =
            simulation.heights[left] +
            simulation.heights[right] +
            simulation.heights[above] +
            simulation.heights[below] -
            height * 4;
          const acceleration =
            laplacian * propagation - height * 1.8;

          simulation.nextVelocities[index] =
            (simulation.velocities[index] +
              acceleration * OCEAN_SIMULATION_STEP) *
            damping;
        }
      }

      for (let y = 1; y < OCEAN_RINGS; y += 1) {
        for (let x = 0; x < OCEAN_SEGMENTS; x += 1) {
          const index = oceanGridIndex(x, y);
          const seamIndex = y * OCEAN_VERTEX_STRIDE + OCEAN_SEGMENTS;

          simulation.velocities[index] =
            simulation.nextVelocities[index];
          simulation.heights[index] = MathUtils.clamp(
            simulation.heights[index] +
              simulation.velocities[index] * OCEAN_SIMULATION_STEP,
            -0.16,
            0.2,
          );

          if (x === 0) {
            simulation.velocities[seamIndex] =
              simulation.velocities[index];
            simulation.heights[seamIndex] =
              simulation.heights[index];
          }
        }
      }
    }

    const positionAttribute = geometry.getAttribute(
      "position",
    ) as Float32BufferAttribute;
    const positionArray = positionAttribute.array as Float32Array;
    const shoreAttribute = geometry.getAttribute(
      "shoreProximity",
    ) as Float32BufferAttribute;
    const energyAttribute = geometry.getAttribute(
      "waveEnergy",
    ) as Float32BufferAttribute;
    const energyArray = energyAttribute.array as Float32Array;

    for (let vertex = 0; vertex < positionAttribute.count; vertex += 1) {
      const offset = vertex * 3;
      const directionX = simulation.directions[offset];
      const directionY = simulation.directions[offset + 1];
      const directionZ = simulation.directions[offset + 2];
      const direction = wakeDirectionRef.current.set(
        directionX,
        directionY,
        directionZ,
      );
      const shoreProximity = shoreAttribute.getX(vertex);
      const openWater = MathUtils.lerp(
        1,
        0.1,
        shoreProximity,
      );
      const ambientHeight =
        ambientOceanHeight(
          direction,
          simulation.elapsedTime,
          reduceMotion ? 0 : 1,
          openWater,
        ) +
        shorelineOceanHeight(
          direction,
          simulation.elapsedTime,
          reduceMotion ? 0 : 1,
          shoreProximity,
        );
      const simulatedHeight =
        simulation.heights[vertex] * openWater;
      const ambientCrest = MathUtils.smoothstep(
        ambientHeight,
        0.045,
        0.09,
      );
      const chopAmount =
        reduceMotion
          ? 0
          : (Math.cos(
                directionX * 8.6 +
                  directionZ * 4.4 +
                  simulation.elapsedTime * 0.58,
              ) *
                0.026 +
              Math.cos(
                (directionX + directionY) * 18 +
                  simulation.elapsedTime * 0.74,
              ) *
                0.014) *
            openWater;
      const chopTangent = wakeSideRef.current.set(
        directionZ,
        0,
        -directionX,
      );

      if (chopTangent.lengthSq() < 0.0001) {
        chopTangent.set(1, 0, 0);
      } else {
        chopTangent.normalize();
      }
      const radius =
        OCEAN_SURFACE_RADIUS +
        MathUtils.clamp(
          ambientHeight + simulatedHeight,
          -0.16,
          0.2,
        );

      positionArray[offset] =
        directionX * radius + chopTangent.x * chopAmount;
      positionArray[offset + 1] =
        directionY * radius + chopTangent.y * chopAmount;
      positionArray[offset + 2] =
        directionZ * radius + chopTangent.z * chopAmount;
      energyArray[vertex] = MathUtils.clamp(
        Math.abs(simulatedHeight) * 5.2 +
          Math.abs(simulation.velocities[vertex]) * 0.2 +
          ambientCrest * 0.5,
        0,
        1,
      );
    }

    positionAttribute.needsUpdate = true;
    energyAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.getAttribute("normal").needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={geometry} renderOrder={1} receiveShadow>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={`
            attribute float shoreProximity;
            attribute float waveEnergy;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying float vWave;
            varying float vShoreProximity;

            void main() {
              vec3 direction = normalize(position);
              vec4 worldPosition =
                modelMatrix * vec4(position, 1.0);

              vWave = waveEnergy;
              vShoreProximity = shoreProximity;
              vWorldPosition = worldPosition.xyz;
              vWorldNormal = normalize(
                mat3(modelMatrix) * normal
              );
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `}
          fragmentShader={`
            uniform vec3 deepColor;
            uniform vec3 shallowColor;
            uniform vec3 foamColor;
            uniform vec3 horizonColor;
            uniform vec3 zenithColor;
            uniform vec3 sunDirection;
            uniform float time;
            uniform float floorRadius;
            uniform float surfaceRadius;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying float vWave;
            varying float vShoreProximity;

            void main() {
              vec3 normal = normalize(vWorldNormal);
              vec3 radialNormal = normalize(vWorldPosition);
              vec3 waveTangent = normalize(cross(
                abs(radialNormal.y) < 0.92
                  ? vec3(0.0, 1.0, 0.0)
                  : vec3(1.0, 0.0, 0.0),
                radialNormal
              ));
              vec3 waveBitangent = normalize(cross(
                radialNormal,
                waveTangent
              ));
              float microWaveA = sin(
                dot(vWorldPosition, vec3(3.1, 5.4, -4.2)) +
                time * 0.82
              );
              float microWaveB = sin(
                dot(vWorldPosition, vec3(-5.7, 2.8, 4.9)) -
                time * 0.64
              );
              normal = normalize(
                normal +
                waveTangent * microWaveA * 0.026 +
                waveBitangent * microWaveB * 0.022
              );

              vec3 viewDirection = normalize(
                cameraPosition - vWorldPosition
              );
              float viewAlignment = clamp(
                dot(normal, viewDirection),
                0.0,
                1.0
              );
              float fresnel = 0.035 + 0.965 * pow(
                1.0 - viewAlignment,
                5.0
              );
              vec3 lightDirection = normalize(sunDirection);
              float directLight = max(
                dot(normal, lightDirection),
                0.0
              );
              float diffuseLight =
                0.28 + directLight * 0.72;
              float sharpGlint = pow(
                max(
                  dot(
                    reflect(-lightDirection, normal),
                    viewDirection
                  ),
                  0.0
                ),
                72.0
              );
              float broadGlint = pow(
                max(
                  dot(
                    reflect(-lightDirection, normal),
                    viewDirection
                  ),
                  0.0
                ),
                13.0
              );
              vec3 reflectedDirection = reflect(
                -viewDirection,
                normal
              );
              float reflectedHeight = clamp(
                dot(
                  reflectedDirection,
                  normalize(vWorldPosition)
                ),
                0.0,
                1.0
              );
              vec3 skyReflection = mix(
                horizonColor,
                zenithColor,
                pow(reflectedHeight, 0.55)
              );
              float surfaceNoise =
                sin(
                  dot(vWorldPosition, vec3(5.7, 3.1, 4.3)) +
                  time * 0.86
                ) *
                  0.5 +
                sin(
                  dot(vWorldPosition, vec3(-8.2, 4.6, 5.1)) -
                  time * 0.63
                ) *
                  0.32 +
                sin(
                  dot(vWorldPosition, vec3(12.7, 7.3, -6.4)) +
                  time * 1.12
                ) *
                  0.18;
              float waveResponse = smoothstep(
                0.12,
                0.88,
                vWave
              );
              float deepWater = pow(
                clamp(1.0 - vShoreProximity, 0.0, 1.0),
                0.72
              );
              float shoreBand = smoothstep(
                0.68,
                0.97,
                vShoreProximity
              );
              float shoreBreakup = smoothstep(
                -0.22,
                0.58,
                surfaceNoise
              );
              float shorelineFoam =
                shoreBand *
                shoreBreakup *
                (0.16 + waveResponse * 0.18) *
                (1.0 - deepWater);
              vec3 volumeRay = normalize(
                vWorldPosition - cameraPosition
              );
              float radialProjection = dot(
                vWorldPosition,
                volumeRay
              );
              float floorDiscriminant =
                radialProjection * radialProjection -
                (
                  dot(vWorldPosition, vWorldPosition) -
                  floorRadius * floorRadius
                );
              float outerExit = max(
                0.0,
                -2.0 * radialProjection
              );
              float floorEntry = floorDiscriminant > 0.0
                ? max(
                    0.0,
                    -radialProjection -
                    sqrt(floorDiscriminant)
                  )
                : outerExit;
              float localColumnDepth = mix(
                0.11,
                surfaceRadius - floorRadius,
                smoothstep(0.05, 0.92, deepWater)
              );
              float columnPath =
                localColumnDepth /
                max(viewAlignment, 0.075);
              float volumePath = clamp(
                min(
                  max(floorEntry, localColumnDepth * 0.5),
                  columnPath
                ),
                0.035,
                4.5
              );
              float absorption = mix(
                1.65,
                3.9,
                deepWater
              );
              float transmission = exp(
                -volumePath * absorption
              );
              float volumeOpacity = max(
                1.0 - transmission,
                fresnel * 0.94
              );
              float volumeDensity = smoothstep(
                0.08,
                0.72,
                volumePath
              );
              vec3 water = mix(
                shallowColor,
                deepColor,
                deepWater * 0.92
              );
              water *= 0.76 + diffuseLight * 0.38;
              water = mix(
                water,
                deepColor * 0.82,
                volumeDensity * (0.18 + deepWater * 0.48)
              );
              water = mix(
                water,
                shallowColor * 0.88 + foamColor * 0.07,
                (1.0 - transmission) *
                  (1.0 - deepWater) *
                  0.2
              );
              water = mix(
                water,
                skyReflection,
                fresnel * (0.4 + deepWater * 0.18)
              );
              water +=
                broadGlint *
                vec3(0.12, 0.2, 0.24) *
                (0.34 + directLight);
              water +=
                sharpGlint *
                vec3(0.88, 0.96, 1.0) *
                0.62;
              float foam = clamp(
                shorelineFoam * 0.72,
                0.0,
                1.0
              );
              water = mix(
                water,
                foamColor,
                foam
              );

              gl_FragColor = vec4(water, 1.0);
            }
          `}
          depthWrite
        />
      </mesh>
    </group>
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

function createShoreBreakerGeometry(biome: BiomeDefinition) {
  const positions: number[] = [];
  const breakerProgress: number[] = [];
  const arcPhase: number[] = [];
  const indices: number[] = [];
  const segments = 112;
  const rows = 16;
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

      const coastlineWobble =
        Math.sin(segment * 1.91 + biome.seed + partIndex) * 0.004;

      for (let row = 0; row <= rows; row += 1) {
        const across = row / rows;
        const offshoreOffset =
          0.006 +
          across * 0.055 +
          Math.sin(
            angle * 5.3 + across * 4.2 + biome.seed * 0.17,
          ) *
            0.0025;
        const direction = islandPartDirection(
          biome,
          part,
          shoreProgress + coastlineWobble + offshoreOffset,
          angle,
        );
        const position = direction
          .clone()
          .multiplyScalar(OCEAN_SURFACE_RADIUS + 0.02);

        positions.push(position.x, position.y, position.z);
        breakerProgress.push(across);
        arcPhase.push(
          (segment / segments) * Math.PI * 2 + partIndex * 1.73,
        );
      }
    }

    const rowStride = rows + 1;

    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;

      for (let row = 0; row < rows; row += 1) {
        const current = vertexOffset + segment * rowStride + row;
        const next = vertexOffset + nextSegment * rowStride + row;
        const outer = current + 1;
        const nextOuter = next + 1;

        indices.push(
          current,
          outer,
          next,
          next,
          outer,
          nextOuter,
        );
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "breakerProgress",
    new Float32BufferAttribute(breakerProgress, 1),
  );
  geometry.setAttribute(
    "arcPhase",
    new Float32BufferAttribute(arcPhase, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function landmarkDirectionOnLand(
  biome: BiomeDefinition,
  desiredDirection: Vector3,
) {
  const candidate = new Vector3();

  for (let step = 0; step <= 28; step += 1) {
    candidate
      .copy(desiredDirection)
      .lerp(biome.center, step / 28)
      .normalize();

    if (
      biomeForDirection(candidate)?.id === biome.id &&
      !isWaterDirection(candidate) &&
      surfaceRadiusAt(candidate) > OCEAN_SURFACE_RADIUS + 0.045
    ) {
      return candidate.clone();
    }
  }

  return biome.center.clone();
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

function CoastlineFoam({
  biome,
  reduceMotion,
}: {
  biome: BiomeDefinition;
  reduceMotion: boolean;
}) {
  const foamGeometry = useMemo(
    () => createCoastlineFoamGeometry(biome),
    [biome],
  );
  const breakerGeometry = useMemo(
    () => createShoreBreakerGeometry(biome),
    [biome],
  );
  const beachGeometry = useMemo(
    () => createBeachGeometry(biome),
    [biome],
  );
  const breakerUniforms = useMemo(
    () => ({
      time: { value: 0 },
      motion: { value: reduceMotion ? 0.32 : 1 },
      phase: { value: (biome.seed % 19) / 19 },
      foamColor: { value: new Color("#f2fbff") },
    }),
    [biome.seed, reduceMotion],
  );

  useEffect(
    () => () => {
      foamGeometry.dispose();
      breakerGeometry.dispose();
      beachGeometry.dispose();
    },
    [beachGeometry, breakerGeometry, foamGeometry],
  );

  useFrame(({ clock }) => {
    breakerUniforms.time.value = clock.elapsedTime;
    breakerUniforms.motion.value = reduceMotion ? 0.32 : 1;
  });

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
          opacity={0.025}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={breakerGeometry} renderOrder={5}>
        <shaderMaterial
          uniforms={breakerUniforms}
          vertexShader={`
            attribute float breakerProgress;
            attribute float arcPhase;
            uniform float time;
            uniform float motion;
            uniform float phase;
            varying float vBreaker;
            varying float vArcPhase;

            float breakerBand(float offset, float weight) {
              float cycle = fract(
                time * 0.18 * motion +
                phase +
                offset +
                sin(arcPhase * 2.3) * 0.018
              );
              float front = 1.0 - cycle;
              float band = 1.0 - smoothstep(
                0.018,
                0.058,
                abs(breakerProgress - front)
              );
              float arrival = smoothstep(0.015, 0.075, cycle);
              float dissolve = 1.0 - smoothstep(0.9, 0.995, cycle);

              return band * arrival * dissolve * weight;
            }

            void main() {
              vArcPhase = arcPhase;
              vBreaker = breakerBand(0.0, 1.0);
              vec3 displaced =
                position +
                normalize(position) *
                vBreaker *
                0.043 *
                motion;

              gl_Position =
                projectionMatrix *
                modelViewMatrix *
                vec4(displaced, 1.0);
            }
          `}
          fragmentShader={`
            uniform float time;
            uniform float motion;
            uniform vec3 foamColor;
            varying float vBreaker;
            varying float vArcPhase;

            void main() {
              float brokenEdge =
                sin(vArcPhase * 8.0 + time * 0.65 * motion) +
                sin(vArcPhase * 21.0 - time * 0.42 * motion) * 0.55;
              float breakup = smoothstep(-0.32, 0.55, brokenEdge);
              float sparkle =
                0.68 +
                sin(vArcPhase * 34.0 + time * 1.55 * motion) * 0.32;
              float alpha =
                vBreaker *
                mix(0.24, 0.96, breakup) *
                sparkle;

              if (alpha < 0.025) {
                discard;
              }

              gl_FragColor = vec4(foamColor, alpha);
            }
          `}
          transparent
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
  solarDirection,
}: {
  water: WaterFeature;
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
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
            ? new Color("#102d4b")
            : new Color(water.color).multiplyScalar(0.62),
      },
      shallowColor: {
        value:
          skyPhase === "night"
            ? new Color("#2c6382")
            : new Color(water.color).lerp(new Color("#9ad6eb"), 0.42),
      },
      foamColor: {
        value:
          skyPhase === "night"
            ? new Color("#bfd9e5")
            : new Color("#f1fbff"),
      },
      sunDirection: {
        value: new Vector3(...solarDirection).normalize(),
      },
    }),
    [reduceMotion, skyPhase, solarDirection, water.color],
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
    uniforms.sunDirection.value
      .set(...solarDirection)
      .normalize();
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
    <HorizonOccludedGroup
      position={position}
      quaternion={orientation}
      revealHeight={0.22}
    >
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
            varying vec3 vWorldNormal;
            varying float vDepth;
            varying float vCrest;
            varying float vFoam;

            float ambientWaveAt(vec2 samplePosition) {
              return (
                sin(samplePosition.x * 8.0 + time * 1.25) +
                sin(samplePosition.y * 10.0 - time * 0.95) +
                sin(
                  (samplePosition.x + samplePosition.y) * 6.5 +
                  time * 0.72
                )
              ) / 3.0;
            }

            float wakeAt(vec2 samplePosition) {
              float travelerDistance = length(
                samplePosition - travelerPosition
              );

              return sin(
                travelerDistance * 29.0 - time * 8.0
              ) * exp(-travelerDistance * 3.3) * interaction;
            }

            float surfaceHeightAt(vec2 samplePosition) {
              float radialDistance = length(samplePosition);
              float sphericalSag =
                sqrt(max(
                  ${surfaceRadius.toFixed(5)} *
                    ${surfaceRadius.toFixed(5)} -
                    radialDistance * radialDistance,
                  0.0
                )) -
                ${surfaceRadius.toFixed(5)};

              return sphericalSag + motion * (
                ambientWaveAt(samplePosition) * 0.026 +
                wakeAt(samplePosition) * 0.058
              );
            }

            void main() {
              vec2 samplePosition = position.xy;
              float radialDistance = length(samplePosition);
              float polarAngle = atan(
                samplePosition.y,
                samplePosition.x
              );
              float edgeScale =
                1.0 +
                sin(polarAngle * 3.0 + 0.6) * 0.025 +
                sin(polarAngle * 7.0 - 0.4) * 0.015;
              float normalizedRadius =
                radialDistance / (${radius.toFixed(5)} * edgeScale);
              float ambientWave = ambientWaveAt(samplePosition);
              float wake = wakeAt(samplePosition);
              float shorelineNoise =
                sin(polarAngle * 9.0 + time * 0.45) *
                0.5 + 0.5;
              float displacement = surfaceHeightAt(samplePosition);
              vec3 displacedPosition =
                position + normal * displacement;
              float normalSample = max(
                0.006,
                ${radius.toFixed(5)} * 0.012
              );
              float heightX = surfaceHeightAt(
                samplePosition + vec2(normalSample, 0.0)
              );
              float heightY = surfaceHeightAt(
                samplePosition + vec2(0.0, normalSample)
              );
              vec3 tangentX =
                vec3(1.0, 0.0, 0.0) +
                normal * ((heightX - displacement) / normalSample);
              vec3 tangentY =
                vec3(0.0, 1.0, 0.0) +
                normal * ((heightY - displacement) / normalSample);
              vec3 localNormal = normalize(
                cross(tangentX, tangentY)
              );

              if (dot(localNormal, normal) < 0.0) {
                localNormal *= -1.0;
              }

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
              vWorldNormal = normalize(
                mat3(modelMatrix) * localNormal
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
            uniform vec3 sunDirection;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying float vDepth;
            varying float vCrest;
            varying float vFoam;

            void main() {
              vec3 normal = normalize(vWorldNormal);

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
              vec3 lightDirection = normalize(sunDirection);
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
              water += glint * vec3(0.7, 0.9, 1.0);
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
              gl_FragColor = vec4(color, 1.0);
            }
          `}
          depthWrite
          side={DoubleSide}
        />
      </mesh>
    </HorizonOccludedGroup>
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
    const treeCount =
      biome.id === "united-states"
        ? 48
        : biome.id === "turkiye"
          ? 36
          : biome.id === "japan"
            ? 38
            : biome.id === "south-korea"
              ? 30
              : 26;
    const bushCount = Math.round(treeCount * 0.28);
    const count = treeCount + bushCount;

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
      const kind: VegetationKind =
        index < treeCount ? "tree" : "bush";
      const scale =
        kind === "bush"
          ? 0.68 + random() * 0.52
          : 0.72 + random() * 0.78;
      const rotation = random() * Math.PI * 2;
      const basis = tangentBasis(direction);

      plants.push({
        id: `${biome.id}-plant-${index}`,
        biomeId: biome.id,
        direction,
        position: direction.clone().multiplyScalar(surfaceRadius),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        windAxis: basis.east
          .multiplyScalar(Math.cos(rotation))
          .addScaledVector(basis.north, Math.sin(rotation))
          .normalize(),
        scale,
        rotation,
        phase: random() * Math.PI * 2,
        kind,
        touching: false,
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
  const assetByStyle: Record<
    VegetationDefinition["style"],
    NatureAssetName
  > = {
    blossom: "tree-blossom",
    broadleaf: "tree-broadleaf",
    conifer: "tree-pine",
    cypress: "tree-pine",
    palm: "tree-palm",
    pine: "tree-pine",
  };

  return <NatureAsset name={assetByStyle[style]} />;
}

function BushModel({
  style,
}: {
  style: VegetationDefinition["style"];
}) {
  const assetName: NatureAssetName =
    style === "blossom"
      ? "bush-blossom"
      : style === "palm"
        ? "bush-tropical"
        : "bush-green";

  return <NatureAsset name={assetName} />;
}

function VegetationField({
  travelerDirectionRef,
  movementVelocityRef,
  traversalModeRef,
  onVegetationBrush,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  traversalModeRef: MutableRefObject<"boat" | "land" | "swim">;
  onVegetationBrush: (
    strength: number,
    kind: VegetationKind,
    variation: number,
  ) => void;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const plants = useMemo(createVegetation, []);
  const plantRefs = useRef<Array<Group | null>>([]);
  const bendAxisRef = useRef(new Vector3());
  const baseOrientationRef = useRef(new Quaternion());
  const bendRef = useRef(new Quaternion());
  const visibilityProbeRef = useRef(new Vector3());
  const occlusionRayRef = useRef(new Vector3());
  const occlusionPointRef = useRef(new Vector3());

  useFrame(({ clock, camera }, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    const movementSpeed = Math.abs(movementVelocityRef.current);
    const canBrush =
      exploreMode && traversalModeRef.current === "land";

    plants.forEach((plant, index) => {
      const group = plantRefs.current[index];

      if (!group) {
        return;
      }

      group.visible = !isOccludedBySphere(
        visibilityProbeRef.current
          .copy(plant.position)
          .addScaledVector(plant.direction, 0.05),
        camera.position,
        OCEAN_SURFACE_RADIUS + 0.025,
        occlusionRayRef.current,
        occlusionPointRef.current,
      );

      if (!group.visible) {
        return;
      }

      const travelerDistance = angularDistance(
        plant.direction,
        travelerDirectionRef.current,
      );
      const interactionAngle =
        plant.kind === "bush"
          ? BUSH_INTERACTION_ANGLE
          : TREE_INTERACTION_ANGLE;
      const travelerBend =
        canBrush
          ? 1 -
            MathUtils.smoothstep(
              travelerDistance,
              plant.kind === "bush" ? 0.018 : 0.012,
              interactionAngle,
            )
          : 0;
      const touchEnter =
        plant.kind === "bush" ? 0.058 : 0.034;
      const touchExit =
        plant.kind === "bush" ? 0.082 : 0.05;

      if (
        !plant.touching &&
        canBrush &&
        travelerDistance < touchEnter &&
        movementSpeed > 0.035
      ) {
        plant.touching = true;
        onVegetationBrush(
          MathUtils.clamp(
            movementSpeed / 0.36,
            plant.kind === "bush" ? 0.24 : 0.18,
            1,
          ),
          plant.kind,
          index,
        );
      } else if (
        plant.touching &&
        (!canBrush || travelerDistance > touchExit)
      ) {
        plant.touching = false;
      }

      const windAmount =
        plant.kind === "bush" ? 0.032 : 0.012;
      const wind =
        reduceMotion
          ? 0
          : Math.sin(clock.elapsedTime * 1.05 + plant.phase) *
            windAmount;
      const interactionBend =
        plant.kind === "bush" ? 0.28 : 0.032;
      const bend = MathUtils.clamp(
        wind + travelerBend * interactionBend,
        -windAmount,
        plant.kind === "bush" ? 0.31 : 0.044,
      );
      const bendAxis =
        travelerBend > 0.01
          ? bendAxisRef.current
              .crossVectors(
                travelerDirectionRef.current,
                plant.direction,
              )
              .normalize()
          : bendAxisRef.current.copy(plant.windAxis);

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
      const ease =
        1 -
        Math.exp(
          -frameDelta * (plant.kind === "bush" ? 11 : 4.5),
        );

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
          {plant.kind === "bush" ? (
            <BushModel style={plant.style} />
          ) : (
            <TreeModel style={plant.style} />
          )}
        </group>
      ))}
    </group>
  );
}

function createSurfaceDetails() {
  return BIOMES.flatMap((biome) => {
    const random = createSeededRandom(biome.seed * 307);
    const details: SurfaceDetailDefinition[] = [];
    const grassCount =
      biome.id === "united-states"
        ? 92
        : biome.id === "turkiye"
          ? 58
          : biome.id === "japan"
            ? 48
            : biome.id === "south-korea"
              ? 38
              : 32;
    const rockCount =
      biome.id === "united-states" ? 18 : 11;
    const count = grassCount + rockCount;

    for (let index = 0; index < count; index += 1) {
      const kind: SurfaceDetailDefinition["kind"] =
        index < grassCount ? "grass" : "rock";
      let direction: Vector3 | null = null;

      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidate = directionFromOffset(
          biome.center,
          (random() - 0.5) * biome.angularRadius * 1.78,
          (random() - 0.5) * biome.angularRadius * 1.78,
        );
        const clearOfDestination = Array.from(
          PLACE_DIRECTIONS.values(),
        ).every(
          (placeDirection) =>
            angularDistance(candidate, placeDirection) >
            (kind === "rock" ? 0.055 : 0.042),
        );

        if (
          biomeForDirection(candidate)?.id === biome.id &&
          !isWaterDirection(candidate) &&
          clearOfDestination
        ) {
          direction = candidate;
          break;
        }
      }

      if (!direction) {
        continue;
      }

      const size =
        kind === "grass"
          ? 0.6 + random() * 0.72
          : 0.58 + random() * 1.08;
      const lift =
        kind === "grass" ? 0.055 * size : 0.035 * size;

      details.push({
        id: `${biome.id}-${kind}-${index}`,
        kind,
        position: direction
          .clone()
          .multiplyScalar(surfaceRadiusAt(direction) + lift),
        orientation: new Quaternion().setFromUnitVectors(
          UP,
          direction,
        ),
        rotation: random() * Math.PI * 2,
        scale:
          kind === "grass"
            ? new Vector3(
                size * (0.58 + random() * 0.28),
                size,
                size * (0.7 + random() * 0.34),
              )
            : new Vector3(
                size * (0.7 + random() * 0.42),
                size * (0.46 + random() * 0.36),
                size * (0.72 + random() * 0.44),
              ),
        variant: Math.floor(random() * 3),
      });
    }

    return details;
  });
}

function createGrassClumpGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let blade = 0; blade < 3; blade += 1) {
    const angle = (blade / 3) * Math.PI;
    const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const right = new Vector3(-forward.z, 0, forward.x);
    const center = forward.clone().multiplyScalar(0.009);
    const vertexOffset = positions.length / 3;
    const points = [
      center.clone().addScaledVector(right, -0.013).setY(-0.06),
      center.clone().addScaledVector(right, 0.013).setY(-0.06),
      center
        .clone()
        .addScaledVector(right, -0.009)
        .addScaledVector(forward, 0.006)
        .setY(0.015),
      center
        .clone()
        .addScaledVector(right, 0.009)
        .addScaledVector(forward, 0.006)
        .setY(0.015),
      center
        .clone()
        .addScaledVector(forward, 0.022)
        .setY(0.075),
    ];

    points.forEach((point) => {
      positions.push(point.x, point.y, point.z);
    });
    indices.push(
      vertexOffset,
      vertexOffset + 1,
      vertexOffset + 2,
      vertexOffset + 1,
      vertexOffset + 3,
      vertexOffset + 2,
      vertexOffset + 2,
      vertexOffset + 3,
      vertexOffset + 4,
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

function SurfaceDetailField() {
  const details = useMemo(createSurfaceDetails, []);
  const grassGeometry = useMemo(createGrassClumpGeometry, []);
  const grassDark = useMemo(
    () =>
      details.filter(
        (detail) =>
          detail.kind === "grass" && detail.variant % 2 === 0,
      ),
    [details],
  );
  const grassLight = useMemo(
    () =>
      details.filter(
        (detail) =>
          detail.kind === "grass" && detail.variant % 2 === 1,
      ),
    [details],
  );
  const rocks = useMemo(
    () => details.filter((detail) => detail.kind === "rock"),
    [details],
  );
  const grassDarkRef = useRef<InstancedMesh | null>(null);
  const grassLightRef = useRef<InstancedMesh | null>(null);
  const rocksRef = useRef<InstancedMesh | null>(null);

  useEffect(() => () => grassGeometry.dispose(), [grassGeometry]);

  useEffect(() => {
    const transform = new Object3D();
    const rotation = new Quaternion();

    const applyInstances = (
      mesh: InstancedMesh | null,
      instances: SurfaceDetailDefinition[],
    ) => {
      if (!mesh) {
        return;
      }

      instances.forEach((detail, index) => {
        transform.position.copy(detail.position);
        transform.quaternion
          .copy(detail.orientation)
          .multiply(
            rotation.setFromAxisAngle(UP, detail.rotation),
          );
        transform.scale.copy(detail.scale);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    applyInstances(grassDarkRef.current, grassDark);
    applyInstances(grassLightRef.current, grassLight);
    applyInstances(rocksRef.current, rocks);
  }, [grassDark, grassLight, rocks]);

  return (
    <group>
      <instancedMesh
        ref={grassDarkRef}
        geometry={grassGeometry}
        args={[undefined, undefined, grassDark.length]}
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#456f42"
          roughness={0.96}
          metalness={0}
          side={DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={grassLightRef}
        geometry={grassGeometry}
        args={[undefined, undefined, grassLight.length]}
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#759a5d"
          roughness={0.96}
          metalness={0}
          side={DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={rocksRef}
        args={[undefined, undefined, rocks.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[0.072, 14, 9]} />
        <meshStandardMaterial
          color="#888377"
          roughness={0.98}
          metalness={0}
        />
      </instancedMesh>
    </group>
  );
}

function createLooseProps() {
  const props: LoosePropState[] = [];

  BIOMES.forEach((biome) => {
    const random = createSeededRandom(biome.seed * 307);

    for (let index = 0; index < 3; index += 1) {
      let direction = biome.center;

      for (let attempt = 0; attempt < 16; attempt += 1) {
        const candidate = directionFromOffset(
          biome.center,
          (random() - 0.5) * biome.angularRadius * 1.65,
          (random() - 0.5) * biome.angularRadius * 1.65,
        );

        if (
          biomeForDirection(candidate)?.id === biome.id &&
          !isWaterDirection(candidate) &&
          Array.from(PLACE_DIRECTIONS.values()).every(
            (placeDirection) =>
              angularDistance(candidate, placeDirection) > 0.12,
          )
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
        spawnDirection: direction.clone(),
        direction,
        tangentVelocity: new Vector3(),
        worldPosition: direction
          .clone()
          .multiplyScalar(surfaceRadiusAt(direction)),
        linearVelocity: new Vector3(),
        orientation: new Quaternion().setFromUnitVectors(UP, direction),
        scale: 0.075 + random() * 0.065,
        color:
          biome.id === "japan"
            ? "#817b76"
            : biome.id === "dominican-republic"
              ? "#7d746b"
              : biome.id === "turkiye"
                ? "#898076"
                : biome.id === "south-korea"
                  ? "#717772"
                  : "#77746f",
        accentColor:
          biome.id === "dominican-republic"
            ? "#68645f"
            : biome.id === "turkiye"
              ? "#6d6861"
              : "#5f6661",
        contactCooldown: 0,
        motion: "ground",
        charge: 0,
        sinkElapsed: 0,
        splashElapsed: -1,
      });
    }
  });

  return props;
}

function LooseProps({
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  waterSurfaceRef,
  interactionRef,
  onLoosePropImpact,
  onLoosePropSplash,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  waterSurfaceRef: MutableRefObject<OceanSurfaceApi | null>;
  interactionRef: MutableRefObject<LoosePropInteractionApi | null>;
  onLoosePropImpact: (strength: number, variation: number) => void;
  onLoosePropSplash: (strength: number, variation: number) => void;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const props = useMemo(createLooseProps, []);
  const propRefs = useRef<Array<Group | null>>([]);
  const splashRefs = useRef<Array<Group | null>>([]);
  const bubbleRefs = useRef<Array<Group | null>>([]);
  const trajectoryRef = useRef<Group>(null);
  const trajectoryDotRefs = useRef<Array<Mesh | null>>([]);
  const promptRef = useRef<ThreeSprite>(null);
  const promptKindRef = useRef<LoosePropPromptKind | null>(null);
  const heldPropIndexRef = useRef<number | null>(null);
  const interactionPhaseRef =
    useRef<LoosePropInteractionPhase>("idle");
  const throwRequestedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const impulseRef = useRef(new Vector3());
  const axisRef = useRef(new Vector3());
  const nextDirectionRef = useRef(new Vector3());
  const orientationRef = useRef(new Quaternion());
  const gravityRef = useRef(new Vector3());
  const previewPositionRef = useRef(new Vector3());
  const previewVelocityRef = useRef(new Vector3());
  const propOcclusionRayRef = useRef(new Vector3());
  const propOcclusionPointRef = useRef(new Vector3());
  const promptTextures = useMemo(
    () => ({
      pickup: createLoosePropPromptTexture("F  PICK UP"),
      carrying: createLoosePropPromptTexture(
        "HOLD F  THROW",
        "ESC  DROP",
      ),
      charging: createLoosePropPromptTexture(
        "RELEASE F  THROW",
        "ESC  CANCEL",
      ),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(promptTextures).forEach((texture) => texture?.dispose());
    },
    [promptTextures],
  );

  const setThrowVelocity = (
    charge: number,
    up: Vector3,
    forward: Vector3,
    target: Vector3,
  ) => {
    const easedCharge = charge * charge * (3 - 2 * charge);

    return target
      .copy(forward)
      .multiplyScalar(1.45 + easedCharge * 3.2)
      .addScaledVector(up, 1.15 + easedCharge * 2.15);
  };

  useEffect(() => {
    const api: LoosePropInteractionApi = {
      beginInteraction: () => {
        const heldIndex = heldPropIndexRef.current;

        if (heldIndex !== null) {
          if (interactionPhaseRef.current === "carrying") {
            interactionPhaseRef.current = "charging";
            props[heldIndex].charge = 0.04;
          }

          return true;
        }

        if (
          !exploreMode ||
          isWaterDirection(travelerDirectionRef.current)
        ) {
          return false;
        }

        let nearestIndex = -1;
        let nearestDistance = Number.POSITIVE_INFINITY;

        props.forEach((prop, index) => {
          if (prop.motion !== "ground") {
            return;
          }

          const distance = angularDistance(
            prop.direction,
            travelerDirectionRef.current,
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        if (
          nearestIndex < 0 ||
          nearestDistance > LOOSE_PROP_INTERACTION_ANGLE
        ) {
          return false;
        }

        const prop = props[nearestIndex];
        prop.motion = "held";
        prop.charge = 0;
        prop.tangentVelocity.set(0, 0, 0);
        prop.linearVelocity.set(0, 0, 0);
        heldPropIndexRef.current = nearestIndex;
        interactionPhaseRef.current = "carrying";
        throwRequestedRef.current = false;
        cancelRequestedRef.current = false;
        onLoosePropImpact(0.28, nearestIndex);
        return true;
      },
      endInteraction: () => {
        if (
          heldPropIndexRef.current === null ||
          interactionPhaseRef.current !== "charging"
        ) {
          return heldPropIndexRef.current !== null;
        }

        throwRequestedRef.current = true;
        return true;
      },
      cancelInteraction: () => {
        if (heldPropIndexRef.current === null) {
          return false;
        }

        cancelRequestedRef.current = true;
        return true;
      },
    };

    interactionRef.current = api;

    return () => {
      if (interactionRef.current === api) {
        interactionRef.current = null;
      }
    };
  }, [
    exploreMode,
    interactionRef,
    onLoosePropImpact,
    props,
    travelerDirectionRef,
  ]);

  useFrame(({ clock, camera }, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    const travelerDirection = travelerDirectionRef.current;
    const travelerForward = travelerForwardRef.current;

    if (trajectoryRef.current) {
      trajectoryRef.current.visible = false;
    }

    props.forEach((prop, index) => {
      const mesh = propRefs.current[index];
      const splash = splashRefs.current[index];
      const bubbles = bubbleRefs.current[index];

      if (!mesh) {
        return;
      }

      mesh.visible = !isOccludedBySphere(
        prop.worldPosition,
        camera.position,
        OCEAN_SURFACE_RADIUS + 0.025,
        propOcclusionRayRef.current,
        propOcclusionPointRef.current,
      );

      if (bubbles) {
        bubbles.visible = false;
      }

      if (splash && prop.splashElapsed >= 0) {
        prop.splashElapsed += frameDelta;
        splash.visible = prop.splashElapsed < 0.72;

        if (splash.visible) {
          const splashRadius =
            waterSurfaceRef.current?.sampleRadius(prop.direction) ??
            traversalSurfaceRadiusAt(prop.direction);
          splash.position
            .copy(prop.direction)
            .multiplyScalar(splashRadius + 0.012);
          splash.quaternion.copy(
            orientationRef.current.setFromUnitVectors(
              UP,
              prop.direction,
            ),
          );
          splash.scale.setScalar(
            0.55 + MathUtils.smoothstep(prop.splashElapsed, 0, 0.72) * 3.2,
          );
        } else {
          prop.splashElapsed = -1;
        }
      }

      prop.contactCooldown = Math.max(
        0,
        prop.contactCooldown - frameDelta,
      );

      if (prop.motion === "held") {
        if (!exploreMode || cancelRequestedRef.current) {
          const dropDirection = nextDirectionRef.current.copy(
            exploreMode ? travelerDirection : prop.spawnDirection,
          );

          if (exploreMode) {
            const dropAxis = axisRef.current.crossVectors(
              travelerDirection,
              travelerForward,
            );

            if (dropAxis.lengthSq() > 0.00001) {
              const forwardDrop = dropDirection
                .clone()
                .applyAxisAngle(dropAxis.normalize(), 0.055)
                .normalize();

              if (!isWaterDirection(forwardDrop)) {
                dropDirection.copy(forwardDrop);
              }
            }
          }

          prop.motion = "ground";
          prop.direction.copy(dropDirection);
          prop.worldPosition
            .copy(dropDirection)
            .multiplyScalar(
              surfaceRadiusAt(dropDirection) + prop.scale * 0.72,
            );
          prop.charge = 0;
          prop.linearVelocity.set(0, 0, 0);
          prop.tangentVelocity.set(0, 0, 0);
          prop.contactCooldown = 0.25;
          mesh.position.copy(prop.worldPosition);
          heldPropIndexRef.current = null;
          interactionPhaseRef.current = "idle";
          throwRequestedRef.current = false;
          cancelRequestedRef.current = false;
          onLoosePropImpact(0.18, index);
          return;
        }

        const heldRadius =
          traversalSurfaceRadiusAt(travelerDirection) + 0.44;
        prop.worldPosition
          .copy(travelerDirection)
          .multiplyScalar(heldRadius)
          .addScaledVector(travelerForward, 0.34);
        prop.direction.copy(prop.worldPosition).normalize();

        if (interactionPhaseRef.current === "charging") {
          prop.charge = Math.min(
            1,
            prop.charge + frameDelta / LOOSE_PROP_CHARGE_SECONDS,
          );
        } else {
          prop.charge = 0;
        }

        mesh.position.copy(prop.worldPosition);
        mesh.scale.setScalar(1);
        mesh.quaternion.slerp(
          orientationRef.current.setFromUnitVectors(
            UP,
            travelerDirection,
          ),
          1 - Math.exp(-frameDelta * 12),
        );
        mesh.rotateX(
          Math.sin(prop.charge * Math.PI) *
            frameDelta *
            (interactionPhaseRef.current === "charging" ? 1.8 : 0.2),
        );

        if (
          trajectoryRef.current &&
          interactionPhaseRef.current === "charging"
        ) {
          trajectoryRef.current.visible = true;
          const previewPosition = previewPositionRef.current.copy(
            prop.worldPosition,
          );
          const previewVelocity = setThrowVelocity(
            prop.charge,
            travelerDirection,
            travelerForward,
            previewVelocityRef.current,
          );
          const previewStep = 0.065;

          trajectoryDotRefs.current.forEach((dot) => {
            if (!dot) {
              return;
            }

            gravityRef.current
              .copy(previewPosition)
              .normalize()
              .multiplyScalar(-LOOSE_PROP_GRAVITY);
            previewVelocity.addScaledVector(
              gravityRef.current,
              previewStep,
            );
            previewPosition.addScaledVector(
              previewVelocity,
              previewStep,
            );
            dot.position.copy(previewPosition);
          });
        }

        if (
          throwRequestedRef.current &&
          interactionPhaseRef.current === "charging"
        ) {
          prop.motion = "airborne";
          prop.charge = Math.max(0.16, prop.charge);
          setThrowVelocity(
            prop.charge,
            travelerDirection,
            travelerForward,
            prop.linearVelocity,
          );
          heldPropIndexRef.current = null;
          interactionPhaseRef.current = "idle";
          throwRequestedRef.current = false;
          cancelRequestedRef.current = false;

          if (trajectoryRef.current) {
            trajectoryRef.current.visible = false;
          }
        }

        return;
      }

      if (prop.motion === "airborne") {
        gravityRef.current
          .copy(prop.worldPosition)
          .normalize()
          .multiplyScalar(-LOOSE_PROP_GRAVITY);
        prop.linearVelocity.addScaledVector(
          gravityRef.current,
          frameDelta,
        );
        prop.worldPosition.addScaledVector(
          prop.linearVelocity,
          frameDelta,
        );
        const radialDistance = prop.worldPosition.length();
        const direction = nextDirectionRef.current
          .copy(prop.worldPosition)
          .normalize();

        if (isWaterDirection(direction)) {
          const waterRadius = isOceanDirection(direction)
            ? (waterSurfaceRef.current?.sampleRadius(direction) ??
              OCEAN_SURFACE_RADIUS)
            : traversalSurfaceRadiusAt(direction);

          if (radialDistance <= waterRadius) {
            prop.motion = "sinking";
            prop.sinkElapsed = 0;
            prop.splashElapsed = 0;
            prop.direction.copy(direction);
            prop.linearVelocity.multiplyScalar(0.2);
            waterSurfaceRef.current?.disturb(
              direction,
              -0.9 - prop.charge * 0.8,
              0.045 + prop.scale * 0.08,
            );
            onLoosePropSplash(
              0.45 + prop.charge * 0.55,
              index,
            );
          }
        } else {
          const groundRadius =
            surfaceRadiusAt(direction) + prop.scale * 0.72;

          if (radialDistance <= groundRadius) {
            const impactSpeed = prop.linearVelocity.length();
            prop.motion = "ground";
            prop.direction.copy(direction);
            prop.worldPosition
              .copy(direction)
              .multiplyScalar(groundRadius);
            prop.tangentVelocity
              .copy(prop.linearVelocity)
              .addScaledVector(
                direction,
                -prop.linearVelocity.dot(direction),
              )
              .multiplyScalar(0.035);
            prop.linearVelocity.set(0, 0, 0);
            prop.contactCooldown = 0.22;
            onLoosePropImpact(
              MathUtils.clamp(impactSpeed / 6.5, 0.2, 1),
              index,
            );
          }
        }

        mesh.position.copy(prop.worldPosition);
        mesh.rotateX(frameDelta * 5.8);
        mesh.rotateZ(frameDelta * 3.6);
        return;
      }

      if (prop.motion === "sinking") {
        prop.sinkElapsed += frameDelta;
        const sinkDirection = nextDirectionRef.current
          .copy(prop.worldPosition)
          .normalize();
        prop.linearVelocity.multiplyScalar(
          Math.exp(-frameDelta * 2.4),
        );
        prop.worldPosition.addScaledVector(
          prop.linearVelocity,
          frameDelta,
        );
        prop.worldPosition.addScaledVector(
          sinkDirection,
          -frameDelta * (0.24 + prop.scale * 0.75),
        );
        const waterRadius =
          waterSurfaceRef.current?.sampleRadius(sinkDirection) ??
          OCEAN_SURFACE_RADIUS;
        const submergedDepth =
          waterRadius - prop.worldPosition.length();

        prop.direction.copy(sinkDirection);
        mesh.position.copy(prop.worldPosition);
        mesh.rotateX(frameDelta * 1.8);
        mesh.rotateZ(frameDelta * 1.15);
        mesh.scale.setScalar(
          1 -
            MathUtils.smoothstep(
              submergedDepth,
              0.62,
              0.88,
            ) *
              0.35,
        );

        if (bubbles) {
          bubbles.visible = mesh.visible;
          bubbles.position.copy(prop.worldPosition);
          bubbles.quaternion.copy(
            orientationRef.current.setFromUnitVectors(
              UP,
              sinkDirection,
            ),
          );
          const bubbleRise = Math.max(
            0.14,
            Math.min(0.78, submergedDepth + 0.08),
          );

          bubbles.children.forEach((bubble, bubbleIndex) => {
            const cycle =
              (prop.sinkElapsed * (0.72 + bubbleIndex * 0.035) +
                bubbleIndex * 0.21) %
              1;
            bubble.position.set(
              Math.sin(bubbleIndex * 2.3 + prop.sinkElapsed) * 0.035,
              cycle * bubbleRise,
              Math.cos(bubbleIndex * 1.7 - prop.sinkElapsed) * 0.035,
            );
            bubble.scale.setScalar(
              (0.014 + cycle * 0.009) *
                (0.8 + (bubbleIndex % 3) * 0.12),
            );
          });
        }

        if (
          prop.worldPosition.length() <= OCEAN_FLOOR_RADIUS + 0.08 ||
          prop.sinkElapsed >= 4.2
        ) {
          prop.motion = "ground";
          prop.direction.copy(prop.spawnDirection);
          prop.worldPosition
            .copy(prop.direction)
            .multiplyScalar(
              surfaceRadiusAt(prop.direction) + prop.scale * 0.72,
            );
          prop.linearVelocity.set(0, 0, 0);
          prop.tangentVelocity.set(0, 0, 0);
          prop.charge = 0;
          prop.sinkElapsed = 0;
          prop.contactCooldown = 0.5;
          mesh.position.copy(prop.worldPosition);
          mesh.scale.setScalar(1);
        }

        return;
      }

      const travelerDistance = angularDistance(
        prop.direction,
        travelerDirection,
      );

      if (
        exploreMode &&
        travelerDistance < 0.055 &&
        prop.contactCooldown === 0 &&
        Math.abs(movementVelocityRef.current) > 0.08
      ) {
        const impulse = impulseRef.current
          .copy(travelerForward)
          .addScaledVector(
            prop.direction,
            -travelerForward.dot(prop.direction),
          );
        const pushStrength =
          0.52 + Math.abs(movementVelocityRef.current) * 0.42;

        if (impulse.lengthSq() > 0.00001) {
          prop.tangentVelocity
            .multiplyScalar(0.12)
            .addScaledVector(
              impulse.normalize(),
              pushStrength,
            );
        } else {
          prop.tangentVelocity
            .multiplyScalar(0.12)
            .addScaledVector(
              tangentBasis(prop.direction).east,
              pushStrength,
            );
        }

        onLoosePropImpact(
          MathUtils.clamp(
            Math.abs(movementVelocityRef.current) / 0.36,
            0.2,
            1,
          ),
          index,
        );
        prop.contactCooldown = 0.34;
      }

      prop.tangentVelocity.multiplyScalar(
        Math.exp(-frameDelta * (reduceMotion ? 9 : 4.2)),
      );

      if (prop.tangentVelocity.lengthSq() > 0.000001) {
        const speed = prop.tangentVelocity.length();
        const axis = axisRef.current
          .crossVectors(prop.direction, prop.tangentVelocity)
          .normalize();
        const angle = speed * frameDelta;
        const nextDirection = nextDirectionRef.current
          .copy(prop.direction)
          .applyAxisAngle(axis, angle)
          .normalize();

        if (isWaterDirection(nextDirection)) {
          prop.motion = "airborne";
          prop.worldPosition
            .copy(prop.direction)
            .multiplyScalar(
              surfaceRadiusAt(prop.direction) + prop.scale * 0.72,
            );
          prop.linearVelocity
            .copy(prop.tangentVelocity)
            .multiplyScalar(PLANET_RADIUS * 0.92)
            .addScaledVector(prop.direction, 0.32);
          prop.tangentVelocity.set(0, 0, 0);
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
        .multiplyScalar(
          surfaceRadiusAt(prop.direction) + prop.scale * 0.72,
        );
      prop.worldPosition.copy(mesh.position);
      const orientation = orientationRef.current.setFromUnitVectors(
        UP,
        prop.direction,
      );
      mesh.quaternion.slerp(
        orientation,
        1 - Math.exp(-frameDelta * 2.5),
      );
      mesh.scale.setScalar(1);
    });

    const prompt = promptRef.current;

    if (prompt) {
      let promptIndex = heldPropIndexRef.current;
      let promptKind: LoosePropPromptKind =
        interactionPhaseRef.current === "charging"
          ? "charging"
          : "carrying";

      if (promptIndex === null && exploreMode) {
        let nearestDistance = Number.POSITIVE_INFINITY;

        props.forEach((prop, index) => {
          if (prop.motion !== "ground") {
            return;
          }

          const distance = angularDistance(
            prop.direction,
            travelerDirection,
          );

          if (
            distance < nearestDistance &&
            distance <= LOOSE_PROP_PROMPT_ANGLE
          ) {
            nearestDistance = distance;
            promptIndex = index;
          }
        });
        promptKind = "pickup";
      }

      const promptProp =
        promptIndex === null ? null : props[promptIndex];
      const promptTexture = promptTextures[promptKind];

      prompt.visible =
        exploreMode &&
        promptProp !== null &&
        promptTexture !== null;

      if (prompt.visible && promptProp && promptTexture) {
        const material = prompt.material as SpriteMaterial;

        if (promptKindRef.current !== promptKind) {
          material.map = promptTexture;
          material.needsUpdate = true;
          promptKindRef.current = promptKind;
        }

        prompt.position
          .copy(promptProp.worldPosition)
          .addScaledVector(promptProp.direction, 0.5);
        const pulse =
          promptKind === "pickup" && !reduceMotion
            ? 1 + Math.sin(clock.elapsedTime * 3.1) * 0.035
            : 1;
        prompt.scale.set(
          (promptKind === "pickup" ? 1.55 : 1.78) * pulse,
          (promptKind === "pickup" ? 0.36 : 0.56) * pulse,
          1,
        );
      }
    }
  });

  return (
    <group>
      {promptTextures.pickup ? (
        <sprite ref={promptRef} visible={false} renderOrder={42}>
          <spriteMaterial
            map={promptTextures.pickup}
            transparent
            depthTest
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ) : null}
      {props.map((prop, index) => (
        <group
          key={`${prop.id}-splash`}
          ref={(group) => {
            splashRefs.current[index] = group;
          }}
          visible={false}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.012, 6, 20]} />
            <meshBasicMaterial
              color="#d8f4ff"
              transparent
              opacity={0.72}
              depthWrite={false}
            />
          </mesh>
          {Array.from({ length: 7 }, (_, splashIndex) => {
            const angle = (splashIndex / 7) * Math.PI * 2;

            return (
              <mesh
                key={splashIndex}
                position={[
                  Math.cos(angle) * 0.09,
                  0.045 + (splashIndex % 3) * 0.018,
                  Math.sin(angle) * 0.09,
                ]}
                scale={0.022 + (splashIndex % 2) * 0.006}
              >
                <sphereGeometry args={[1, 7, 5]} />
                <meshBasicMaterial
                  color="#bdeaff"
                  transparent
                  opacity={0.8}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
      {props.map((prop, index) => (
        <group
          key={`${prop.id}-bubbles`}
          ref={(group) => {
            bubbleRefs.current[index] = group;
          }}
          visible={false}
        >
          {Array.from({ length: 6 }, (_, bubbleIndex) => (
            <mesh
              key={bubbleIndex}
              scale={0.018}
              renderOrder={8}
            >
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial
                color="#bdeaff"
                transparent
                opacity={0.58}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={trajectoryRef} visible={false}>
        {Array.from({ length: LOOSE_PROP_TRAJECTORY_POINTS }, (_, index) => (
          <mesh
            key={`rock-trajectory-${index}`}
            ref={(mesh) => {
              trajectoryDotRefs.current[index] = mesh;
            }}
            scale={0.035 + index * 0.0018}
            renderOrder={32}
          >
            <sphereGeometry args={[1, 7, 5]} />
            <meshBasicMaterial
              color={index < 9 ? "#ffd65c" : "#ff765f"}
              transparent
              opacity={0.82}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      {props.map((prop, index) => (
        <group
          key={prop.id}
          ref={(group) => {
            propRefs.current[index] = group;
          }}
          position={prop.direction
            .clone()
            .multiplyScalar(
              surfaceRadiusAt(prop.direction) + prop.scale * 0.72,
            )}
          quaternion={prop.orientation}
        >
          <mesh
            rotation={[0.08, index * 1.17, -0.05]}
            scale={[
              prop.scale * 1.25,
              prop.scale * 0.72,
              prop.scale * 0.95,
            ]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshToonMaterial color={prop.color} />
          </mesh>
          <mesh
            position={[
              prop.scale * 0.3,
              prop.scale * 0.32,
              prop.scale * -0.16,
            ]}
            rotation={[0.22, index * -0.81, 0.16]}
            scale={[
              prop.scale * 0.42,
              prop.scale * 0.22,
              prop.scale * 0.34,
            ]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshToonMaterial color={prop.accentColor} />
          </mesh>
        </group>
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
      castShadow
    >
      <planeGeometry args={size} />
      <meshToonMaterial
        color={color}
        side={DoubleSide}
        depthTest
        depthWrite
      />
    </mesh>
  );
}

function CountryFlagPattern({ biomeId }: { biomeId: BiomeKind }) {
  if (biomeId === "united-states") {
    const stripeHeight = 0.34 / 13;

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
            position={[
              0,
              0.17 - stripeHeight / 2 - stripe * stripeHeight * 2,
              0.003,
            ]}
            size={[0.56, stripeHeight + 0.001]}
          />
        ))}
        <FlagRectangle
          color="#315487"
          position={[
            -0.17,
            0.17 - (stripeHeight * 7) / 2,
            0.006,
          ]}
          size={[0.22, stripeHeight * 7]}
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
              depthWrite
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
          [-0.16, 0.105, "#224a93"],
          [0.16, 0.105, "#c63842"],
          [-0.16, -0.105, "#c63842"],
          [0.16, -0.105, "#224a93"],
        ].map(([x, y, color], panel) => (
          <FlagRectangle
            key={panel}
            color={color as string}
            position={[x as number, y as number, 0.003]}
            size={[0.24, 0.13]}
          />
        ))}
        <mesh position={[0, 0, 0.007]} renderOrder={41}>
          <circleGeometry args={[0.032, 12]} />
          <meshToonMaterial
            color="#438459"
            side={DoubleSide}
            depthWrite
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
            depthWrite
          />
        </mesh>
        <mesh position={[-0.035, 0.012, 0.007]} renderOrder={40}>
          <circleGeometry args={[0.072, 24]} />
          <meshBasicMaterial
            color="#cf343c"
            side={DoubleSide}
            depthWrite
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
            depthWrite
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
            depthWrite
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
            depthWrite
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
          depthWrite
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
    <HorizonOccludedGroup
      position={position}
      quaternion={orientation}
      revealHeight={0.14}
    >
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
        <group position={[0, 0, 0.006]}>
          <CountryFlagPattern biomeId={biome.id} />
        </group>
        <group
          position={[0, 0, -0.006]}
          rotation={[0, Math.PI, 0]}
        >
          <CountryFlagPattern biomeId={biome.id} />
        </group>
      </group>
    </HorizonOccludedGroup>
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
  const barnDirection = landmarkDirectionOnLand(
    unitedStates,
    directionFromOffset(unitedStates.center, 0.18, -0.04),
  );
  const koreaDirection = directionFromOffset(
    southKorea.center,
    0.12,
    -0.11,
  );
  const gardenHill = directionFromOffset(
    japan.center,
    -0.025,
    0.13,
  );

  return (
    <group>
      {mountainDirections.map((direction, index) => (
        <HorizonOccludedGroup
          key={`mountain-${index}`}
          position={direction
            .clone()
            .multiplyScalar(surfaceRadiusAt(direction) - 0.03)}
          quaternion={new Quaternion().setFromUnitVectors(UP, direction)}
          revealHeight={0.12}
        >
          <BlenderAsset
            name="landmark_mountain"
            rotation={[0, index * 0.8, 0]}
            scale={0.82 + index * 0.12}
          />
        </HorizonOccludedGroup>
      ))}

      <HorizonOccludedGroup
        position={barnDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(barnDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, barnDirection)}
        revealHeight={0}
      >
        <BlenderAsset
          name="ambient_barn"
          rotation={[0, -0.28, 0]}
          scale={0.78}
        />
      </HorizonOccludedGroup>

      <HorizonOccludedGroup
        position={beachDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(beachDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, beachDirection)}
        revealHeight={0.04}
      >
        <BlenderAsset
          name="scenery_new-jersey"
          rotation={[0, 0.2, 0]}
          scale={0.74}
        />
      </HorizonOccludedGroup>

      <HorizonOccludedGroup
        position={koreaDirection
          .clone()
          .multiplyScalar(surfaceRadiusAt(koreaDirection))}
        quaternion={new Quaternion().setFromUnitVectors(UP, koreaDirection)}
        revealHeight={0.06}
      >
        <BlenderAsset
          name="ambient_korean-pavilion"
          rotation={[0, 0.35, 0]}
          scale={0.78}
        />
      </HorizonOccludedGroup>

      <HorizonOccludedGroup
        position={gardenHill
          .clone()
          .multiplyScalar(surfaceRadiusAt(gardenHill))}
        quaternion={new Quaternion().setFromUnitVectors(UP, gardenHill)}
        revealHeight={0.08}
      >
        <BlenderAsset
          name="landmark_torii"
          rotation={[0, -0.18, 0]}
          scale={0.82}
        />
        <BlenderAsset
          name="bush_blossom"
          position={[-0.2, 0, 0.08]}
          scale={0.68}
        />
        <BlenderAsset
          name="bush_blossom"
          position={[0.21, 0, 0.06]}
          rotation={[0, 1.2, 0]}
          scale={0.58}
        />
      </HorizonOccludedGroup>
    </group>
  );
}

function BasePlanetoid({ skyPhase }: { skyPhase: SkyPhase }) {
  const geometry = useMemo(() => {
    const nextGeometry = new SphereGeometry(
      OCEAN_FLOOR_RADIUS,
      128,
      64,
    );
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={skyPhase === "night" ? "#020b19" : "#073247"}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function OceanBody({ skyPhase }: { skyPhase: SkyPhase }) {
  const geometry = useMemo(() => {
    const nextGeometry = new SphereGeometry(
      OCEAN_FLOOR_RADIUS + 0.025,
      128,
      64,
    );
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      castShadow
      renderOrder={-1}
    >
      <meshStandardMaterial
        color={skyPhase === "night" ? "#031328" : "#0b5263"}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function OceanDepthOccluder({ skyPhase }: { skyPhase: SkyPhase }) {
  const geometry = useMemo(() => {
    const nextGeometry = new SphereGeometry(
      OCEAN_SURFACE_RADIUS - 0.18,
      160,
      80,
    );
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      renderOrder={0}
    >
      <meshStandardMaterial
        color={skyPhase === "night" ? "#031b2d" : "#075365"}
        roughness={0.72}
        metalness={0.02}
      />
    </mesh>
  );
}

function createFishDefinitions() {
  const random = createSeededRandom(81_527);
  const colors = ["#e9b44c", "#e56b5d", "#63b7af", "#8ac0d0"];
  const definitions: FishDefinition[] = [];
  const schoolKinds: FishDefinition["kind"][] = [
    "fish",
    "fish",
    "fish",
    "dolphin",
    "shark",
  ];

  for (let school = 0; school < schoolKinds.length; school += 1) {
    const kind = schoolKinds[school];
    const center = new Vector3(1, 0, 0);

    for (let attempt = 0; attempt < 48; attempt += 1) {
      const longitude = random() * Math.PI * 2;
      const vertical = random() * 1.5 - 0.75;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      const candidate = new Vector3(
        Math.cos(longitude) * horizontal,
        vertical,
        Math.sin(longitude) * horizontal,
      ).normalize();

      if (
        isOceanDirection(candidate) &&
        oceanShoreProximityAt(candidate) < 0.2
      ) {
        center.copy(candidate);
        break;
      }
    }
    const { east, north } = tangentBasis(center);
    const travelDirection = east
      .clone()
      .multiplyScalar(0.75 + random() * 0.25)
      .addScaledVector(north, (random() - 0.5) * 0.55)
      .normalize();
    const orbitAxis = new Vector3()
      .crossVectors(center, travelDirection)
      .normalize();
    const schoolSpeed =
      kind === "fish"
        ? 0.018 + random() * 0.012
        : kind === "dolphin"
          ? 0.015 + random() * 0.008
          : 0.011 + random() * 0.006;
    const schoolSize =
      kind === "fish" ? 4 : kind === "dolphin" ? 3 : 2;

    for (let fish = 0; fish < schoolSize; fish += 1) {
      const fishDirection = center.clone();

      for (let attempt = 0; attempt < 16; attempt += 1) {
        const candidate = directionFromOffset(
          center,
          (random() - 0.5) * 0.18,
          (random() - 0.5) * 0.12,
        );

        if (
          isOceanDirection(candidate) &&
          oceanShoreProximityAt(candidate) < 0.32
        ) {
          fishDirection.copy(candidate);
          break;
        }
      }

      definitions.push({
        id: `fish-${school}-${fish}`,
        kind,
        direction: fishDirection,
        orbitAxis: orbitAxis.clone(),
        phase: (random() - 0.5) * 0.08,
        speed: schoolSpeed * (0.92 + random() * 0.16),
        bobPhase: random() * Math.PI * 2,
        scale:
          kind === "fish"
            ? 0.78 + random() * 0.42
            : kind === "dolphin"
              ? 1.05 + random() * 0.2
              : 1.18 + random() * 0.24,
        color:
          kind === "fish"
            ? colors[(school + fish) % colors.length]
            : kind === "dolphin"
              ? "#7599a6"
              : "#66757b",
        reactsToTraveler: random() < 0.62,
      });
    }
  }

  return definitions;
}

function SchoolFish({
  definition,
  tailRef,
}: {
  definition: FishDefinition;
  tailRef: MutableRefObject<Group | null>;
}) {
  return (
    <>
      <mesh scale={[0.055, 0.06, 0.15]} castShadow renderOrder={4}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <group ref={tailRef} position={[0, 0, -0.16]}>
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.075, 0.07, 0.045]}
          castShadow
          renderOrder={4}
        >
          <coneGeometry args={[1, 1, 3]} />
          <meshToonMaterial color={definition.color} />
        </mesh>
      </group>
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
    </>
  );
}

function Shark({
  definition,
  tailRef,
}: {
  definition: FishDefinition;
  tailRef: MutableRefObject<Group | null>;
}) {
  return (
    <>
      <mesh scale={[0.075, 0.065, 0.24]} castShadow renderOrder={4}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh
        position={[0, -0.035, 0.04]}
        scale={[0.057, 0.018, 0.15]}
        renderOrder={5}
      >
        <sphereGeometry args={[1, 10, 6]} />
        <meshToonMaterial color="#c8d1d0" />
      </mesh>
      <mesh
        position={[0, 0.09, -0.035]}
        rotation={[0, 0, Math.PI]}
        scale={[0.06, 0.1, 0.045]}
        castShadow
        renderOrder={4}
      >
        <coneGeometry args={[1, 1, 3]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.075, -0.01, -0.015]}
          rotation={[0, 0, side * -1.05]}
          scale={[0.085, 0.035, 0.055]}
          castShadow
          renderOrder={4}
        >
          <coneGeometry args={[1, 1, 3]} />
          <meshToonMaterial color={definition.color} />
        </mesh>
      ))}
      <group ref={tailRef} position={[0, 0, -0.25]}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.035, 0, -0.035]}
            rotation={[0, 0, side * -0.72]}
            scale={[0.07, 0.12, 0.04]}
            castShadow
            renderOrder={4}
          >
            <coneGeometry args={[1, 1, 3]} />
            <meshToonMaterial color={definition.color} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.04, 0.018, 0.185]} renderOrder={5}>
        <sphereGeometry args={[0.012, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
      <mesh position={[-0.04, 0.018, 0.185]} renderOrder={5}>
        <sphereGeometry args={[0.012, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
    </>
  );
}

function Dolphin({
  definition,
  tailRef,
}: {
  definition: FishDefinition;
  tailRef: MutableRefObject<Group | null>;
}) {
  return (
    <>
      <mesh scale={[0.07, 0.06, 0.23]} castShadow renderOrder={4}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh
        position={[0, -0.005, 0.245]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        renderOrder={4}
      >
        <cylinderGeometry args={[0.018, 0.032, 0.13, 8]} />
        <meshToonMaterial color="#829faa" />
      </mesh>
      <mesh
        position={[0, 0.08, -0.045]}
        rotation={[0, 0, Math.PI]}
        scale={[0.052, 0.09, 0.04]}
        castShadow
        renderOrder={4}
      >
        <coneGeometry args={[1, 1, 3]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.067, -0.018, -0.01]}
          rotation={[0, 0, side * -1.08]}
          scale={[0.075, 0.028, 0.05]}
          castShadow
          renderOrder={4}
        >
          <coneGeometry args={[1, 1, 3]} />
          <meshToonMaterial color={definition.color} />
        </mesh>
      ))}
      <group ref={tailRef} position={[0, 0, -0.235]}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.045, 0, -0.025]}
            rotation={[0, 0, side * -0.92]}
            scale={[0.085, 0.04, 0.035]}
            castShadow
            renderOrder={4}
          >
            <coneGeometry args={[1, 1, 3]} />
            <meshToonMaterial color={definition.color} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.033, 0.018, 0.175]} renderOrder={5}>
        <sphereGeometry args={[0.011, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
      <mesh position={[-0.033, 0.018, 0.175]} renderOrder={5}>
        <sphereGeometry args={[0.011, 6, 5]} />
        <meshBasicMaterial color="#17232a" />
      </mesh>
    </>
  );
}

function SwimmingFish({
  definition,
  reduceMotion,
  exploreMode,
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  traversalModeRef,
  waterSurfaceRef,
}: {
  definition: FishDefinition;
  reduceMotion: boolean;
  exploreMode: boolean;
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  traversalModeRef: MutableRefObject<"boat" | "land" | "swim">;
  waterSurfaceRef: MutableRefObject<OceanSurfaceApi | null>;
}) {
  const groupRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const directionRef = useRef(definition.direction.clone());
  const headingRef = useRef(
    new Vector3()
      .crossVectors(definition.orbitAxis, definition.direction)
      .normalize(),
  );
  const positionRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());
  const desiredHeadingRef = useRef(new Vector3());
  const movementAxisRef = useRef(new Vector3());
  const aheadDirectionRef = useRef(new Vector3());
  const leftHeadingRef = useRef(new Vector3());
  const rightHeadingRef = useRef(new Vector3());
  const leftDirectionRef = useRef(new Vector3());
  const rightDirectionRef = useRef(new Vector3());
  const travelerAwayRef = useRef(new Vector3());
  const occlusionRayRef = useRef(new Vector3());
  const occlusionPointRef = useRef(new Vector3());
  const tailPhaseRef = useRef(definition.bobPhase);
  const scurryStrengthRef = useRef(0);
  const scurryActiveRef = useRef(false);
  const diveStrengthRef = useRef(0);

  useFrame(({ clock, camera }, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const frameDelta = Math.min(delta, 0.05);
    const elapsed = reduceMotion ? 0 : clock.elapsedTime;
    const direction = directionRef.current;
    const heading = headingRef.current;
    const travelerDirection = travelerDirectionRef.current;
    const travelerAngle = angularDistance(
      direction,
      travelerDirection,
    );
    const kayakThreat =
      exploreMode &&
      traversalModeRef.current === "boat" &&
      Math.abs(movementVelocityRef.current) > 0.025 &&
      travelerAngle < FISH_KAYAK_AVOID_ANGLE;

    if (
      exploreMode &&
      definition.reactsToTraveler &&
      !reduceMotion
    ) {
      if (
        !scurryActiveRef.current &&
        travelerAngle < FISH_SCURRY_ENTER_ANGLE
      ) {
        scurryActiveRef.current = true;
      } else if (
        scurryActiveRef.current &&
        travelerAngle > FISH_SCURRY_EXIT_ANGLE
      ) {
        scurryActiveRef.current = false;
      }
    } else {
      scurryActiveRef.current = false;
    }

    const collisionAvoidance = exploreMode
      ? 1 -
        MathUtils.smoothstep(
          travelerAngle,
          kayakThreat ? 0.055 : 0.035,
          kayakThreat ? FISH_KAYAK_AVOID_ANGLE : 0.11,
        )
      : 0;
    const targetScurry = Math.max(
      scurryActiveRef.current ? 1 : 0,
      collisionAvoidance,
    );
    scurryStrengthRef.current = MathUtils.damp(
      scurryStrengthRef.current,
      targetScurry,
      targetScurry > scurryStrengthRef.current ? 7.5 : 2.6,
      frameDelta,
    );
    const scurryStrength = scurryStrengthRef.current;
    const targetDive = kayakThreat
      ? MathUtils.smoothstep(collisionAvoidance, 0.05, 0.72)
      : 0;
    diveStrengthRef.current = MathUtils.damp(
      diveStrengthRef.current,
      targetDive,
      targetDive > diveStrengthRef.current ? 10 : 2.8,
      frameDelta,
    );

    if (!reduceMotion) {
      const speciesBoost =
        definition.kind === "fish"
          ? 7.2
          : definition.kind === "dolphin"
            ? 6.2
            : 4.8;
      const desiredHeading = desiredHeadingRef.current.copy(heading);
      const lookAheadAngle = 0.11;
      const movementAxis = movementAxisRef.current
        .crossVectors(direction, heading)
        .normalize();
      const aheadDirection = aheadDirectionRef.current
        .copy(direction)
        .applyAxisAngle(movementAxis, lookAheadAngle)
        .normalize();
      const aheadShore = oceanShoreProximityAt(aheadDirection);

      if (
        !isOceanDirection(aheadDirection) ||
        aheadShore > FISH_SHORE_AVOIDANCE
      ) {
        const leftHeading = leftHeadingRef.current
          .copy(heading)
          .applyAxisAngle(direction, 0.76)
          .normalize();
        const rightHeading = rightHeadingRef.current
          .copy(heading)
          .applyAxisAngle(direction, -0.76)
          .normalize();
        const leftDirection = leftDirectionRef.current
          .copy(direction)
          .applyAxisAngle(
            movementAxisRef.current
              .crossVectors(direction, leftHeading)
              .normalize(),
            lookAheadAngle,
          )
          .normalize();
        const leftScore =
          (isOceanDirection(leftDirection) ? 0 : 10) +
          oceanShoreProximityAt(leftDirection);
        const rightDirection = rightDirectionRef.current
          .copy(direction)
          .applyAxisAngle(
            movementAxisRef.current
              .crossVectors(direction, rightHeading)
              .normalize(),
            lookAheadAngle,
          )
          .normalize();
        const rightScore =
          (isOceanDirection(rightDirection) ? 0 : 10) +
          oceanShoreProximityAt(rightDirection);

        desiredHeading.copy(
          leftScore <= rightScore ? leftHeading : rightHeading,
        );
      }

      if (collisionAvoidance > 0.01) {
        const predictedTraveler = aheadDirectionRef.current
          .copy(travelerDirection)
          .addScaledVector(
            travelerForwardRef.current,
            kayakThreat ? 0.055 : 0.018,
          )
          .normalize();
        const travelerAway = travelerAwayRef.current
          .copy(predictedTraveler)
          .addScaledVector(
            direction,
            -predictedTraveler.dot(direction),
          )
          .multiplyScalar(-1);

        if (travelerAway.lengthSq() > 0.00001) {
          travelerAway.normalize();
          desiredHeading
            .lerp(
              travelerAway,
              Math.min(0.94, collisionAvoidance * 0.92),
            )
            .normalize();
        }
      }

      heading
        .lerp(
          desiredHeading,
          1 -
            Math.exp(
              -frameDelta *
                (aheadShore > FISH_SHORE_AVOIDANCE ? 10 : 5.5),
            ),
        )
        .addScaledVector(direction, -heading.dot(direction))
        .normalize();
      const swimAngle =
        definition.speed *
        (1 + scurryStrength * speciesBoost) *
        frameDelta;
      const swimAxis = movementAxisRef.current
        .crossVectors(direction, heading)
        .normalize();
      const nextDirection = aheadDirectionRef.current
        .copy(direction)
        .applyAxisAngle(swimAxis, swimAngle)
        .normalize();

      if (
        isOceanDirection(nextDirection) &&
        oceanShoreProximityAt(nextDirection) < 0.46
      ) {
        direction.copy(nextDirection);
        heading
          .applyAxisAngle(swimAxis, swimAngle)
          .addScaledVector(direction, -heading.dot(direction))
          .normalize();
      } else {
        heading.applyAxisAngle(
          direction,
          frameDelta * (definition.phase >= 0 ? 2.2 : -2.2),
        );
      }

      tailPhaseRef.current +=
        frameDelta *
        (definition.kind === "fish" ? 7.5 : 5.5) *
      (1 + scurryStrength * 0.8);
    }

    const shoreProximity = oceanShoreProximityAt(direction);
    const baseDepth =
      definition.kind === "fish"
        ? 0.2
        : definition.kind === "dolphin"
          ? 0.255
          : 0.29;
    const swimDepth =
      baseDepth +
      diveStrengthRef.current * 0.24 +
      (reduceMotion
        ? 0
        : Math.sin(elapsed * 1.35 + definition.bobPhase) * 0.012);
    const waterRadius =
      waterSurfaceRef.current?.sampleRadius(direction) ??
      OCEAN_SURFACE_RADIUS;
    const position = positionRef.current
      .copy(direction)
      .multiplyScalar(waterRadius - swimDepth);
    const hiddenByWorld = isOccludedBySphere(
      position,
      camera.position,
      OCEAN_FLOOR_RADIUS + 0.06,
      occlusionRayRef.current,
      occlusionPointRef.current,
    );

    group.visible =
      isOceanDirection(direction) &&
      shoreProximity < 0.42 &&
      !hiddenByWorld;

    if (!group.visible) {
      return;
    }

    group.position.copy(position);
    group.up.copy(direction);
    group.lookAt(lookTargetRef.current.copy(position).add(heading));
    group.rotation.z = reduceMotion
      ? 0
      : Math.sin(elapsed * 3.2 + definition.bobPhase) * 0.08;

    if (tailRef.current) {
      tailRef.current.rotation.y = reduceMotion
        ? 0
        : Math.sin(tailPhaseRef.current) *
          (0.2 + scurryStrength * 0.22);
    }
  });

  return (
    <group ref={groupRef} scale={definition.scale}>
      {definition.kind === "shark" ? (
        <Shark definition={definition} tailRef={tailRef} />
      ) : definition.kind === "dolphin" ? (
        <Dolphin definition={definition} tailRef={tailRef} />
      ) : (
        <SchoolFish definition={definition} tailRef={tailRef} />
      )}
    </group>
  );
}

function OceanLife({
  reduceMotion,
  exploreMode,
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  traversalModeRef,
  waterSurfaceRef,
}: {
  reduceMotion: boolean;
  exploreMode: boolean;
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  traversalModeRef: MutableRefObject<"boat" | "land" | "swim">;
  waterSurfaceRef: MutableRefObject<OceanSurfaceApi | null>;
}) {
  const fish = useMemo(createFishDefinitions, []);

  return (
    <group>
      {fish.map((definition) => (
        <SwimmingFish
          key={definition.id}
          definition={definition}
          reduceMotion={reduceMotion}
          exploreMode={exploreMode}
          travelerDirectionRef={travelerDirectionRef}
          travelerForwardRef={travelerForwardRef}
          movementVelocityRef={movementVelocityRef}
          traversalModeRef={traversalModeRef}
          waterSurfaceRef={waterSurfaceRef}
        />
      ))}
    </group>
  );
}

function createBirdDefinitions() {
  const random = createSeededRandom(47_119);
  const colors = ["#f2eee2", "#d7d2c8", "#5e6970", "#8b7767"];
  const definitions: BirdDefinition[] = [];

  for (let flock = 0; flock < BIOMES.length; flock += 1) {
    const center = directionFromOffset(
      BIOMES[flock].center,
      (random() - 0.5) * BIOMES[flock].angularRadius * 0.7,
      (random() - 0.5) * BIOMES[flock].angularRadius * 0.5,
    );
    const { east, north } = tangentBasis(center);
    const travelDirection = east
      .clone()
      .multiplyScalar(0.76 + random() * 0.22)
      .addScaledVector(north, (random() - 0.5) * 0.56)
      .normalize();
    const orbitAxis = new Vector3()
      .crossVectors(center, travelDirection)
      .normalize();
    const cycleDuration = 90;
    const activeDuration = 90;
    const flightSpeed = 0.024 + random() * 0.012;
    const cycleOffset = 0;

    for (let bird = 0; bird < 3; bird += 1) {
      definitions.push({
        id: `bird-${flock}-${bird}`,
        direction: directionFromOffset(
          center,
          (bird - 1) * 0.024 + (random() - 0.5) * 0.012,
          Math.abs(bird - 1) * -0.018 + (random() - 0.5) * 0.01,
        ),
        orbitAxis: orbitAxis.clone(),
        phase: (bird - 1) * -0.018,
        speed: flightSpeed,
        altitude: 0.72 + random() * 0.48,
        scale: 1.02 + random() * 0.32,
        color: colors[(flock + bird) % colors.length],
        cycleDuration,
        activeDuration,
        cycleOffset,
      });
    }
  }

  return definitions;
}

function FlyingBird({
  definition,
  reduceMotion,
  skyPhase,
  travelerDirectionRef,
}: {
  definition: BirdDefinition;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
  travelerDirectionRef: MutableRefObject<Vector3>;
}) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);
  const directionRef = useRef(new Vector3());
  const positionRef = useRef(new Vector3());
  const tangentRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());
  const occlusionRayRef = useRef(new Vector3());
  const occlusionPointRef = useRef(new Vector3());

  useFrame(({ clock, camera }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const elapsed = clock.elapsedTime;
    const active = skyPhase !== "night";

    if (!active) {
      group.visible = false;
      return;
    }

    const fade = 1;
    const direction = directionRef.current
      .copy(definition.direction)
      .applyAxisAngle(
        definition.orbitAxis,
        (reduceMotion ? 0 : elapsed) * definition.speed +
          definition.phase,
      )
      .normalize();

    const surfaceRadius = Math.max(
      OCEAN_SURFACE_RADIUS,
      surfaceRadiusAt(direction),
    );
    const altitude =
      definition.altitude +
      Math.sin(elapsed * 1.15 + definition.phase * 20) * 0.035;
    const position = positionRef.current
      .copy(direction)
      .multiplyScalar(surfaceRadius + altitude);
    const hiddenByWorld = isOccludedBySphere(
      position,
      camera.position,
      OCEAN_SURFACE_RADIUS + 0.035,
      occlusionRayRef.current,
      occlusionPointRef.current,
    );

    group.visible =
      !hiddenByWorld &&
      direction.dot(travelerDirectionRef.current) > -0.18;

    if (!group.visible) {
      return;
    }

    const tangent = tangentRef.current
      .crossVectors(definition.orbitAxis, direction)
      .normalize();

    group.position.copy(position);
    group.up.copy(direction);
    group.lookAt(lookTargetRef.current.copy(position).add(tangent));
    group.scale.setScalar(definition.scale * Math.max(0, fade));

    const flap = reduceMotion
      ? 0.35
      : Math.sin(elapsed * 8.6 + definition.phase * 37) * 0.5 + 0.5;

    if (leftWingRef.current) {
      leftWingRef.current.rotation.z = -0.18 - flap * 0.72;
    }

    if (rightWingRef.current) {
      rightWingRef.current.rotation.z = 0.18 + flap * 0.72;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh scale={[0.045, 0.042, 0.12]} castShadow>
        <sphereGeometry args={[1, 12, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh position={[0, 0.012, 0.105]} castShadow>
        <sphereGeometry args={[0.043, 10, 7]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
      <mesh
        position={[0, 0.004, 0.162]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.026, 0.055, 0.026]}
      >
        <coneGeometry args={[1, 1, 8]} />
        <meshToonMaterial color="#d7a744" />
      </mesh>
      <group ref={leftWingRef} position={[-0.035, 0.012, 0]}>
        <mesh
          position={[-0.065, 0, -0.005]}
          rotation={[0, 0.1, 0]}
          scale={[0.13, 0.015, 0.07]}
          castShadow
        >
          <sphereGeometry args={[1, 8, 5]} />
          <meshToonMaterial color={definition.color} />
        </mesh>
      </group>
      <group ref={rightWingRef} position={[0.035, 0.012, 0]}>
        <mesh
          position={[0.065, 0, -0.005]}
          rotation={[0, -0.1, 0]}
          scale={[0.13, 0.015, 0.07]}
          castShadow
        >
          <sphereGeometry args={[1, 8, 5]} />
          <meshToonMaterial color={definition.color} />
        </mesh>
      </group>
      <mesh
        position={[0, 0.015, -0.115]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.052, 0.065, 0.028]}
      >
        <coneGeometry args={[1, 1, 3]} />
        <meshToonMaterial color={definition.color} />
      </mesh>
    </group>
  );
}

function AmbientBirds({
  reduceMotion,
  skyPhase,
  travelerDirectionRef,
}: {
  reduceMotion: boolean;
  skyPhase: SkyPhase;
  travelerDirectionRef: MutableRefObject<Vector3>;
}) {
  const birds = useMemo(createBirdDefinitions, []);

  return (
    <group>
      {birds.map((definition) => (
        <FlyingBird
          key={definition.id}
          definition={definition}
          reduceMotion={reduceMotion}
          skyPhase={skyPhase}
          travelerDirectionRef={travelerDirectionRef}
        />
      ))}
    </group>
  );
}

export function PlanetoidWorld({
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  traversalModeRef,
  waterSurfaceRef,
  loosePropInteractionRef,
  onLoosePropImpact,
  onLoosePropSplash,
  onVegetationBrush,
  exploreMode,
  reduceMotion,
  skyPhase,
  solarDirection,
}: PlanetoidWorldProps) {
  return (
    <group>
      <BasePlanetoid skyPhase={skyPhase} />
      <OceanBody skyPhase={skyPhase} />
      <OceanDepthOccluder skyPhase={skyPhase} />
      <OceanSurface
        travelerDirectionRef={travelerDirectionRef}
        travelerForwardRef={travelerForwardRef}
        movementVelocityRef={movementVelocityRef}
        traversalModeRef={traversalModeRef}
        waterSurfaceRef={waterSurfaceRef}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
        skyPhase={skyPhase}
        solarDirection={solarDirection}
      />
      <OceanLife
        reduceMotion={reduceMotion}
        exploreMode={exploreMode}
        travelerDirectionRef={travelerDirectionRef}
        travelerForwardRef={travelerForwardRef}
        movementVelocityRef={movementVelocityRef}
        traversalModeRef={traversalModeRef}
        waterSurfaceRef={waterSurfaceRef}
      />
      <AmbientBirds
        reduceMotion={reduceMotion}
        skyPhase={skyPhase}
        travelerDirectionRef={travelerDirectionRef}
      />

      {BIOMES.map((biome) => (
        <group key={biome.id}>
          <TerrainChunk
            biome={biome}
            reduceMotion={reduceMotion}
            skyPhase={skyPhase}
            solarDirection={solarDirection}
          />
          <BiomePaths biome={biome} />
          <CoastlineFoam
            biome={biome}
            reduceMotion={reduceMotion}
          />
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
          solarDirection={solarDirection}
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
      <SurfaceDetailField />
      <VegetationField
        travelerDirectionRef={travelerDirectionRef}
        movementVelocityRef={movementVelocityRef}
        traversalModeRef={traversalModeRef}
        onVegetationBrush={onVegetationBrush}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
      />
      <LooseProps
        travelerDirectionRef={travelerDirectionRef}
        travelerForwardRef={travelerForwardRef}
        movementVelocityRef={movementVelocityRef}
        waterSurfaceRef={waterSurfaceRef}
        interactionRef={loosePropInteractionRef}
        onLoosePropImpact={onLoosePropImpact}
        onLoosePropSplash={onLoosePropSplash}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
      />
    </group>
  );
}
