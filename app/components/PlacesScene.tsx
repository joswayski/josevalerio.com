import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Body,
  EquatorFromVector,
  GeoVector,
  RotateVector,
  Rotation_EQJ_EQD,
  SiderealTime,
} from "astronomy-engine";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  MathUtils,
  Object3D,
  Quaternion,
  Vector3,
  type Group,
  type InstancedBufferAttribute,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Points,
} from "three";
import { places, type Place, type PlaceTerrain } from "../data/places";
import {
  OCEAN_SURFACE_RADIUS,
  PLACE_DIRECTIONS,
  PLANET_RADIUS,
  isWaterDirection,
  sphericalDirection,
  surfaceRadiusAt as planetSurfaceRadiusAt,
  traversalModeAt,
  traversalSurfaceRadiusAt,
  type TraversalMode,
} from "../data/planetoid";
import { PlanetoidWorld } from "./PlanetoidWorld";

export type ExploreInput = {
  horizontal: number;
  vertical: number;
  cameraOrbit: number;
  running: boolean;
  zoom: number;
  jumpReady: boolean;
  jumpSequence: number;
};

export type SkyPhase = "day" | "twilight" | "night";

type PlacesSceneProps = {
  selectedPlaceId: string;
  exploreMode: boolean;
  exploreInputRef: MutableRefObject<ExploreInput>;
  reduceMotion: boolean;
  projectionRef: RefObject<HTMLButtonElement | null>;
  onSelect: (placeId: string) => void;
  onNearbyChange: (placeId: string | null) => void;
  onFootstep: (
    movementBlend: number,
    runBlend: number,
    stepIndex: number,
  ) => void;
  onTraversalAudio: (
    traversalMode: TraversalMode,
    movementBlend: number,
  ) => void;
  onWaterStroke: (
    traversalMode: Extract<TraversalMode, "boat" | "swim">,
    movementBlend: number,
    strokeIndex: number,
  ) => void;
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
};

const WALK_SPEED = 0.17;
const RUN_SPEED = 0.36;
const SWIM_SPEED = 0.12;
const FAST_SWIM_SPEED = 0.21;
const BOAT_SPEED = 0.2;
const FAST_BOAT_SPEED = 0.34;
const START_DISTANCE = 0.38;
const NEARBY_ENTER_ANGLE = 0.075;
const NEARBY_EXIT_ANGLE = 0.105;
const NEARBY_SWITCH_ADVANTAGE = 0.012;
const JUMP_DURATION = 0.52;
const JUMP_LANDING_DELAY = 0.22;
const JUMP_CYCLE_DURATION = JUMP_DURATION + JUMP_LANDING_DELAY;
const WORLD_SCALE = PLANET_RADIUS / 6;
const BROWSE_CAMERA_POSITION = new Vector3(
  0,
  0.45 * WORLD_SCALE,
  18.8 * WORLD_SCALE,
);
const CLOSE_CAMERA_HEIGHT = 9.4 * WORLD_SCALE;
const CLOSE_CAMERA_TRAIL = 4.2 * WORLD_SCALE;
const CLOSE_TARGET_HEIGHT = 5 * WORLD_SCALE;
const CLOSE_TARGET_LEAD = 2.6 * WORLD_SCALE;
const OVERVIEW_CAMERA_HEIGHT = 21 * WORLD_SCALE;
const OVERVIEW_CAMERA_TRAIL = 6 * WORLD_SCALE;
const OVERVIEW_TARGET_HEIGHT = 0.5 * WORLD_SCALE;
const OVERVIEW_TARGET_LEAD = 3 * WORLD_SCALE;
const DEFAULT_CAMERA_DISTANCE = 0.3;
const CAMERA_DISTANCE_RATE = 0.75;
const CAMERA_ORBIT_SPEED = 0.85;
const CAMERA_ORBIT_RESPONSE = 2.1;
const CAMERA_ORBIT_RELEASE = 1.65;
const CAMERA_ORBIT_DRAG_SENSITIVITY = 0.006;
const CAMERA_ORBIT_ANGLE_RESPONSE = 8;
const CAMERA_FOLLOW_RESPONSE = 4;
const TRAVELER_TURN_RESPONSE = 9;
const TRAVELER_RENDER_ORDER = 20;
const TRAVELER_GROUND_CLEARANCE = 0.01;
const HORIZON_CLIP_MARGIN = 0.035;
const DESTINATION_HORIZON_REVEAL_HEIGHT = 1.25;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const FOCUS_DIRECTION = new Vector3(0, -0.24, 0.97).normalize();
const CELESTIAL_UPDATE_INTERVAL = 20;

type CelestialBodyDefinition = {
  body: Body;
  color: string;
  emissive: string;
  radius: number;
  distance: number;
  ring?: {
    color: string;
    innerRadius: number;
    outerRadius: number;
  };
};

const CELESTIAL_BODIES: CelestialBodyDefinition[] = [
  {
    body: Body.Moon,
    color: "#c8c5bc",
    emissive: "#5d5f63",
    radius: 0.72,
    distance: 30,
  },
  {
    body: Body.Mercury,
    color: "#aaa49a",
    emissive: "#4b4843",
    radius: 0.24,
    distance: 35,
  },
  {
    body: Body.Venus,
    color: "#e7d4a8",
    emissive: "#7a673d",
    radius: 0.4,
    distance: 37,
  },
  {
    body: Body.Mars,
    color: "#b75e43",
    emissive: "#642f25",
    radius: 0.34,
    distance: 39,
  },
  {
    body: Body.Jupiter,
    color: "#d8b58d",
    emissive: "#654b35",
    radius: 0.88,
    distance: 44,
  },
  {
    body: Body.Saturn,
    color: "#d8c696",
    emissive: "#665a3c",
    radius: 0.68,
    distance: 48,
    ring: {
      color: "#cdbd98",
      innerRadius: 0.86,
      outerRadius: 1.34,
    },
  },
];

type CloudDefinition = {
  id: string;
  kind: "cumulus" | "storm" | "stratus";
  coordinates: [longitude: number, latitude: number];
  seed: number;
  width: number;
  puffCount: number;
  altitude: number;
  rain: boolean;
};

type CloudPuff = {
  basePosition: Vector3;
  currentPosition: Vector3;
  velocity: Vector3;
  baseScale: Vector3;
  rotation: Quaternion;
  driftDirection: Vector3;
  scatterDirection: Vector3;
  opacity: number;
  phase: number;
};

const CLOUD_INTERACTION_RADIUS = 1.75;

function createSessionCloudDefinitions(): CloudDefinition[] {
  const cloudCount = 7 + Math.floor(Math.random() * 3);

  return Array.from({ length: cloudCount }, (_, index) => {
    const roll = Math.random();
    const kind: CloudDefinition["kind"] =
      index === 0
        ? "stratus"
        : index === 1
          ? "storm"
          : roll < 0.2
            ? "stratus"
            : roll < 0.36
              ? "storm"
              : "cumulus";
    const width =
      kind === "stratus"
        ? 3.8 + Math.random() * 1.8
        : kind === "storm"
          ? 2.8 + Math.random() * 1.25
          : 1.6 + Math.random() * 1.15;
    const puffCount =
      kind === "stratus"
        ? 88 + Math.floor(Math.random() * 26)
        : kind === "storm"
          ? 82 + Math.floor(Math.random() * 28)
          : 54 + Math.floor(Math.random() * 28);
    const altitude =
      kind === "cumulus"
        ? 1 + Math.random() * 0.42
        : 0.72 + Math.random() * 0.3;

    return {
      id: `session-cloud-${index}`,
      kind,
      coordinates: [
        Math.random() * 360 - 180,
        Math.random() * 116 - 58,
      ],
      seed: Math.floor(Math.random() * 100_000) + index * 997,
      width,
      puffCount,
      altitude,
      rain: kind === "storm" && Math.random() < 0.3,
    };
  });
}

function createStarPositions(count: number) {
  const positions = new Float32Array(count * 3);
  let seed = 0x5f3759df;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };

  for (let index = 0; index < count; index += 1) {
    const longitude = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const radius = 32 + random() * 25;
    const offset = index * 3;

    positions[offset] = Math.cos(longitude) * horizontal * radius;
    positions[offset + 1] = vertical * radius;
    positions[offset + 2] = Math.sin(longitude) * horizontal * radius;
  }

  return positions;
}

function StarField({
  skyPhase,
  reduceMotion,
}: {
  skyPhase: SkyPhase;
  reduceMotion: boolean;
}) {
  const pointsRef = useRef<Points>(null);
  const positions = useMemo(() => createStarPositions(520), []);
  const opacity =
    skyPhase === "night" ? 0.88 : skyPhase === "twilight" ? 0.26 : 0.035;

  useFrame((_, delta) => {
    if (pointsRef.current && !reduceMotion) {
      pointsRef.current.rotation.y += delta * 0.0025;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={skyPhase === "day" ? "#f7fbff" : "#ffffff"}
        size={skyPhase === "night" ? 1.45 : 1.1}
        sizeAttenuation={false}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function CelestialBodyModel({
  definition,
  skyPhase,
  exploreMode,
  observerDirectionRef,
  solarDirection,
  occlusionVisibilityRef,
}: {
  definition: CelestialBodyDefinition;
  skyPhase: SkyPhase;
  exploreMode: boolean;
  observerDirectionRef: MutableRefObject<Vector3>;
  solarDirection: [number, number, number];
  occlusionVisibilityRef: MutableRefObject<number>;
}) {
  const bodyMaterialRef = useRef<MeshStandardMaterial>(null);
  const haloMaterialRef = useRef<MeshBasicMaterial>(null);
  const ringMaterialRef = useRef<MeshStandardMaterial>(null);
  const observerDirection = useRef(new Vector3());
  const normalizedSolarDirection = useMemo(
    () => new Vector3(...solarDirection).normalize(),
    [solarDirection],
  );
  const initialVisibility = 0;

  useFrame(({ camera }, delta) => {
    const bodyMaterial = bodyMaterialRef.current;
    const haloMaterial = haloMaterialRef.current;

    if (!bodyMaterial || !haloMaterial) {
      return;
    }

    const observer = observerDirection.current
      .copy(
        exploreMode
          ? observerDirectionRef.current
          : camera.position,
      )
      .normalize();
    const sunlight = observer.dot(normalizedSolarDirection);
    const nightVisibility =
      1 - MathUtils.smoothstep(sunlight, -0.08, 0.22);
    const skyVisibility =
      skyPhase === "night" ? 1 : skyPhase === "twilight" ? 0.2 : 0.002;
    const targetOpacity =
      MathUtils.lerp(0.001, skyVisibility, nightVisibility) *
      occlusionVisibilityRef.current;
    const opacity = MathUtils.damp(
      bodyMaterial.opacity,
      targetOpacity,
      4,
      Math.min(delta, 0.05),
    );

    bodyMaterial.opacity = opacity;
    bodyMaterial.emissiveIntensity = MathUtils.lerp(
      0.015,
      0.34,
      opacity,
    );
    haloMaterial.opacity = opacity * 0.16;

    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = opacity * 0.84;
      ringMaterialRef.current.emissiveIntensity =
        bodyMaterial.emissiveIntensity * 0.7;
    }
  });

  return (
    <>
      <mesh scale={1.18}>
        <sphereGeometry args={[definition.radius, 16, 12]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color={definition.emissive}
          transparent
          opacity={initialVisibility * 0.16}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[definition.radius, 20, 14]} />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={definition.color}
          emissive={definition.emissive}
          emissiveIntensity={MathUtils.lerp(
            0.015,
            0.34,
            initialVisibility,
          )}
          roughness={0.86}
          metalness={0}
          transparent
          opacity={initialVisibility}
          depthWrite={false}
        />
      </mesh>

      {definition.ring ? (
        <mesh rotation={[0.48, 0, 0]}>
          <ringGeometry
            args={[
              definition.ring.innerRadius,
              definition.ring.outerRadius,
              36,
            ]}
          />
          <meshStandardMaterial
            ref={ringMaterialRef}
            color={definition.ring.color}
            emissive={definition.emissive}
            emissiveIntensity={
              MathUtils.lerp(0.015, 0.34, initialVisibility) * 0.7
            }
            side={DoubleSide}
            transparent
            opacity={initialVisibility * 0.84}
            roughness={0.9}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  );
}

function CelestialSky({
  skyPhase,
  exploreMode,
  observerDirectionRef,
  solarDirection,
}: {
  skyPhase: SkyPhase;
  exploreMode: boolean;
  observerDirectionRef: MutableRefObject<Vector3>;
  solarDirection: [number, number, number];
}) {
  const bodyRefs = useRef<Array<Group | null>>([]);
  const bodyTargetPositionsRef = useRef(
    CELESTIAL_BODIES.map(() => new Vector3()),
  );
  const bodyWasInitializedRef = useRef(
    CELESTIAL_BODIES.map(() => false),
  );
  const bodyOcclusionVisibilityRefs = useRef(
    CELESTIAL_BODIES.map(() => ({ current: 0 })),
  );
  const cameraToBodyRef = useRef(new Vector3());
  const closestApproachRef = useRef(new Vector3());
  const lastUpdateRef = useRef(Number.NEGATIVE_INFINITY);
  const { camera } = useThree();

  useFrame(({ clock }, delta) => {
    const shouldUpdate =
      clock.elapsedTime - lastUpdateRef.current >=
      CELESTIAL_UPDATE_INTERVAL;

    if (shouldUpdate) {
      lastUpdateRef.current = clock.elapsedTime;

      const now = new Date();
      const equatorOfDate = Rotation_EQJ_EQD(now);
      const greenwichSiderealDegrees = SiderealTime(now) * 15;

      CELESTIAL_BODIES.forEach((definition, index) => {
        const group = bodyRefs.current[index];

        if (!group) {
          return;
        }

        const equatorial = EquatorFromVector(
          RotateVector(
            equatorOfDate,
            GeoVector(definition.body, now, true),
          ),
        );
        const earthFixedLongitude =
          MathUtils.euclideanModulo(
            equatorial.ra * 15 - greenwichSiderealDegrees + 180,
            360,
          ) - 180;
        const targetPosition = bodyTargetPositionsRef.current[index].copy(
          latLonToVector3(
            [earthFixedLongitude, equatorial.dec],
            definition.distance * WORLD_SCALE,
          ),
        );

        if (!bodyWasInitializedRef.current[index]) {
          group.position.copy(targetPosition);
        }

        bodyWasInitializedRef.current[index] = true;
      });
    }

    const ease = 1 - Math.exp(-Math.min(delta, 0.05) * 4.5);

    CELESTIAL_BODIES.forEach((definition, index) => {
      const group = bodyRefs.current[index];

      if (!group || !bodyWasInitializedRef.current[index]) {
        return;
      }

      group.position.lerp(bodyTargetPositionsRef.current[index], ease);

      const cameraToBody = cameraToBodyRef.current
        .copy(group.position)
        .sub(camera.position);
      const bodyDistance = cameraToBody.length();
      let targetOcclusionVisibility = 1;

      if (bodyDistance > 0.0001) {
        cameraToBody.multiplyScalar(1 / bodyDistance);
        const closestDistanceAlongRay = -camera.position.dot(cameraToBody);

        if (
          closestDistanceAlongRay > 0 &&
          closestDistanceAlongRay < bodyDistance
        ) {
          const closestApproach = closestApproachRef.current
            .copy(camera.position)
            .addScaledVector(cameraToBody, closestDistanceAlongRay);
          const globeClearance =
            closestApproach.length() -
            (OCEAN_SURFACE_RADIUS + HORIZON_CLIP_MARGIN);

          targetOcclusionVisibility = MathUtils.smoothstep(
            globeClearance,
            0,
            definition.radius + 0.5,
          );
        }
      }

      const visibilityRef = bodyOcclusionVisibilityRefs.current[index];
      visibilityRef.current = MathUtils.damp(
        visibilityRef.current,
        targetOcclusionVisibility,
        9,
        Math.min(delta, 0.05),
      );

      if (definition.body === Body.Saturn) {
        group.lookAt(camera.position);
      }
    });
  });

  return (
    <group>
      {CELESTIAL_BODIES.map((definition, index) => (
        <group
          key={definition.body}
          ref={(group) => {
            bodyRefs.current[index] = group;
          }}
        >
          <CelestialBodyModel
            definition={definition}
            skyPhase={skyPhase}
            exploreMode={exploreMode}
            observerDirectionRef={observerDirectionRef}
            solarDirection={solarDirection}
            occlusionVisibilityRef={
              bodyOcclusionVisibilityRefs.current[index]
            }
          />
        </group>
      ))}
    </group>
  );
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function createCloudPuffs(definition: CloudDefinition) {
  const random = createSeededRandom(definition.seed);
  const centerDirection = latLonToVector3(definition.coordinates).normalize();
  const east = new Vector3().crossVectors(Y_AXIS, centerDirection);

  if (east.lengthSq() < 0.0001) {
    east.set(0, 0, 1);
  } else {
    east.normalize();
  }

  const north = new Vector3()
    .crossVectors(centerDirection, east)
    .normalize();
  const surfaceRadius = traversalSurfaceRadiusAt(centerDirection);
  const puffs: CloudPuff[] = [];
  const coreCount = Math.floor(definition.puffCount * 0.72);
  const surfaceOrientation = new Quaternion().setFromUnitVectors(
    UP,
    centerDirection,
  );

  for (let index = 0; index < definition.puffCount; index += 1) {
    const isCore = index < coreCount;
    let eastOffset: number;
    let northOffset: number;
    let radialOffset: number;
    let radius: number;

    if (definition.kind === "stratus") {
      eastOffset = (random() - 0.5) * definition.width * 1.18;
      northOffset =
        (random() - 0.5) * definition.width * 0.34 +
        Math.sin((eastOffset / definition.width) * Math.PI * 1.5) *
          definition.width *
          0.045;
      radialOffset =
        definition.altitude +
        (random() + random() - 1) * definition.width * 0.04;
      radius = 0.22 + random() * 0.18;
    } else {
      const horizontalAngle = random() * Math.PI * 2;
      const horizontalDistribution = isCore
        ? Math.pow(random(), 0.82) * 0.72
        : 0.62 + Math.pow(random(), 0.5) * 0.38;
      const horizontalRadius =
        horizontalDistribution *
        definition.width *
        (definition.kind === "storm" ? 0.42 : 0.52);
      eastOffset = Math.cos(horizontalAngle) * horizontalRadius;
      northOffset =
        Math.sin(horizontalAngle) *
        horizontalRadius *
        (definition.kind === "storm" ? 0.66 : 0.82);
      const verticalSpread =
        definition.width *
        (definition.kind === "storm"
          ? isCore
            ? 0.22
            : 0.3
          : isCore
            ? 0.11
            : 0.17);
      radialOffset =
        definition.kind === "storm"
          ? definition.altitude +
            (Math.pow(random(), 0.7) - 0.22) * verticalSpread
          : definition.altitude +
            (random() + random() - 1) * verticalSpread;
      radius =
        definition.kind === "storm"
          ? isCore
            ? 0.3 + random() * 0.22
            : 0.2 + random() * 0.2
          : isCore
            ? 0.25 + random() * 0.2
            : 0.14 + random() * 0.17;
    }

    const basePosition = centerDirection
      .clone()
      .multiplyScalar(surfaceRadius + radialOffset)
      .addScaledVector(east, eastOffset)
      .addScaledVector(north, northOffset);
    const scatterAngle = random() * Math.PI * 2;
    const rotationAxis = new Vector3(
      random() - 0.5,
      random() - 0.5,
      random() - 0.5,
    );

    if (rotationAxis.lengthSq() < 0.0001) {
      rotationAxis.copy(UP);
    } else {
      rotationAxis.normalize();
    }

    const rotation =
      definition.kind === "cumulus"
        ? new Quaternion().setFromAxisAngle(
            rotationAxis,
            random() * Math.PI * 2,
          )
        : surfaceOrientation
            .clone()
            .multiply(
              new Quaternion().setFromAxisAngle(
                UP,
                random() * Math.PI * 2,
              ),
            );
    const baseScale =
      definition.kind === "stratus"
        ? new Vector3(
            radius * (1.55 + random() * 0.6),
            radius * (0.38 + random() * 0.2),
            radius * (1.2 + random() * 0.55),
          )
        : definition.kind === "storm"
          ? new Vector3(
              radius * (1 + random() * 0.38),
              radius * (1.15 + random() * 0.6),
              radius * (1 + random() * 0.38),
            )
          : new Vector3(
              radius * (1.05 + random() * 0.48),
              radius * (0.7 + random() * 0.3),
              radius * (1 + random() * 0.5),
            );
    const opacity =
      definition.kind === "storm"
        ? isCore
          ? 0.42 + random() * 0.16
          : 0.24 + random() * 0.15
        : definition.kind === "stratus"
          ? isCore
            ? 0.28 + random() * 0.12
            : 0.14 + random() * 0.11
          : isCore
            ? 0.36 + random() * 0.16
            : 0.16 + random() * 0.14;

    puffs.push({
      basePosition,
      currentPosition: basePosition.clone(),
      velocity: new Vector3(),
      baseScale,
      rotation,
      driftDirection: east
        .clone()
        .multiplyScalar(0.65 + random() * 0.35)
        .addScaledVector(north, (random() - 0.5) * 0.45)
        .normalize(),
      scatterDirection: east
        .clone()
        .multiplyScalar(Math.cos(scatterAngle))
        .addScaledVector(north, Math.sin(scatterAngle))
        .normalize(),
      opacity,
      phase: random() * Math.PI * 2,
    });
  }

  return { centerDirection, puffs };
}

type RainDrop = {
  x: number;
  z: number;
  phase: number;
  speed: number;
  scale: number;
};

function RainShower({
  definition,
  centerDirection,
  reduceMotion,
}: {
  definition: CloudDefinition;
  centerDirection: Vector3;
  reduceMotion: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const transformRef = useRef(new Object3D());
  const drops = useMemo(() => {
    const random = createSeededRandom(definition.seed + 17_911);

    return Array.from({ length: 38 }, (): RainDrop => {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * definition.width * 0.32;

      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius * 0.72,
        phase: random(),
        speed: 0.42 + random() * 0.48,
        scale: 0.65 + random() * 0.65,
      };
    });
  }, [definition]);
  const surfaceRadius = traversalSurfaceRadiusAt(centerDirection);
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, centerDirection),
    [centerDirection],
  );
  const position = useMemo(
    () =>
      centerDirection
        .clone()
        .multiplyScalar(surfaceRadius + definition.altitude - 0.02),
    [centerDirection, definition.altitude, surfaceRadius],
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const travel = definition.altitude + 0.18;

    drops.forEach((drop, index) => {
      const progress = reduceMotion
        ? drop.phase
        : (drop.phase + clock.elapsedTime * drop.speed) % 1;
      const transform = transformRef.current;

      transform.position.set(drop.x, 0.08 - progress * travel, drop.z);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(drop.scale, drop.scale, drop.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={position} quaternion={orientation}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, drops.length]}
        frustumCulled={false}
        renderOrder={3}
      >
        <cylinderGeometry args={[0.006, 0.009, 0.16, 5]} />
        <meshBasicMaterial
          color="#9cc9d7"
          transparent
          opacity={0.44}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

function CloudCluster({
  definition,
  travelerDirectionRef,
  exploreMode,
  reduceMotion,
  skyPhase,
}: {
  definition: CloudDefinition;
  travelerDirectionRef: MutableRefObject<Vector3>;
  exploreMode: boolean;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
}) {
  const cloud = useMemo(
    () => createCloudPuffs(definition),
    [definition],
  );
  const cloudMeshRef = useRef<InstancedMesh | null>(null);
  const opacityAttributeRef =
    useRef<InstancedBufferAttribute | null>(null);
  const transformRef = useRef(new Object3D());
  const travelerPositionRef = useRef(new Vector3());
  const targetPositionRef = useRef(new Vector3());
  const separationRef = useRef(new Vector3());
  const lateralRef = useRef(new Vector3());
  const cloudColor = definition.kind === "storm"
    ? skyPhase === "night"
      ? "#6e7d88"
      : "#b9c6c8"
    : definition.kind === "stratus"
      ? skyPhase === "night"
        ? "#a8b4bd"
        : skyPhase === "twilight"
          ? "#d8dcda"
          : "#e8ece8"
    : skyPhase === "night"
      ? "#b8c3ca"
      : skyPhase === "twilight"
        ? "#e8e9e6"
        : "#f7f5ef";
  const cloudUniforms = useMemo(
    () => ({
      cloudColor: { value: new Color(cloudColor) },
      cloudUp: { value: cloud.centerDirection.clone() },
    }),
    [cloud.centerDirection, cloudColor],
  );
  const initialOpacities = useMemo(
    () => new Float32Array(cloud.puffs.map((puff) => puff.opacity)),
    [cloud.puffs],
  );

  useFrame(({ clock }, delta) => {
    const cloudMesh = cloudMeshRef.current;
    const opacityAttribute = opacityAttributeRef.current;

    if (!cloudMesh || !opacityAttribute) {
      return;
    }

    const travelerDirection = travelerDirectionRef.current;
    const travelerPosition = travelerPositionRef.current
      .copy(travelerDirection)
      .multiplyScalar(
        traversalSurfaceRadiusAt(travelerDirection) + 0.34,
      );
    const easeDelta = Math.min(delta, 0.05);

    cloud.puffs.forEach((puff, index) => {
      const drift = reduceMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.34 + puff.phase) * 0.055;
      const targetPosition = targetPositionRef.current
        .copy(puff.basePosition)
        .addScaledVector(puff.driftDirection, drift);
      const separation = separationRef.current
        .copy(puff.currentPosition)
        .sub(travelerPosition);
      const distance = separation.length();
      const interaction =
        exploreMode && distance < CLOUD_INTERACTION_RADIUS
          ? 1 -
            MathUtils.smoothstep(
              distance,
              0.22,
              CLOUD_INTERACTION_RADIUS,
            )
          : 0;

      if (interaction > 0) {
        const lateral = lateralRef.current
          .copy(separation)
          .addScaledVector(
            cloud.centerDirection,
            -separation.dot(cloud.centerDirection),
          );

        if (lateral.lengthSq() < 0.0001) {
          lateral.copy(puff.scatterDirection);
        } else {
          lateral.normalize();
        }

        puff.velocity
          .addScaledVector(
            lateral,
            interaction * easeDelta * 5.8,
          )
          .addScaledVector(
            cloud.centerDirection,
            interaction * easeDelta * 1.35,
          );
      }

      puff.velocity.multiplyScalar(
        Math.exp(-easeDelta * 5.1),
      );
      puff.currentPosition.addScaledVector(
        puff.velocity,
        easeDelta,
      );
      const response = interaction > 0.01 ? 0.62 : 1.55;
      puff.currentPosition.lerp(
        targetPosition,
        1 - Math.exp(-easeDelta * response),
      );
      const cloudOffset = separationRef.current
        .copy(puff.currentPosition)
        .sub(targetPosition);

      if (cloudOffset.lengthSq() > 1.44) {
        puff.currentPosition
          .copy(targetPosition)
          .addScaledVector(cloudOffset.normalize(), 1.2);
        puff.velocity.multiplyScalar(0.35);
      }
      const breathing = reduceMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.5 + puff.phase) * 0.025;
      const interactionScale = MathUtils.lerp(1, 0.84, interaction);
      const transform = transformRef.current;

      transform.position.copy(puff.currentPosition);
      transform.quaternion.copy(puff.rotation);
      transform.scale
        .copy(puff.baseScale)
        .multiplyScalar((1 + breathing) * interactionScale);
      transform.updateMatrix();
      cloudMesh.setMatrixAt(index, transform.matrix);
      opacityAttribute.setX(
        index,
        puff.opacity * (1 - interaction * 0.74),
      );
    });

    cloudMesh.instanceMatrix.needsUpdate = true;
    opacityAttribute.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={cloudMeshRef}
        args={[undefined, undefined, cloud.puffs.length]}
        frustumCulled={false}
        renderOrder={4}
      >
        <icosahedronGeometry args={[1, 1]}>
          <instancedBufferAttribute
            ref={opacityAttributeRef}
            attach="attributes-instanceOpacity"
            args={[initialOpacities, 1]}
          />
        </icosahedronGeometry>
        <shaderMaterial
          uniforms={cloudUniforms}
          vertexShader={`
          attribute float instanceOpacity;
          varying float vOpacity;
          varying vec3 vViewNormal;
          varying vec3 vViewDirection;
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;

          void main() {
            vec4 instancePosition =
              instanceMatrix * vec4(position, 1.0);
            vec4 viewPosition =
              modelViewMatrix * instancePosition;
            vec4 worldPosition =
              modelMatrix * instancePosition;
            vec3 instanceNormal =
              mat3(instanceMatrix) * normal;

            vOpacity = instanceOpacity;
            vViewNormal = normalize(
              normalMatrix * instanceNormal
            );
            vViewDirection = normalize(-viewPosition.xyz);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(
              mat3(modelMatrix) * instanceNormal
            );
            gl_Position =
              projectionMatrix * viewPosition;
          }
        `}
          fragmentShader={`
          uniform vec3 cloudColor;
          uniform vec3 cloudUp;
          varying float vOpacity;
          varying vec3 vViewNormal;
          varying vec3 vViewDirection;
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;

          float hash(vec3 value) {
            return fract(sin(dot(
              value,
              vec3(12.9898, 78.233, 37.719)
            )) * 43758.5453);
          }

          void main() {
            float facing = abs(dot(
              normalize(vViewNormal),
              normalize(vViewDirection)
            ));
            float edge = pow(
              smoothstep(0.025, 0.68, facing),
              0.48
            );
            float erosion = mix(
              0.82,
              1.04,
              hash(floor(vWorldPosition * 11.0))
            );
            float density = edge * erosion;

            if (density < 0.055) {
              discard;
            }

            vec3 faceNormal = normalize(cross(
              dFdx(vWorldPosition),
              dFdy(vWorldPosition)
            ));

            if (dot(faceNormal, vWorldNormal) < 0.0) {
              faceNormal *= -1.0;
            }

            float topLight = dot(
              faceNormal,
              normalize(cloudUp + vec3(0.18, 0.3, 0.12))
            );
            float light = clamp(
              0.82 + topLight * 0.12 + facing * 0.1,
              0.72,
              1.06
            );
            light = floor(light * 5.0 + 0.5) / 5.0;
            vec3 shadedColor =
              cloudColor * light * mix(0.94, 1.06, density);

            gl_FragColor = vec4(
              shadedColor,
              min(vOpacity * density, 0.94)
            );
          }
        `}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </instancedMesh>
      {definition.rain ? (
        <RainShower
          definition={definition}
          centerDirection={cloud.centerDirection}
          reduceMotion={reduceMotion}
        />
      ) : null}
    </>
  );
}

function CloudLayer({
  travelerDirectionRef,
  exploreMode,
  reduceMotion,
  skyPhase,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  exploreMode: boolean;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
}) {
  const definitions = useMemo(createSessionCloudDefinitions, []);

  return (
    <group>
      {definitions.map((definition) => (
        <CloudCluster
          key={definition.id}
          definition={definition}
          travelerDirectionRef={travelerDirectionRef}
          exploreMode={exploreMode}
          reduceMotion={reduceMotion}
          skyPhase={skyPhase}
        />
      ))}
    </group>
  );
}

type DustParticleState = {
  active: boolean;
  water: boolean;
  age: number;
  duration: number;
  baseScale: number;
  position: Vector3;
  velocity: Vector3;
  gravity: Vector3;
};

const DUST_PARTICLE_COUNT = 16;

function SurfaceParticles({
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const particleRefs = useRef<Array<Mesh | null>>([]);
  const particlesRef = useRef<DustParticleState[]>(
    Array.from({ length: DUST_PARTICLE_COUNT }, () => ({
      active: false,
      water: false,
      age: 0,
      duration: 0.58,
      baseScale: 1,
      position: new Vector3(),
      velocity: new Vector3(),
      gravity: new Vector3(),
    })),
  );
  const spawnAccumulatorRef = useRef(0);
  const nextParticleRef = useRef(0);
  const spawnSequenceRef = useRef(0);
  const rightRef = useRef(new Vector3());

  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    const travelerDirection = travelerDirectionRef.current;
    const movementSpeed = Math.abs(movementVelocityRef.current);
    const traversalMode = traversalModeAt(travelerDirection);
    const onWater = isWaterDirection(travelerDirection);
    const movementBlend = MathUtils.clamp(
      movementSpeed /
        (traversalMode === "boat"
          ? FAST_BOAT_SPEED
          : onWater
            ? FAST_SWIM_SPEED
            : RUN_SPEED),
      0,
      1,
    );
    const canSpawn =
      exploreMode &&
      traversalMode !== "boat" &&
      movementBlend > 0.08;

    if (canSpawn) {
      spawnAccumulatorRef.current += frameDelta;
      const spawnInterval = MathUtils.lerp(
        reduceMotion ? 0.2 : 0.14,
        reduceMotion ? 0.13 : 0.075,
        movementBlend,
      );

      while (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current -= spawnInterval;

        const particleIndex =
          nextParticleRef.current % DUST_PARTICLE_COUNT;
        const particle = particlesRef.current[particleIndex];
        const phase = spawnSequenceRef.current * 2.399963;
        const sideways = Math.sin(phase);
        const forward = travelerForwardRef.current;
        const right = rightRef.current
          .crossVectors(forward, travelerDirection)
          .normalize();
        const surfaceRadius = onWater
          ? traversalSurfaceRadiusAt(travelerDirection)
          : planetSurfaceRadiusAt(travelerDirection);

        particle.active = true;
        particle.water = onWater;
        particle.age = 0;
        particle.duration = onWater
          ? MathUtils.lerp(0.34, 0.54, movementBlend)
          : MathUtils.lerp(0.48, 0.72, movementBlend);
        particle.baseScale = onWater
          ? 0.012 + movementBlend * 0.015
          : 0.018 + movementBlend * 0.018;
        particle.position
          .copy(travelerDirection)
          .multiplyScalar(surfaceRadius + 0.018)
          .addScaledVector(right, sideways * 0.08)
          .addScaledVector(forward, -0.055);
        particle.velocity
          .copy(travelerDirection)
          .multiplyScalar(
            onWater
              ? 0.25 + movementBlend * 0.22
              : 0.13 + movementBlend * 0.15,
          )
          .addScaledVector(right, sideways * 0.12)
          .addScaledVector(forward, -0.06 - movementBlend * 0.05);
        particle.gravity
          .copy(travelerDirection)
          .multiplyScalar(-0.22);

        nextParticleRef.current += 1;
        spawnSequenceRef.current += 1;
      }
    } else {
      spawnAccumulatorRef.current = 0;
    }

    particlesRef.current.forEach((particle, index) => {
      const mesh = particleRefs.current[index];

      if (!mesh) {
        return;
      }

      if (!particle.active) {
        mesh.visible = false;
        return;
      }

      particle.age += frameDelta;

      if (particle.age >= particle.duration) {
        particle.active = false;
        mesh.visible = false;
        return;
      }

      const progress = particle.age / particle.duration;
      particle.velocity.addScaledVector(particle.gravity, frameDelta);
      particle.position.addScaledVector(particle.velocity, frameDelta);
      mesh.visible = true;
      mesh.position.copy(particle.position);
      mesh.scale.setScalar(
        particle.baseScale * MathUtils.lerp(0.75, 2.2, progress),
      );

      const material = mesh.material as MeshStandardMaterial;
      material.color.set(
        particle.water ? "#b8e3df" : "#d6b98f",
      );
      material.emissive.set(
        particle.water ? "#4d8d8b" : "#6b5134",
      );
      material.opacity =
        (1 - progress) * (particle.water ? 0.68 : 0.48);
    });
  });

  return (
    <group>
      {Array.from({ length: DUST_PARTICLE_COUNT }, (_, index) => (
        <mesh
          key={`surface-particle-${index}`}
          ref={(mesh) => {
            particleRefs.current[index] = mesh;
          }}
          visible={false}
          renderOrder={6}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#d6b98f"
            emissive="#6b5134"
            emissiveIntensity={0.08}
            transparent
            opacity={0}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

const BOAT_WAKE_SAMPLE_COUNT = 44;
const BOAT_WAKE_VERTICES_PER_SAMPLE = 6;

function createBoatWakeGeometry() {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(
    BOAT_WAKE_SAMPLE_COUNT * BOAT_WAKE_VERTICES_PER_SAMPLE * 3,
  );
  const colors = new Float32Array(positions.length);
  const indices: number[] = [];
  const positionAttribute = new Float32BufferAttribute(positions, 3);
  const colorAttribute = new Float32BufferAttribute(colors, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  colorAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", colorAttribute);

  for (let sample = 0; sample < BOAT_WAKE_SAMPLE_COUNT - 1; sample += 1) {
    const current = sample * BOAT_WAKE_VERTICES_PER_SAMPLE;
    const next = (sample + 1) * BOAT_WAKE_VERTICES_PER_SAMPLE;

    for (let strip = 0; strip < 3; strip += 1) {
      const offset = strip * 2;
      indices.push(
        current + offset,
        next + offset,
        current + offset + 1,
        current + offset + 1,
        next + offset,
        next + offset + 1,
      );
    }
  }

  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function BoatWake({
  travelerDirectionRef,
  travelerForwardRef,
  movementVelocityRef,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  travelerForwardRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(createBoatWakeGeometry, []);
  const samplesRef = useRef(
    Array.from({ length: BOAT_WAKE_SAMPLE_COUNT }, () => ({
      direction: new Vector3(0, 1, 0),
      forward: new Vector3(0, 0, 1),
    })),
  );
  const initializedRef = useRef(false);
  const wasBoatingRef = useRef(false);
  const lastSampleDirectionRef = useRef(new Vector3(0, 1, 0));
  const strengthRef = useRef(0);
  const rightRef = useRef(new Vector3());
  const vertexDirectionRef = useRef(new Vector3());
  const foamColorRef = useRef(new Color());
  const brightFoam = useMemo(() => new Color("#effff7"), []);
  const oldFoam = useMemo(() => new Color("#66aaa9"), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    const travelerDirection = travelerDirectionRef.current;
    const travelerForward = travelerForwardRef.current;
    const traversalMode = traversalModeAt(travelerDirection);
    const movementBlend = MathUtils.clamp(
      Math.abs(movementVelocityRef.current) / FAST_BOAT_SPEED,
      0,
      1,
    );
    const boating = exploreMode && traversalMode === "boat";
    const samples = samplesRef.current;
    const startingBoatSession = boating && !wasBoatingRef.current;

    if (!initializedRef.current || startingBoatSession) {
      samples.forEach((sample) => {
        sample.direction.copy(travelerDirection);
        sample.forward.copy(travelerForward);
      });
      lastSampleDirectionRef.current.copy(travelerDirection);
      initializedRef.current = true;

      if (startingBoatSession) {
        strengthRef.current = 0;
      }
    }

    wasBoatingRef.current = boating;

    const targetStrength = boating
      ? MathUtils.smoothstep(movementBlend, 0.04, 0.9)
      : 0;
    strengthRef.current = MathUtils.damp(
      strengthRef.current,
      targetStrength,
      targetStrength > strengthRef.current ? 3.2 : 1.55,
      frameDelta,
    );

    const sampleDistance = Math.acos(
      MathUtils.clamp(
        lastSampleDirectionRef.current.dot(travelerDirection),
        -1,
        1,
      ),
    );

    if (
      boating &&
      movementBlend > 0.025 &&
      sampleDistance > (reduceMotion ? 0.012 : 0.006)
    ) {
      for (let index = samples.length - 1; index > 0; index -= 1) {
        samples[index].direction.copy(samples[index - 1].direction);
        samples[index].forward.copy(samples[index - 1].forward);
      }

      samples[0].direction.copy(travelerDirection);
      samples[0].forward.copy(travelerForward);
      lastSampleDirectionRef.current.copy(travelerDirection);
    }

    const positions = geometry.getAttribute(
      "position",
    ) as Float32BufferAttribute;
    const colors = geometry.getAttribute("color") as Float32BufferAttribute;
    const wakeRadius = OCEAN_SURFACE_RADIUS + 0.035;

    const setWakeVertex = (
      vertexIndex: number,
      direction: Vector3,
      right: Vector3,
      lateralOffset: number,
      color: Color,
    ) => {
      const vertex = vertexDirectionRef.current
        .copy(direction)
        .addScaledVector(right, lateralOffset / OCEAN_SURFACE_RADIUS)
        .normalize()
        .multiplyScalar(wakeRadius);
      positions.setXYZ(vertexIndex, vertex.x, vertex.y, vertex.z);
      colors.setXYZ(vertexIndex, color.r, color.g, color.b);
    };

    samples.forEach((sample, sampleIndex) => {
      const progress = sampleIndex / (BOAT_WAKE_SAMPLE_COUNT - 1);
      const right = rightRef.current
        .crossVectors(sample.forward, sample.direction)
        .normalize();
      const spread = 0.052 + progress * 0.34;
      const branchWidth =
        MathUtils.lerp(0.018, 0.008, progress) *
        (0.8 + strengthRef.current * 0.35);
      const turbulence =
        Math.sin(
          sampleIndex * 1.61 -
            clock.elapsedTime * (reduceMotion ? 0 : 1.35),
        ) *
        0.012 *
        progress;
      const centerWidth = MathUtils.lerp(0.035, 0.006, progress);
      const color = foamColorRef.current
        .copy(brightFoam)
        .lerp(oldFoam, progress * 0.88)
        .multiplyScalar(1 - progress * 0.23);
      const vertexOffset =
        sampleIndex * BOAT_WAKE_VERTICES_PER_SAMPLE;

      setWakeVertex(
        vertexOffset,
        sample.direction,
        right,
        -spread - branchWidth,
        color,
      );
      setWakeVertex(
        vertexOffset + 1,
        sample.direction,
        right,
        -spread + branchWidth,
        color,
      );
      setWakeVertex(
        vertexOffset + 2,
        sample.direction,
        right,
        spread - branchWidth,
        color,
      );
      setWakeVertex(
        vertexOffset + 3,
        sample.direction,
        right,
        spread + branchWidth,
        color,
      );
      setWakeVertex(
        vertexOffset + 4,
        sample.direction,
        right,
        turbulence - centerWidth,
        color,
      );
      setWakeVertex(
        vertexOffset + 5,
        sample.direction,
        right,
        turbulence + centerWidth,
        color,
      );
    });

    positions.needsUpdate = true;
    colors.needsUpdate = true;

    if (meshRef.current) {
      const material = meshRef.current.material as MeshBasicMaterial;
      material.opacity = strengthRef.current * 0.68;
      meshRef.current.visible = strengthRef.current > 0.012;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      visible={false}
      renderOrder={8}
      frustumCulled={false}
    >
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function latLonToVector3(
  [longitude, latitude]: [number, number],
  radius = 1,
) {
  const latitudeRadians = MathUtils.degToRad(latitude);
  const longitudeRadians = MathUtils.degToRad(longitude);
  const ringRadius = radius * Math.cos(latitudeRadians);

  return new Vector3(
    -ringRadius * Math.cos(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    ringRadius * Math.sin(longitudeRadians),
  );
}

function isAboveGlobeHorizon(
  worldPosition: Vector3,
  cameraPosition: Vector3,
) {
  const worldRadius = worldPosition.length();

  if (
    worldRadius === 0 ||
    cameraPosition.lengthSq() <= OCEAN_SURFACE_RADIUS ** 2
  ) {
    return false;
  }

  const occluderRadius =
    OCEAN_SURFACE_RADIUS + HORIZON_CLIP_MARGIN;

  return (
    worldPosition.dot(cameraPosition) >
    occluderRadius * occluderRadius
  );
}

function terrainColor(terrain: PlaceTerrain) {
  switch (terrain) {
    case "coast":
      return "#d9aa62";
    case "mountain":
      return "#87958b";
    default:
      return "#cf625b";
  }
}

function CityDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.052, 0.105, 0.01]} castShadow>
        <boxGeometry args={[0.065, 0.18, 0.06]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0.022, 0.14, -0.015]} castShadow>
        <boxGeometry args={[0.07, 0.25, 0.07]} />
        <meshStandardMaterial color="#f2c876" flatShading />
      </mesh>
      <mesh position={[0.083, 0.08, 0.027]} castShadow>
        <boxGeometry args={[0.052, 0.13, 0.052]} />
        <meshStandardMaterial color="#6f8f89" flatShading />
      </mesh>
    </group>
  );
}

function CoastDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.042, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.018, 0.2, 6]} />
        <meshStandardMaterial color="#725344" flatShading />
      </mesh>
      <mesh position={[-0.042, 0.22, 0]} rotation={[0, 0.35, 0]} castShadow>
        <coneGeometry args={[0.095, 0.12, 5]} />
        <meshStandardMaterial color="#62897a" flatShading />
      </mesh>
      <mesh position={[0.067, 0.075, 0.012]} rotation={[0, 0.4, 0]} castShadow>
        <tetrahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  );
}

function MountainDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.045, 0.105, 0]} rotation={[0, 0.35, 0]} castShadow>
        <coneGeometry args={[0.11, 0.22, 5]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0.075, 0.075, 0.025]} rotation={[0, -0.2, 0]} castShadow>
        <coneGeometry args={[0.08, 0.15, 5]} />
        <meshStandardMaterial color="#d7c7ae" flatShading />
      </mesh>
    </group>
  );
}

function LighthouseDiorama() {
  return (
    <group>
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.034, 0.052, 0.22, 8]} />
        <meshStandardMaterial color="#f0e5d4" flatShading />
      </mesh>
      <mesh position={[0, 0.205, 0]}>
        <cylinderGeometry args={[0.036, 0.044, 0.035, 8]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
      <mesh position={[0, 0.275, 0]} castShadow>
        <coneGeometry args={[0.061, 0.075, 8]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
    </group>
  );
}

function SailboatDiorama() {
  return (
    <group>
      <mesh position={[0, 0.055, 0]} scale={[1, 0.48, 0.58]} castShadow>
        <dodecahedronGeometry args={[0.105, 0]} />
        <meshStandardMaterial color="#d9aa62" flatShading />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
        <meshStandardMaterial color="#725344" flatShading />
      </mesh>
      <mesh
        position={[0.045, 0.185, 0]}
        rotation={[0, 0, -0.18]}
        scale={[0.68, 1, 0.18]}
        castShadow
      >
        <coneGeometry args={[0.09, 0.18, 3]} />
        <meshStandardMaterial color="#f2c876" flatShading />
      </mesh>
    </group>
  );
}

function BarbecueDiorama() {
  return (
    <group>
      <mesh position={[0, 0.13, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.17, 8]} />
        <meshStandardMaterial color="#343f42" flatShading />
      </mesh>
      <mesh position={[0.055, 0.225, 0]}>
        <cylinderGeometry args={[0.014, 0.018, 0.13, 6]} />
        <meshStandardMaterial color="#343f42" flatShading />
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.045, 0]} rotation={[0, 0, x * 2.2]}>
          <boxGeometry args={[0.018, 0.11, 0.018]} />
          <meshStandardMaterial color="#725344" flatShading />
        </mesh>
      ))}
      <mesh position={[-0.035, 0.185, 0.048]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.065, 0.018, 0.018]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
    </group>
  );
}

function OrangeDiorama() {
  return (
    <group>
      <mesh position={[0, 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.024, 0.16, 6]} />
        <meshStandardMaterial color="#725344" flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <icosahedronGeometry args={[0.09, 1]} />
        <meshStandardMaterial color="#e4973f" flatShading />
      </mesh>
      <mesh
        position={[0.04, 0.285, 0]}
        rotation={[0, 0, -0.55]}
        scale={[1, 0.35, 0.55]}
      >
        <icosahedronGeometry args={[0.065, 1]} />
        <meshStandardMaterial color="#62897a" flatShading />
      </mesh>
    </group>
  );
}

function MosqueDiorama() {
  return (
    <group>
      <mesh position={[-0.018, 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.085, 0.14, 8]} />
        <meshStandardMaterial color="#f0e5d4" flatShading />
      </mesh>
      <mesh position={[-0.018, 0.19, 0]} scale={[1, 0.58, 1]} castShadow>
        <sphereGeometry args={[0.078, 8, 5]} />
        <meshStandardMaterial color="#6f8f89" flatShading />
      </mesh>
      <mesh position={[0.095, 0.155, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.025, 0.27, 8]} />
        <meshStandardMaterial color="#f0e5d4" flatShading />
      </mesh>
      <mesh position={[0.095, 0.3, 0]}>
        <coneGeometry args={[0.028, 0.07, 8]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
    </group>
  );
}

function TowerDiorama() {
  return (
    <group>
      <mesh position={[0, 0.145, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.04, 0.25, 6]} />
        <meshStandardMaterial color="#f0e5d4" flatShading />
      </mesh>
      <mesh position={[0, 0.225, 0]} castShadow>
        <dodecahedronGeometry args={[0.058, 0]} />
        <meshStandardMaterial color="#6f8f89" flatShading />
      </mesh>
      <mesh position={[0, 0.315, 0]}>
        <coneGeometry args={[0.014, 0.14, 5]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
    </group>
  );
}

function ToriiDiorama() {
  return (
    <group>
      {[-0.065, 0.065].map((x) => (
        <mesh key={x} position={[x, 0.13, 0]} castShadow>
          <boxGeometry args={[0.025, 0.24, 0.035]} />
          <meshStandardMaterial color="#d04842" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.225, 0]} castShadow>
        <boxGeometry args={[0.19, 0.026, 0.045]} />
        <meshStandardMaterial color="#d04842" flatShading />
      </mesh>
      <mesh position={[0, 0.265, 0]} castShadow>
        <boxGeometry args={[0.23, 0.025, 0.052]} />
        <meshStandardMaterial color="#b93e38" flatShading />
      </mesh>
    </group>
  );
}

function SushiDiorama() {
  return (
    <group rotation={[0, 0.28, 0]}>
      <mesh position={[0, 0.105, 0]} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.095]} />
        <meshStandardMaterial color="#f0e5d4" flatShading />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[0.175, 0.045, 0.105]} />
        <meshStandardMaterial color="#d76c56" flatShading />
      </mesh>
      <mesh position={[0, 0.125, 0.051]}>
        <boxGeometry args={[0.04, 0.105, 0.012]} />
        <meshStandardMaterial color="#2f4945" flatShading />
      </mesh>
    </group>
  );
}

function PlaceDiorama({ place, color }: { place: Place; color: string }) {
  switch (place.landmark) {
    case "barbecue":
      return <BarbecueDiorama />;
    case "lighthouse":
      return <LighthouseDiorama />;
    case "mosque":
      return <MosqueDiorama />;
    case "mountain":
      return <MountainDiorama color={color} />;
    case "orange":
      return <OrangeDiorama />;
    case "palm":
      return <CoastDiorama color={color} />;
    case "sailboat":
      return <SailboatDiorama />;
    case "sushi":
      return <SushiDiorama />;
    case "torii":
      return <ToriiDiorama />;
    case "tower":
      return <TowerDiorama />;
    default:
      return <CityDiorama color={color} />;
  }
}

function PhotoProjection({
  projectionRef,
  travelerDirectionRef,
  exploreMode,
}: {
  projectionRef: RefObject<HTMLButtonElement | null>;
  travelerDirectionRef: MutableRefObject<Vector3>;
  exploreMode: boolean;
}) {
  const anchorRef = useRef<Group>(null);
  const projectedPositionRef = useRef(new Vector3());
  const travelerProjectedPositionRef = useRef(new Vector3());
  const { camera, gl } = useThree();

  useEffect(
    () => () => {
      const projection = projectionRef.current;

      if (projection) {
        projection.style.opacity = "0";
        projection.style.pointerEvents = "none";
        projection.style.visibility = "hidden";
        projection.tabIndex = -1;
        projection.setAttribute("aria-hidden", "true");
      }
    },
    [projectionRef],
  );

  useFrame(({ clock }) => {
    const anchor = anchorRef.current;
    const projection = projectionRef.current;

    if (!anchor || !projection) {
      return;
    }

    anchor.position.y = 1.42 + Math.sin(clock.elapsedTime * 1.45) * 0.025;
    anchor.updateWorldMatrix(true, false);

    const projectedPosition = projectedPositionRef.current;
    anchor.getWorldPosition(projectedPosition);
    const aboveHorizon = isAboveGlobeHorizon(
      projectedPosition,
      camera.position,
    );
    projectedPosition.project(camera);

    const visible =
      aboveHorizon &&
      projectedPosition.z > -1 &&
      projectedPosition.z < 1 &&
      Math.abs(projectedPosition.x) < 1.2 &&
      Math.abs(projectedPosition.y) < 1.2;
    const x = (projectedPosition.x * 0.5 + 0.5) * gl.domElement.clientWidth;
    const y = (-projectedPosition.y * 0.5 + 0.5) * gl.domElement.clientHeight;
    const stageWidth = gl.domElement.clientWidth;
    const stageHeight = gl.domElement.clientHeight;
    const cardWidth = projection.offsetWidth;
    const cardHeight = projection.offsetHeight;
    const margin = 12;
    const gap = 12;
    let left = x - cardWidth / 2;
    let top = y - cardHeight - gap;

    if (top < margin) {
      const roomOnRight = stageWidth - x - gap;
      const roomOnLeft = x - gap;
      left =
        roomOnRight >= cardWidth || roomOnRight >= roomOnLeft
          ? x + gap
          : x - cardWidth - gap;
      top = y - cardHeight / 2;
    }

    left = MathUtils.clamp(left, margin, stageWidth - cardWidth - margin);
    top = MathUtils.clamp(top, margin, stageHeight - cardHeight - margin);

    if (exploreMode) {
      const travelerProjectedPosition = travelerProjectedPositionRef.current
        .copy(travelerDirectionRef.current)
        .multiplyScalar(
          traversalSurfaceRadiusAt(travelerDirectionRef.current) + 0.38,
        )
        .project(camera);
      const travelerIsOnScreen =
        travelerProjectedPosition.z > -1 &&
        travelerProjectedPosition.z < 1 &&
        Math.abs(travelerProjectedPosition.x) < 1.1 &&
        Math.abs(travelerProjectedPosition.y) < 1.1;

      if (travelerIsOnScreen) {
        const travelerX =
          (travelerProjectedPosition.x * 0.5 + 0.5) * stageWidth;
        const travelerY =
          (-travelerProjectedPosition.y * 0.5 + 0.5) * stageHeight;
        const travelerHalfWidth = MathUtils.clamp(
          stageWidth * 0.1,
          44,
          72,
        );
        const travelerHalfHeight = MathUtils.clamp(
          stageHeight * 0.12,
          58,
          96,
        );
        const travelerLeft = travelerX - travelerHalfWidth;
        const travelerRight = travelerX + travelerHalfWidth;
        const travelerTop = travelerY - travelerHalfHeight;
        const travelerBottom = travelerY + travelerHalfHeight;
        const overlapsTraveler =
          left < travelerRight + gap &&
          left + cardWidth > travelerLeft - gap &&
          top < travelerBottom + gap &&
          top + cardHeight > travelerTop - gap;

        if (overlapsTraveler) {
          const leftOfTraveler = travelerLeft - cardWidth - gap;
          const rightOfTraveler = travelerRight + gap;
          const roomOnLeft = travelerLeft - gap - margin;
          const roomOnRight = stageWidth - margin - rightOfTraveler;

          if (roomOnLeft >= cardWidth || roomOnRight >= cardWidth) {
            left =
              roomOnLeft >= cardWidth && roomOnLeft >= roomOnRight
                ? leftOfTraveler
                : rightOfTraveler;
          } else {
            const aboveTraveler = travelerTop - cardHeight - gap;
            const belowTraveler = travelerBottom + gap;
            const roomAbove = travelerTop - gap - margin;
            const roomBelow = stageHeight - margin - belowTraveler;
            top =
              roomAbove >= cardHeight && roomAbove >= roomBelow
                ? aboveTraveler
                : belowTraveler;
          }

          left = MathUtils.clamp(
            left,
            margin,
            stageWidth - cardWidth - margin,
          );
          top = MathUtils.clamp(
            top,
            margin,
            stageHeight - cardHeight - margin,
          );
        }
      }
    }

    projection.style.opacity = visible ? "1" : "0";
    projection.style.pointerEvents = visible ? "auto" : "none";
    projection.style.visibility = aboveHorizon ? "visible" : "hidden";
    projection.tabIndex = visible ? 0 : -1;
    projection.setAttribute("aria-hidden", visible ? "false" : "true");
    projection.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  });

  return (
    <group scale={0.5}>
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.008, 0.018, 1.55, 6]} />
        <meshBasicMaterial color="#d04842" transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.026, 8, 6]} />
        <meshBasicMaterial color="#d04842" />
      </mesh>
      <group ref={anchorRef} position={[0, 1.74, 0]} />
    </group>
  );
}

function DestinationBeacon({
  selected,
  hovered,
  reduceMotion,
}: {
  selected: boolean;
  hovered: boolean;
  reduceMotion: boolean;
}) {
  const outerRingRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);
  const beaconRef = useRef<Mesh>(null);
  const beamRef = useRef<Mesh>(null);
  const color = selected ? "#ff665c" : "#ffd568";

  useFrame(({ clock }, delta) => {
    const pulse = reduceMotion
      ? 1
      : 1 + Math.sin(clock.elapsedTime * 2.1) * 0.08;
    const hoverBoost = hovered ? 1.16 : 1;

    if (outerRingRef.current) {
      const targetScale = pulse * hoverBoost;
      const scale = MathUtils.damp(
        outerRingRef.current.scale.x,
        targetScale,
        5,
        Math.min(delta, 0.05),
      );
      outerRingRef.current.scale.setScalar(scale);
      outerRingRef.current.rotation.z +=
        delta * (reduceMotion ? 0 : selected ? 0.42 : 0.24);
    }

    if (innerRingRef.current) {
      const targetScale = (2 - pulse) * hoverBoost;
      const scale = MathUtils.damp(
        innerRingRef.current.scale.x,
        targetScale,
        4.5,
        Math.min(delta, 0.05),
      );
      innerRingRef.current.scale.setScalar(scale);
      innerRingRef.current.rotation.z -=
        delta * (reduceMotion ? 0 : selected ? 0.55 : 0.3);
    }

    if (beaconRef.current) {
      beaconRef.current.position.y = reduceMotion
        ? 0.72
        : 0.72 + Math.sin(clock.elapsedTime * 1.65) * 0.045;
      beaconRef.current.rotation.y +=
        delta * (reduceMotion ? 0 : selected ? 1.25 : 0.75);
    }

    if (beamRef.current) {
      const material = beamRef.current.material as MeshBasicMaterial;
      material.opacity =
        (selected ? 0.18 : 0.11) *
        (reduceMotion
          ? 1
          : 0.88 + Math.sin(clock.elapsedTime * 2.1) * 0.12);
    }
  });

  return (
    <group>
      <mesh
        ref={outerRingRef}
        position={[0, 0.045, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={15}
      >
        <torusGeometry args={[0.265, 0.017, 8, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.94 : 0.78}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={innerRingRef}
        position={[0, 0.052, 0]}
        rotation={[Math.PI / 2, 0, Math.PI / 4]}
        renderOrder={15}
      >
        <torusGeometry args={[0.205, 0.009, 6, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.88 : 0.62}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={beamRef}
        position={[0, 0.39, 0]}
        renderOrder={14}
      >
        <cylinderGeometry args={[0.045, 0.19, 0.68, 12, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.18 : 0.11}
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={beaconRef}
        position={[0, 0.72, 0]}
        renderOrder={16}
      >
        <octahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.72, 0]} renderOrder={13}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.13 : 0.08}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {selected || hovered ? (
        <pointLight
          color={color}
          intensity={selected ? 2.2 : 1.3}
          distance={1.7}
          decay={2}
          position={[0, 0.25, 0]}
        />
      ) : null}
    </group>
  );
}

function DestinationWorld({
  place,
  selected,
  exploreMode,
  reduceMotion,
  projectionRef,
  travelerDirectionRef,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  exploreMode: boolean;
  reduceMotion: boolean;
  projectionRef: RefObject<HTMLButtonElement | null>;
  travelerDirectionRef: MutableRefObject<Vector3>;
  onSelect: (placeId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const worldPositionRef = useRef(new Vector3());
  const visibilityProbeRef = useRef(new Vector3());
  const aboveHorizonRef = useRef(true);
  const [hovered, setHovered] = useState(false);
  const { camera, gl } = useThree();
  const position = useMemo(
    () => {
      const direction =
        PLACE_DIRECTIONS.get(place.id)?.clone() ??
        sphericalDirection(0, 0);

      return direction.multiplyScalar(
        planetSurfaceRadiusAt(direction) + 0.025,
      );
    },
    [place.id],
  );
  const orientation = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        UP,
        position.clone().normalize(),
      ),
    [position],
  );
  const color = terrainColor(place.terrain);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.updateWorldMatrix(true, false);
    const worldPosition = groupRef.current.getWorldPosition(
      worldPositionRef.current,
    );
    const worldRadius = worldPosition.length();
    const visibilityProbe = visibilityProbeRef.current
      .copy(worldPosition)
      .multiplyScalar(
        (worldRadius + DESTINATION_HORIZON_REVEAL_HEIGHT) / worldRadius,
      );
    const aboveHorizon = isAboveGlobeHorizon(
      visibilityProbe,
      camera.position,
    );
    aboveHorizonRef.current = aboveHorizon;

    const targetScale = selected ? 2.35 : hovered ? 2.12 : 1.82;
    const scale = MathUtils.damp(
      groupRef.current.scale.x,
      targetScale,
      9,
      delta,
    );
    groupRef.current.scale.setScalar(scale);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!aboveHorizonRef.current) {
      return;
    }

    event.stopPropagation();
    onSelect(place.id);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={orientation}
      onClick={handleClick}
      onPointerOver={(event) => {
        if (!aboveHorizonRef.current) {
          return;
        }

        event.stopPropagation();
        setHovered(true);
        gl.domElement.style.cursor = exploreMode ? "none" : "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        gl.domElement.style.cursor = exploreMode ? "none" : "grab";
      }}
    >
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <DestinationBeacon
        selected={selected}
        hovered={hovered}
        reduceMotion={reduceMotion}
      />

      <group position={[0, selected ? 0.075 : 0.025, 0]}>
        <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial
            color={selected ? "#d04842" : "#d8c8aa"}
            emissive={selected ? "#7a1711" : "#614c19"}
            emissiveIntensity={selected ? 0.4 : 0.16}
            flatShading
          />
        </mesh>

        <PlaceDiorama place={place} color={color} />

        {selected ? (
          <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.013, 6, 28]} />
            <meshBasicMaterial color="#d04842" />
          </mesh>
        ) : null}
      </group>

      {selected ? (
        <PhotoProjection
          projectionRef={projectionRef}
          travelerDirectionRef={travelerDirectionRef}
          exploreMode={exploreMode}
        />
      ) : null}
    </group>
  );
}

function Traveler({
  inputRef,
  movementVelocityRef,
  playerUpRef,
  playerForwardRef,
  traversalModeRef,
  reduceMotion,
  onFootstep,
  onWaterStroke,
}: {
  inputRef: MutableRefObject<ExploreInput>;
  movementVelocityRef: MutableRefObject<number>;
  playerUpRef: MutableRefObject<Vector3>;
  playerForwardRef: MutableRefObject<Vector3>;
  traversalModeRef: MutableRefObject<TraversalMode>;
  reduceMotion: boolean;
  onFootstep: PlacesSceneProps["onFootstep"];
  onWaterStroke: PlacesSceneProps["onWaterStroke"];
}) {
  const groupRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const boatRef = useRef<Group>(null);
  const paddleRef = useRef<Group>(null);
  const seatedLegsRef = useRef<Group>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);
  const nextFootstepPhaseRef = useRef(Math.PI * 0.55);
  const footstepIndexRef = useRef(0);
  const wasMovingRef = useRef(false);
  const jumpElapsedRef = useRef(
    inputRef.current.jumpReady ? JUMP_CYCLE_DURATION : 0,
  );
  const lastJumpSequenceRef = useRef(inputRef.current.jumpSequence);
  const positionRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());
  const immersionRef = useRef(0);
  const boatBlendRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const movementSpeed = Math.abs(movementVelocityRef.current);
    const moving = movementSpeed > 0.002;
    const traversalMode = traversalModeRef.current;
    const swimming = traversalMode === "swim";
    const boating = traversalMode === "boat";
    const baseMovementSpeed = boating
      ? BOAT_SPEED
      : swimming
        ? SWIM_SPEED
        : WALK_SPEED;
    const fastMovementSpeed = boating
      ? FAST_BOAT_SPEED
      : swimming
        ? FAST_SWIM_SPEED
        : RUN_SPEED;
    const movementBlend = MathUtils.clamp(
      movementSpeed / baseMovementSpeed,
      0,
      1,
    );
    const runBlend = MathUtils.clamp(
      (movementSpeed - baseMovementSpeed) /
        (fastMovementSpeed - baseMovementSpeed),
      0,
      1,
    );

    if (!groupRef.current) {
      return;
    }

    if (inputRef.current.jumpSequence !== lastJumpSequenceRef.current) {
      lastJumpSequenceRef.current = inputRef.current.jumpSequence;
      jumpElapsedRef.current = 0;
      inputRef.current.jumpReady = false;
    }

    jumpElapsedRef.current = Math.min(
      JUMP_CYCLE_DURATION,
      jumpElapsedRef.current + delta,
    );

    if (
      !inputRef.current.jumpReady &&
      jumpElapsedRef.current >= JUMP_CYCLE_DURATION
    ) {
      inputRef.current.jumpReady = true;
    }

    const jumpProgress =
      Math.min(jumpElapsedRef.current, JUMP_DURATION) / JUMP_DURATION;
    const jumping = jumpElapsedRef.current < JUMP_DURATION;
    const jumpCurve = jumping ? Math.sin(jumpProgress * Math.PI) : 0;
    const jumpLift =
      jumpCurve *
      (boating ? 0 : swimming ? 0.07 : reduceMotion ? 0.08 : 0.38);

    if (moving && !wasMovingRef.current) {
      nextFootstepPhaseRef.current = phaseRef.current + Math.PI * 0.55;
    }

    if (moving) {
      const easedMovement = MathUtils.smoothstep(movementBlend, 0, 1);
      const fullGaitSpeed = boating
        ? MathUtils.lerp(1.55, 2.55, runBlend)
        : swimming
          ? MathUtils.lerp(5.8, 8.8, runBlend)
          : MathUtils.lerp(9.5, 16, runBlend);
      const gaitSpeed = MathUtils.lerp(
        boating ? 0.7 : swimming ? 3.2 : 3.8,
        fullGaitSpeed,
        easedMovement,
      );
      phaseRef.current += delta * gaitSpeed;

      while (phaseRef.current >= nextFootstepPhaseRef.current) {
        footstepIndexRef.current += 1;
        nextFootstepPhaseRef.current += Math.PI;

        if (
          traversalMode === "land" &&
          !jumping &&
          movementBlend >= 0.14
        ) {
          onFootstep(movementBlend, runBlend, footstepIndexRef.current);
        } else if (
          traversalMode !== "land" &&
          movementBlend >= 0.12
        ) {
          onWaterStroke(
            traversalMode,
            MathUtils.clamp(movementBlend + runBlend * 0.28, 0, 1),
            footstepIndexRef.current,
          );
        }
      }
    }

    wasMovingRef.current = moving;

    const stride = moving
      ? Math.sin(phaseRef.current) *
        MathUtils.lerp(0.5, 0.82, runBlend) *
        movementBlend
      : 0;
    const bob = moving
      ? Math.abs(Math.sin(phaseRef.current)) *
        (boating
          ? MathUtils.lerp(0.004, 0.009, runBlend)
          : swimming
            ? MathUtils.lerp(0.012, 0.024, runBlend)
            : MathUtils.lerp(0.018, 0.034, runBlend)) *
        movementBlend
      : 0;
    const playerUp = playerUpRef.current;
    const playerForward = playerForwardRef.current;
    immersionRef.current = MathUtils.damp(
      immersionRef.current,
      boating ? 0.045 : swimming ? -0.22 : 0,
      6,
      Math.min(delta, 0.05),
    );
    const position = positionRef.current
      .copy(playerUp)
      .multiplyScalar(
        traversalSurfaceRadiusAt(playerUp) +
          immersionRef.current +
          TRAVELER_GROUND_CLEARANCE +
          bob +
          jumpLift,
      );
    const lookTarget = lookTargetRef.current
      .copy(position)
      .add(playerForward);

    groupRef.current.position.copy(position);
    groupRef.current.up.copy(playerUp);
    groupRef.current.lookAt(lookTarget);

    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.visible = !boating;
      rightLegRef.current.visible = !boating;
      leftLegRef.current.rotation.x = swimming
        ? -0.26 + stride * 0.24
        : jumping
          ? -0.34
          : stride * 0.55;
      rightLegRef.current.rotation.x = swimming
        ? -0.26 - stride * 0.24
        : jumping
          ? -0.34
          : -stride * 0.55;
    }

    if (seatedLegsRef.current) {
      seatedLegsRef.current.visible = boating;
    }

    if (leftArmRef.current && rightArmRef.current) {
      const leftArmTargetX = boating
        ? -0.48 + stride * 0.42
        : swimming
          ? stride * 1.05
          : jumping
            ? -0.5
            : -stride * 0.72;
      const rightArmTargetX = boating
        ? -0.48 + stride * 0.42
        : swimming
          ? -stride * 1.05
          : jumping
            ? -0.5
            : stride * 0.72;
      const leftArmTargetZ = boating
        ? -0.16
        : swimming
          ? -0.32
          : 0;
      const rightArmTargetZ = boating
        ? 0.16
        : swimming
          ? 0.32
          : 0;
      const armResponse = boating ? 4.2 : 11;

      leftArmRef.current.rotation.x = MathUtils.damp(
        leftArmRef.current.rotation.x,
        leftArmTargetX,
        armResponse,
        Math.min(delta, 0.05),
      );
      rightArmRef.current.rotation.x = MathUtils.damp(
        rightArmRef.current.rotation.x,
        rightArmTargetX,
        armResponse,
        Math.min(delta, 0.05),
      );
      leftArmRef.current.rotation.z = MathUtils.damp(
        leftArmRef.current.rotation.z,
        leftArmTargetZ,
        armResponse,
        Math.min(delta, 0.05),
      );
      rightArmRef.current.rotation.z = MathUtils.damp(
        rightArmRef.current.rotation.z,
        rightArmTargetZ,
        armResponse,
        Math.min(delta, 0.05),
      );
    }

    if (modelRef.current) {
      modelRef.current.rotation.x = MathUtils.damp(
        modelRef.current.rotation.x,
        swimming ? 0.2 : boating ? -0.055 : 0,
        7,
        Math.min(delta, 0.05),
      );
      modelRef.current.position.y = MathUtils.damp(
        modelRef.current.position.y,
        boating ? -0.035 : 0,
        7,
        Math.min(delta, 0.05),
      );
    }

    boatBlendRef.current = MathUtils.damp(
      boatBlendRef.current,
      boating ? 1 : 0,
      4,
      Math.min(delta, 0.05),
    );

    if (boatRef.current) {
      const boatScale = MathUtils.smoothstep(
        boatBlendRef.current,
        0,
        1,
      );

      boatRef.current.visible = boatScale > 0.01;
      boatRef.current.scale.setScalar(boatScale);
      boatRef.current.position.y =
        -0.025 +
        (reduceMotion
          ? 0
          : Math.sin(clock.elapsedTime * 0.9) *
            0.005 *
            boatScale);
      boatRef.current.rotation.x = MathUtils.damp(
        boatRef.current.rotation.x,
        reduceMotion
          ? 0
          : Math.cos(clock.elapsedTime * 0.72) *
            0.012 *
            boatScale,
        2.4,
        Math.min(delta, 0.05),
      );
      boatRef.current.rotation.z = MathUtils.damp(
        boatRef.current.rotation.z,
        reduceMotion
          ? 0
          : Math.sin(clock.elapsedTime * 0.58) *
            0.018 *
            boatScale,
        2.2,
        Math.min(delta, 0.05),
      );
    }

    if (paddleRef.current) {
      const paddleStroke =
        moving && boating
          ? Math.sin(phaseRef.current) * 0.44 * movementBlend
          : 0;

      paddleRef.current.rotation.x = MathUtils.damp(
        paddleRef.current.rotation.x,
        -0.35 + paddleStroke,
        4.2,
        Math.min(delta, 0.05),
      );
      paddleRef.current.rotation.z = MathUtils.damp(
        paddleRef.current.rotation.z,
        moving && boating
          ? Math.cos(phaseRef.current) * 0.08 * movementBlend
          : 0,
        3.8,
        Math.min(delta, 0.05),
      );
    }
  });

  return (
    <group ref={groupRef} scale={1.9}>
      <group ref={modelRef}>
        <mesh
          ref={leftLegRef}
          position={[-0.035, 0.055, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshToonMaterial color="#26383e" />
        </mesh>
        <mesh
          ref={rightLegRef}
          position={[0.035, 0.055, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshToonMaterial color="#26383e" />
        </mesh>
        <group ref={seatedLegsRef} visible={false}>
          {[-0.035, 0.035].map((x) => (
            <group key={x}>
              <mesh
                position={[x, 0.105, 0.075]}
                renderOrder={TRAVELER_RENDER_ORDER + 1}
                castShadow
              >
                <boxGeometry args={[0.045, 0.052, 0.13]} />
                <meshToonMaterial color="#26383e" />
              </mesh>
              <mesh
                position={[x, 0.065, 0.15]}
                rotation={[0.5, 0, 0]}
                renderOrder={TRAVELER_RENDER_ORDER + 1}
                castShadow
              >
                <boxGeometry args={[0.045, 0.09, 0.052]} />
                <meshToonMaterial color="#202f34" />
              </mesh>
            </group>
          ))}
        </group>
        <mesh
          position={[0, 0.17, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <capsuleGeometry args={[0.065, 0.13, 4, 8]} />
          <meshToonMaterial color="#d34b42" />
        </mesh>
        <mesh
          position={[0, 0.235, 0.057]}
          renderOrder={TRAVELER_RENDER_ORDER + 1}
          castShadow
        >
          <boxGeometry args={[0.09, 0.035, 0.014]} />
          <meshToonMaterial color="#f2c84f" />
        </mesh>
        <mesh
          ref={leftArmRef}
          position={[-0.09, 0.19, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.035, 0.16, 0.04]} />
          <meshToonMaterial color="#e9c5a4" />
        </mesh>
        <mesh
          ref={rightArmRef}
          position={[0.09, 0.19, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.035, 0.16, 0.04]} />
          <meshToonMaterial color="#e9c5a4" />
        </mesh>
        <mesh
          position={[0, 0.32, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <icosahedronGeometry args={[0.078, 1]} />
          <meshToonMaterial color="#e9c5a4" />
        </mesh>
        <mesh
          position={[0, 0.365, -0.012]}
          scale={[1.04, 0.5, 1.02]}
          renderOrder={TRAVELER_RENDER_ORDER + 1}
          castShadow
        >
          <icosahedronGeometry args={[0.078, 1]} />
          <meshToonMaterial color="#6f513d" />
        </mesh>
        <mesh
          position={[0, 0.2, -0.065]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.105, 0.13, 0.055]} />
          <meshToonMaterial color="#d7a83f" />
        </mesh>
        <mesh
          position={[0, 0.26, -0.095]}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={TRAVELER_RENDER_ORDER + 1}
        >
          <torusGeometry args={[0.052, 0.008, 6, 16, Math.PI]} />
          <meshToonMaterial color="#f0ce6a" />
        </mesh>
      </group>
      <group ref={boatRef} visible={false} position={[0, -0.025, 0.015]}>
        <mesh
          position={[0, 0.015, 0]}
          scale={[0.78, 0.34, 1.8]}
          castShadow
          renderOrder={TRAVELER_RENDER_ORDER - 1}
        >
          <sphereGeometry args={[0.18, 14, 8]} />
          <meshToonMaterial color="#b8643f" />
        </mesh>
        <mesh
          position={[0, 0.055, -0.015]}
          scale={[0.7, 0.18, 1.3]}
          renderOrder={TRAVELER_RENDER_ORDER}
        >
          <sphereGeometry args={[0.15, 12, 7]} />
          <meshToonMaterial color="#2f3433" />
        </mesh>
        <mesh
          position={[0, 0.08, -0.02]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.08, 2.25, 1]}
          castShadow
          renderOrder={TRAVELER_RENDER_ORDER + 1}
        >
          <torusGeometry args={[0.13, 0.012, 7, 24]} />
          <meshToonMaterial color="#e4914f" />
        </mesh>
        <mesh
          position={[0, 0.065, -0.045]}
          scale={[0.13, 0.025, 0.13]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshToonMaterial color="#d1b07a" />
        </mesh>
        <mesh
          position={[0, 0.055, 0.3]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <coneGeometry args={[0.105, 0.2, 8]} />
          <meshToonMaterial color="#d47a47" />
        </mesh>
        <group ref={paddleRef} position={[0.13, 0.13, 0.02]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.44, 6]} />
            <meshToonMaterial color="#d6b275" />
          </mesh>
          <mesh position={[0, 0, -0.23]} scale={[0.035, 0.012, 0.075]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshToonMaterial color="#c68d58" />
          </mesh>
          <mesh position={[0, 0, 0.23]} scale={[0.035, 0.012, 0.075]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshToonMaterial color="#c68d58" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function PlanetExperience({
  selectedPlaceId,
  exploreMode,
  exploreInputRef,
  reduceMotion,
  projectionRef,
  onSelect,
  onNearbyChange,
  onFootstep,
  onTraversalAudio,
  onWaterStroke,
  skyPhase,
  solarDirection,
}: PlacesSceneProps) {
  const globeRef = useRef<Group>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const idleUntilRef = useRef(0);
  const targetQuaternionRef = useRef(new Quaternion());
  const playerUpRef = useRef(new Vector3(0, 1, 0));
  const playerForwardRef = useRef(new Vector3(0, 0, 1));
  const travelerForwardRef = useRef(new Vector3(0, 0, 1));
  const wasExploreModeRef = useRef(false);
  const nearbyPlaceIdRef = useRef<string | null>(null);
  const onNearbyChangeRef = useRef(onNearbyChange);
  const movementAxisRef = useRef(new Vector3());
  const movementTargetDirectionRef = useRef(new Vector3(0, 0, 1));
  const cameraMovementForwardRef = useRef(new Vector3(0, 0, 1));
  const cameraMovementRightRef = useRef(new Vector3(1, 0, 0));
  const movementBasisLockedRef = useRef(false);
  const travelerTurnCrossRef = useRef(new Vector3());
  const movementVelocityRef = useRef(0);
  const cameraOrbitAngleRef = useRef(0);
  const cameraOrbitTargetAngleRef = useRef(0);
  const cameraOrbitVelocityRef = useRef(0);
  const cameraOrbitDirectionRef = useRef(new Vector3());
  const cameraFramingDirectionRef = useRef(new Vector3());
  const desiredCameraRef = useRef(new Vector3());
  const cameraTargetRef = useRef(new Vector3());
  const cameraDistanceRef = useRef(DEFAULT_CAMERA_DISTANCE);
  const cameraDistanceTargetRef = useRef(DEFAULT_CAMERA_DISTANCE);
  const traversalModeRef = useRef<TraversalMode>("land");
  const { camera, gl } = useThree();

  useEffect(() => {
    onNearbyChangeRef.current = onNearbyChange;
  }, [onNearbyChange]);

  useEffect(() => {
    const selectedPlace =
      places.find((place) => place.id === selectedPlaceId) ?? places[0];
    const selectedDirection = PLACE_DIRECTIONS.get(selectedPlace.id)?.clone();

    if (!selectedDirection) {
      return;
    }

    if (exploreMode && !wasExploreModeRef.current) {
      const east = new Vector3().crossVectors(Y_AXIS, selectedDirection);

      if (east.lengthSq() < 0.0001) {
        east.crossVectors(new Vector3(0, 0, 1), selectedDirection);
      }

      east.normalize();
      playerUpRef.current
        .copy(selectedDirection)
        .applyAxisAngle(east, START_DISTANCE)
        .normalize();
      traversalModeRef.current = traversalModeAt(playerUpRef.current);
      playerForwardRef.current
        .copy(selectedDirection)
        .addScaledVector(
          playerUpRef.current,
          -selectedDirection.dot(playerUpRef.current),
        )
        .normalize();
      travelerForwardRef.current.copy(playerForwardRef.current);
      movementTargetDirectionRef.current.copy(playerForwardRef.current);

      targetQuaternionRef.current.identity();
      globeRef.current?.quaternion.identity();
      movementVelocityRef.current = 0;
      movementBasisLockedRef.current = false;
      cameraOrbitAngleRef.current = 0;
      cameraOrbitTargetAngleRef.current = 0;
      cameraOrbitVelocityRef.current = 0;
      cameraDistanceRef.current = DEFAULT_CAMERA_DISTANCE;
      cameraDistanceTargetRef.current = DEFAULT_CAMERA_DISTANCE;
      nearbyPlaceIdRef.current = null;
      onNearbyChangeRef.current(null);

      const playerUp = playerUpRef.current;
      const playerForward = playerForwardRef.current;
      const cameraHeight = MathUtils.lerp(
        CLOSE_CAMERA_HEIGHT,
        OVERVIEW_CAMERA_HEIGHT,
        DEFAULT_CAMERA_DISTANCE,
      );
      const cameraTrail = MathUtils.lerp(
        CLOSE_CAMERA_TRAIL,
        OVERVIEW_CAMERA_TRAIL,
        DEFAULT_CAMERA_DISTANCE,
      );
      const targetHeight = MathUtils.lerp(
        CLOSE_TARGET_HEIGHT,
        OVERVIEW_TARGET_HEIGHT,
        DEFAULT_CAMERA_DISTANCE,
      );
      const targetLead = MathUtils.lerp(
        CLOSE_TARGET_LEAD,
        OVERVIEW_TARGET_LEAD,
        DEFAULT_CAMERA_DISTANCE,
      );
      const cameraTarget = new Vector3()
        .copy(playerUp)
        .multiplyScalar(targetHeight)
        .addScaledVector(playerForward, targetLead);

      camera.position
        .copy(playerUp)
        .multiplyScalar(cameraHeight)
        .addScaledVector(playerForward, -cameraTrail);
      camera.up.copy(playerUp);
      camera.lookAt(cameraTarget);
    } else if (!exploreMode) {
      targetQuaternionRef.current.copy(
        new Quaternion().setFromUnitVectors(
          selectedDirection,
          FOCUS_DIRECTION,
        ),
      );
      globeRef.current?.quaternion.copy(targetQuaternionRef.current);
      idleUntilRef.current = performance.now() + 4200;

      if (nearbyPlaceIdRef.current !== null) {
        nearbyPlaceIdRef.current = null;
        onNearbyChangeRef.current(null);
      }
    }

    wasExploreModeRef.current = exploreMode;
  }, [camera, exploreMode, selectedPlaceId]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = exploreMode ? "none" : "grab";
    canvas.style.touchAction = exploreMode ? "pan-y" : "none";

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = exploreMode ? "none" : "grabbing";

      if (exploreMode) {
        cameraOrbitVelocityRef.current = 0;
      } else {
        idleUntilRef.current = Number.POSITIVE_INFINITY;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;

      if (exploreMode) {
        cameraOrbitTargetAngleRef.current -=
          deltaX * CAMERA_ORBIT_DRAG_SENSITIVITY;
        cameraOrbitVelocityRef.current = 0;
        return;
      }

      const yaw = new Quaternion().setFromAxisAngle(Y_AXIS, deltaX * 0.006);
      const pitch = new Quaternion().setFromAxisAngle(X_AXIS, deltaY * 0.006);
      targetQuaternionRef.current
        .premultiply(yaw)
        .premultiply(pitch)
        .normalize();
    };

    const finishDrag = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      canvas.style.cursor = exploreMode ? "none" : "grab";

      if (!exploreMode) {
        idleUntilRef.current = performance.now() + 1800;
      }

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishDrag);
      canvas.removeEventListener("pointercancel", finishDrag);
    };
  }, [exploreMode, gl]);

  useFrame((_, delta) => {
    const globe = globeRef.current;

    if (!globe) {
      return;
    }

    const frameDelta = Math.min(delta, 0.05);
    const input = exploreInputRef.current;

    if (exploreMode) {
      globe.quaternion.identity();

      const playerUp = playerUpRef.current;
      const playerForward = playerForwardRef.current;
      const travelerForward = travelerForwardRef.current;
      const traversalMode = traversalModeAt(playerUp);
      const swimming = traversalMode === "swim";
      const boating = traversalMode === "boat";
      traversalModeRef.current = traversalMode;
      const movementInputMagnitude = Math.min(
        1,
        Math.hypot(input.horizontal, input.vertical),
      );
      const movementTargetDirection = movementTargetDirectionRef.current;

      if (movementInputMagnitude === 0) {
        movementBasisLockedRef.current = false;
      }

      if (movementInputMagnitude !== 0) {
        const cameraMovementForward = cameraMovementForwardRef.current;
        const cameraMovementRight = cameraMovementRightRef.current;

        if (!movementBasisLockedRef.current) {
          cameraMovementForward
            .copy(camera.position)
            .addScaledVector(playerUp, -camera.position.dot(playerUp))
            .multiplyScalar(-1);

          if (cameraMovementForward.lengthSq() < 0.0001) {
            cameraMovementForward.copy(playerForward);
          } else {
            cameraMovementForward.normalize();
          }

          cameraMovementRight
            .crossVectors(cameraMovementForward, playerUp)
            .normalize();
          movementBasisLockedRef.current = true;
        }

        movementTargetDirection
          .copy(cameraMovementForward)
          .multiplyScalar(input.vertical)
          .addScaledVector(cameraMovementRight, input.horizontal)
          .normalize();

        if (movementTargetDirection.lengthSq() > 0.0001) {
          const travelerTurnCross = travelerTurnCrossRef.current.crossVectors(
            travelerForward,
            movementTargetDirection,
          );
          const travelerTurnAngle = Math.atan2(
            travelerTurnCross.dot(playerUp),
            MathUtils.clamp(
              travelerForward.dot(movementTargetDirection),
              -1,
              1,
            ),
          );
          const travelerTurnStep = reduceMotion
            ? travelerTurnAngle
            : MathUtils.damp(
                0,
                travelerTurnAngle,
                TRAVELER_TURN_RESPONSE,
                frameDelta,
              );

          travelerForward
            .applyAxisAngle(playerUp, travelerTurnStep)
            .normalize();
        }
      }

      const movementAlignment =
        movementInputMagnitude === 0
          ? 0
          : MathUtils.clamp(
              travelerForward.dot(movementTargetDirection),
              -1,
              1,
            );
      const movementReadiness = MathUtils.smoothstep(
        movementAlignment,
        -0.1,
        0.92,
      );
      const targetMovementVelocity =
        movementInputMagnitude *
        (boating
          ? input.running
            ? FAST_BOAT_SPEED
            : BOAT_SPEED
          : swimming
          ? input.running
            ? FAST_SWIM_SPEED
            : SWIM_SPEED
          : input.running
            ? RUN_SPEED
            : WALK_SPEED) *
        movementReadiness;
      const movementResponse = boating
        ? targetMovementVelocity === 0
          ? 2.2
          : 2.8
        : targetMovementVelocity === 0
          ? 4.2
          : 5.5;
      movementVelocityRef.current = MathUtils.damp(
        movementVelocityRef.current,
        targetMovementVelocity,
        movementResponse,
        frameDelta,
      );

      if (movementVelocityRef.current < 0.0005) {
        movementVelocityRef.current = 0;
      }

      if (movementVelocityRef.current !== 0) {
        const movementAxis = movementAxisRef.current
          .crossVectors(travelerForward, playerUp)
          .normalize();
        const movementAngle = -movementVelocityRef.current * frameDelta;

        playerUp.applyAxisAngle(movementAxis, movementAngle).normalize();
        playerForward
          .applyAxisAngle(movementAxis, movementAngle)
          .addScaledVector(playerUp, -playerForward.dot(playerUp))
          .normalize();
        travelerForward
          .applyAxisAngle(movementAxis, movementAngle)
          .addScaledVector(playerUp, -travelerForward.dot(playerUp))
          .normalize();
        if (movementBasisLockedRef.current) {
          cameraMovementForwardRef.current
            .applyAxisAngle(movementAxis, movementAngle)
            .addScaledVector(
              playerUp,
              -cameraMovementForwardRef.current.dot(playerUp),
            )
            .normalize();
          cameraMovementRightRef.current
            .crossVectors(cameraMovementForwardRef.current, playerUp)
            .normalize();
        }
        traversalModeRef.current = traversalModeAt(playerUp);
      }

      const currentTraversalMode = traversalModeRef.current;
      const traversalTopSpeed =
        currentTraversalMode === "boat"
          ? FAST_BOAT_SPEED
          : currentTraversalMode === "swim"
            ? FAST_SWIM_SPEED
            : RUN_SPEED;
      onTraversalAudio(
        currentTraversalMode,
        MathUtils.clamp(
          Math.abs(movementVelocityRef.current) / traversalTopSpeed,
          0,
          1,
        ),
      );

      cameraDistanceTargetRef.current = MathUtils.clamp(
        cameraDistanceTargetRef.current -
          input.zoom * CAMERA_DISTANCE_RATE * frameDelta,
        0,
        1,
      );
      cameraDistanceRef.current = MathUtils.damp(
        cameraDistanceRef.current,
        cameraDistanceTargetRef.current,
        reduceMotion ? 18 : 6,
        frameDelta,
      );
      const cameraDistance = cameraDistanceRef.current;
      const cameraHeight = MathUtils.lerp(
        CLOSE_CAMERA_HEIGHT,
        OVERVIEW_CAMERA_HEIGHT,
        cameraDistance,
      );
      const cameraTrail = MathUtils.lerp(
        CLOSE_CAMERA_TRAIL,
        OVERVIEW_CAMERA_TRAIL,
        cameraDistance,
      );
      const targetHeight = MathUtils.lerp(
        CLOSE_TARGET_HEIGHT,
        OVERVIEW_TARGET_HEIGHT,
        cameraDistance,
      );
      const targetLead = MathUtils.lerp(
        CLOSE_TARGET_LEAD,
        OVERVIEW_TARGET_LEAD,
        cameraDistance,
      );

      const targetOrbitVelocity = input.cameraOrbit * CAMERA_ORBIT_SPEED;
      const orbitResponse = reduceMotion
        ? 18
        : input.cameraOrbit === 0
          ? CAMERA_ORBIT_RELEASE
          : CAMERA_ORBIT_RESPONSE;
      cameraOrbitVelocityRef.current = MathUtils.damp(
        cameraOrbitVelocityRef.current,
        targetOrbitVelocity,
        orbitResponse,
        frameDelta,
      );

      if (
        input.cameraOrbit === 0 &&
        Math.abs(cameraOrbitVelocityRef.current) < 0.0005
      ) {
        cameraOrbitVelocityRef.current = 0;
      }

      cameraOrbitTargetAngleRef.current +=
        cameraOrbitVelocityRef.current * frameDelta;
      cameraOrbitAngleRef.current = MathUtils.damp(
        cameraOrbitAngleRef.current,
        cameraOrbitTargetAngleRef.current,
        reduceMotion ? 18 : CAMERA_ORBIT_ANGLE_RESPONSE,
        frameDelta,
      );
      const cameraOrbitDirection = cameraOrbitDirectionRef.current
        .copy(playerForward)
        .applyAxisAngle(playerUp, cameraOrbitAngleRef.current)
        .normalize();

      const cameraEase =
        1 -
        Math.exp(
          -frameDelta * (reduceMotion ? 18 : CAMERA_FOLLOW_RESPONSE),
        );
      const desiredCamera = desiredCameraRef.current
        .copy(playerUp)
        .multiplyScalar(cameraHeight)
        .addScaledVector(cameraOrbitDirection, -cameraTrail);

      camera.position.lerp(desiredCamera, cameraEase);
      camera.up.lerp(playerUp, cameraEase).normalize();
      const cameraFramingDirection = cameraFramingDirectionRef.current
        .copy(camera.position)
        .addScaledVector(playerUp, -camera.position.dot(playerUp))
        .multiplyScalar(-1);

      if (cameraFramingDirection.lengthSq() < 0.0001) {
        cameraFramingDirection.copy(cameraOrbitDirection);
      } else {
        cameraFramingDirection.normalize();
      }

      const cameraTarget = cameraTargetRef.current
        .copy(playerUp)
        .multiplyScalar(targetHeight)
        .addScaledVector(cameraFramingDirection, targetLead);
      camera.lookAt(cameraTarget);

      let nearestPlace: Place | null = null;
      let nearestDot = -1;

      for (const place of places) {
        const placeDirection = PLACE_DIRECTIONS.get(place.id);

        if (!placeDirection) {
          continue;
        }

        const dot = placeDirection.dot(playerUp);

        if (dot > nearestDot) {
          nearestDot = dot;
          nearestPlace = place;
        }
      }

      const nearestAngle = Math.acos(
        MathUtils.clamp(nearestDot, -1, 1),
      );
      const currentNearbyPlaceId = nearbyPlaceIdRef.current;
      const currentNearbyDirection = currentNearbyPlaceId
        ? PLACE_DIRECTIONS.get(currentNearbyPlaceId)
        : null;
      const currentNearbyAngle = currentNearbyDirection
        ? Math.acos(
            MathUtils.clamp(
              currentNearbyDirection.dot(playerUp),
              -1,
              1,
            ),
          )
        : Number.POSITIVE_INFINITY;
      let nearbyPlaceId = currentNearbyPlaceId;

      if (
        !currentNearbyPlaceId ||
        currentNearbyAngle > NEARBY_EXIT_ANGLE
      ) {
        nearbyPlaceId =
          nearestPlace && nearestAngle < NEARBY_ENTER_ANGLE
            ? nearestPlace.id
            : null;
      } else if (
        nearestPlace &&
        nearestPlace.id !== currentNearbyPlaceId &&
        nearestAngle + NEARBY_SWITCH_ADVANTAGE < currentNearbyAngle
      ) {
        nearbyPlaceId = nearestPlace.id;
      }

      if (nearbyPlaceIdRef.current !== nearbyPlaceId) {
        nearbyPlaceIdRef.current = nearbyPlaceId;
        onNearbyChangeRef.current(nearbyPlaceId);
      }

      return;
    }

    onTraversalAudio("land", 0);

    if (
      !reduceMotion &&
      !dragRef.current &&
      performance.now() >= idleUntilRef.current
    ) {
      const autoRotation = new Quaternion().setFromAxisAngle(
        Y_AXIS,
        frameDelta * 0.055,
      );
      targetQuaternionRef.current.premultiply(autoRotation).normalize();
    }

    globe.quaternion.slerp(
      targetQuaternionRef.current,
      1 - Math.exp(-frameDelta * 5),
    );

    const cameraEase = 1 - Math.exp(-frameDelta * 4);
    camera.position.lerp(BROWSE_CAMERA_POSITION, cameraEase);
    camera.up.lerp(Y_AXIS, cameraEase).normalize();
    camera.lookAt(0, -0.05, 0);
    cameraOrbitAngleRef.current = 0;
    cameraOrbitTargetAngleRef.current = 0;
    cameraOrbitVelocityRef.current = 0;
    cameraDistanceRef.current = DEFAULT_CAMERA_DISTANCE;
    cameraDistanceTargetRef.current = DEFAULT_CAMERA_DISTANCE;
  });

  return (
    <>
      <CelestialSky
        skyPhase={skyPhase}
        exploreMode={exploreMode}
        observerDirectionRef={playerUpRef}
        solarDirection={solarDirection}
      />

      <group ref={globeRef}>
        <PlanetoidWorld
          travelerDirectionRef={playerUpRef}
          movementVelocityRef={movementVelocityRef}
          exploreMode={exploreMode}
          reduceMotion={reduceMotion}
          skyPhase={skyPhase}
        />

        {places.map((place) => (
          <DestinationWorld
            key={place.id}
            place={place}
            selected={place.id === selectedPlaceId}
            exploreMode={exploreMode}
            reduceMotion={reduceMotion}
            projectionRef={projectionRef}
            travelerDirectionRef={playerUpRef}
            onSelect={onSelect}
          />
        ))}

        <CloudLayer
          travelerDirectionRef={playerUpRef}
          exploreMode={exploreMode}
          reduceMotion={reduceMotion}
          skyPhase={skyPhase}
        />
      </group>

      {exploreMode ? (
        <>
          <Traveler
            inputRef={exploreInputRef}
            movementVelocityRef={movementVelocityRef}
            playerUpRef={playerUpRef}
            playerForwardRef={travelerForwardRef}
            traversalModeRef={traversalModeRef}
            reduceMotion={reduceMotion}
            onFootstep={onFootstep}
            onWaterStroke={onWaterStroke}
          />
          <BoatWake
            travelerDirectionRef={playerUpRef}
            travelerForwardRef={travelerForwardRef}
            movementVelocityRef={movementVelocityRef}
            exploreMode={exploreMode}
            reduceMotion={reduceMotion}
          />
          <SurfaceParticles
            travelerDirectionRef={playerUpRef}
            travelerForwardRef={travelerForwardRef}
            movementVelocityRef={movementVelocityRef}
            exploreMode={exploreMode}
            reduceMotion={reduceMotion}
          />
        </>
      ) : null}

      <mesh scale={1.075}>
        <icosahedronGeometry args={[PLANET_RADIUS, 4]} />
        <meshBasicMaterial
          color="#d04842"
          transparent
          opacity={0.055}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export function PlacesScene(props: PlacesSceneProps) {
  const sunlightPosition = useMemo(
    () =>
      new Vector3(...props.solarDirection)
        .normalize()
        .multiplyScalar(28 * WORLD_SCALE)
        .toArray() as [number, number, number],
    [props.solarDirection],
  );

  return (
    <Canvas
      className="places-canvas"
      aria-hidden="true"
      camera={{
        position: [
          0,
          0.45 * WORLD_SCALE,
          18.8 * WORLD_SCALE,
        ],
        fov: 40,
        near: 0.05,
        far: 120,
      }}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#000000"), 0);
        gl.domElement.style.cursor = props.exploreMode ? "none" : "grab";
        gl.domElement.style.touchAction = "none";
      }}
    >
      <StarField
        skyPhase={props.skyPhase}
        reduceMotion={props.reduceMotion}
      />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#fff7eb", "#263c4f", 0.95]} />
      <directionalLight
        position={sunlightPosition}
        intensity={3.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-10 * WORLD_SCALE}
        shadow-camera-right={10 * WORLD_SCALE}
        shadow-camera-top={10 * WORLD_SCALE}
        shadow-camera-bottom={-10 * WORLD_SCALE}
      />
      <directionalLight
        position={[-5, -2, 3]}
        intensity={0.28}
        color="#b9d5d0"
      />
      <PlanetExperience {...props} />
    </Canvas>
  );
}
