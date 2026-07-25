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
  Color,
  DoubleSide,
  MathUtils,
  Object3D,
  Quaternion,
  Vector3,
  type Group,
  type InstancedBufferAttribute,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
  type Points,
} from "three";
import { places, type Place, type PlaceTerrain } from "../data/places";
import {
  PLACE_DIRECTIONS,
  PLANET_RADIUS,
  isWaterDirection,
  sphericalDirection,
  surfaceRadiusAt as planetSurfaceRadiusAt,
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
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
};

const WALK_SPEED = 0.32;
const RUN_SPEED = 0.7;
const START_DISTANCE = 0.24;
const NEARBY_DISTANCE = Math.cos(0.075);
const JUMP_DURATION = 0.52;
const JUMP_LANDING_DELAY = 0.22;
const JUMP_CYCLE_DURATION = JUMP_DURATION + JUMP_LANDING_DELAY;
const BROWSE_CAMERA_POSITION = new Vector3(0, 0.45, 18.8);
const CLOSE_CAMERA_HEIGHT = 9.4;
const CLOSE_CAMERA_TRAIL = 4.2;
const CLOSE_TARGET_HEIGHT = 5;
const CLOSE_TARGET_LEAD = 2.6;
const OVERVIEW_CAMERA_HEIGHT = 21;
const OVERVIEW_CAMERA_TRAIL = 6;
const OVERVIEW_TARGET_HEIGHT = 0.5;
const OVERVIEW_TARGET_LEAD = 3;
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
  coordinates: [longitude: number, latitude: number];
  seed: number;
  width: number;
  puffCount: number;
  altitude: number;
};

type CloudPuff = {
  basePosition: Vector3;
  currentPosition: Vector3;
  baseScale: Vector3;
  rotation: Quaternion;
  driftDirection: Vector3;
  scatterDirection: Vector3;
  opacity: number;
  phase: number;
};

const CLOUD_INTERACTION_RADIUS = 1.3;
const CLOUD_DEFINITIONS: CloudDefinition[] = [
  {
    id: "western-atlantic",
    coordinates: [-74, 31],
    seed: 11,
    width: 1.15,
    puffCount: 40,
    altitude: 0.34,
  },
  {
    id: "great-lakes",
    coordinates: [-91, 44],
    seed: 23,
    width: 1.05,
    puffCount: 36,
    altitude: 0.36,
  },
  {
    id: "caribbean",
    coordinates: [-64, 18],
    seed: 37,
    width: 1.25,
    puffCount: 44,
    altitude: 0.32,
  },
  {
    id: "north-atlantic",
    coordinates: [-18, 49],
    seed: 41,
    width: 1.3,
    puffCount: 46,
    altitude: 0.38,
  },
  {
    id: "mediterranean",
    coordinates: [24, 39],
    seed: 53,
    width: 1.05,
    puffCount: 36,
    altitude: 0.34,
  },
  {
    id: "east-asia",
    coordinates: [128, 35],
    seed: 67,
    width: 1.2,
    puffCount: 42,
    altitude: 0.36,
  },
  {
    id: "north-pacific",
    coordinates: [160, 24],
    seed: 79,
    width: 1.35,
    puffCount: 48,
    altitude: 0.38,
  },
  {
    id: "indian-ocean",
    coordinates: [78, -8],
    seed: 97,
    width: 1.2,
    puffCount: 42,
    altitude: 0.34,
  },
  {
    id: "south-atlantic",
    coordinates: [-18, -18],
    seed: 101,
    width: 1.15,
    puffCount: 40,
    altitude: 0.33,
  },
];

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
    skyPhase === "night" ? 0.88 : skyPhase === "twilight" ? 0.58 : 0.3;

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
}: {
  definition: CelestialBodyDefinition;
  skyPhase: SkyPhase;
}) {
  const emissiveIntensity =
    skyPhase === "night" ? 0.34 : skyPhase === "twilight" ? 0.24 : 0.12;

  return (
    <>
      <mesh scale={1.18}>
        <sphereGeometry args={[definition.radius, 16, 12]} />
        <meshBasicMaterial
          color={definition.emissive}
          transparent
          opacity={skyPhase === "night" ? 0.16 : 0.08}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[definition.radius, 20, 14]} />
        <meshStandardMaterial
          color={definition.color}
          emissive={definition.emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.86}
          metalness={0}
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
            color={definition.ring.color}
            emissive={definition.emissive}
            emissiveIntensity={emissiveIntensity * 0.7}
            side={DoubleSide}
            transparent
            opacity={0.84}
            roughness={0.9}
          />
        </mesh>
      ) : null}
    </>
  );
}

function CelestialSky({
  skyPhase,
}: {
  skyPhase: SkyPhase;
}) {
  const bodyRefs = useRef<Array<Group | null>>([]);
  const bodyTargetPositionsRef = useRef(
    CELESTIAL_BODIES.map(() => new Vector3()),
  );
  const bodyWasInitializedRef = useRef(
    CELESTIAL_BODIES.map(() => false),
  );
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
            definition.distance,
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
  const surfaceRadius = planetSurfaceRadiusAt(centerDirection);
  const puffs: CloudPuff[] = [];
  const coreCount = Math.floor(definition.puffCount * 0.72);

  for (let index = 0; index < definition.puffCount; index += 1) {
    const isCore = index < coreCount;
    const horizontalAngle = random() * Math.PI * 2;
    const horizontalDistribution = isCore
      ? Math.pow(random(), 0.82) * 0.72
      : 0.62 + Math.pow(random(), 0.5) * 0.38;
    const horizontalRadius =
      horizontalDistribution * definition.width * 0.52;
    const eastOffset = Math.cos(horizontalAngle) * horizontalRadius;
    const northOffset =
      Math.sin(horizontalAngle) * horizontalRadius * 0.72;
    const verticalSpread =
      definition.width * (isCore ? 0.19 : 0.27);
    const radialOffset =
      definition.altitude +
      (random() + random() - 1) * verticalSpread;
    const basePosition = centerDirection
      .clone()
      .multiplyScalar(surfaceRadius + radialOffset)
      .addScaledVector(east, eastOffset)
      .addScaledVector(north, northOffset);
    const scatterAngle = random() * Math.PI * 2;
    const radius = isCore
      ? 0.2 + random() * 0.15
      : 0.1 + random() * 0.14;
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

    puffs.push({
      basePosition,
      currentPosition: basePosition.clone(),
      baseScale: new Vector3(
        radius * (0.88 + random() * 0.38),
        radius * (0.78 + random() * 0.4),
        radius * (0.88 + random() * 0.38),
      ),
      rotation: new Quaternion().setFromAxisAngle(
        rotationAxis,
        random() * Math.PI * 2,
      ),
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
      opacity: isCore
        ? 0.5 + random() * 0.2
        : 0.24 + random() * 0.2,
      phase: random() * Math.PI * 2,
    });
  }

  return { centerDirection, puffs };
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
  const cloudColor =
    skyPhase === "night"
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
        planetSurfaceRadiusAt(travelerDirection) + 0.34,
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
        .copy(targetPosition)
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

        targetPosition
          .addScaledVector(
            lateral,
            interaction *
              (0.54 +
                Math.max(
                  puff.baseScale.x,
                  puff.baseScale.y,
                  puff.baseScale.z,
                ) *
                  1.2),
          )
          .addScaledVector(
            cloud.centerDirection,
            interaction * 0.2,
          );
      }

      const response = interaction > 0.01 ? 9 : 1.45;
      puff.currentPosition.lerp(
        targetPosition,
        1 - Math.exp(-easeDelta * response),
      );
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
              0.68 + topLight * 0.18 + facing * 0.12,
              0.46,
              1.0
            );
            light = floor(light * 5.0 + 0.5) / 5.0;
            vec3 shadedColor =
              cloudColor * light * mix(0.86, 1.03, density);

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
  return (
    <group>
      {CLOUD_DEFINITIONS.map((definition) => (
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
    const movementBlend = MathUtils.clamp(
      movementSpeed / RUN_SPEED,
      0,
      1,
    );
    const onWater = isWaterDirection(travelerDirection);
    const canSpawn = exploreMode && movementBlend > 0.08;

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
        const surfaceRadius = planetSurfaceRadiusAt(travelerDirection);

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

  if (worldRadius === 0 || cameraPosition.lengthSq() <= PLANET_RADIUS ** 2) {
    return false;
  }

  const cameraFacingHeight =
    worldPosition.dot(cameraPosition) / worldRadius;

  return (
    cameraFacingHeight >
    PLANET_RADIUS + 0.08 + HORIZON_CLIP_MARGIN
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
  horizonRef,
  travelerDirectionRef,
  exploreMode,
}: {
  projectionRef: RefObject<HTMLButtonElement | null>;
  horizonRef: RefObject<Group | null>;
  travelerDirectionRef: MutableRefObject<Vector3>;
  exploreMode: boolean;
}) {
  const anchorRef = useRef<Group>(null);
  const projectedPositionRef = useRef(new Vector3());
  const horizonPositionRef = useRef(new Vector3());
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
    const horizon = horizonRef.current;
    const projection = projectionRef.current;

    if (!anchor || !horizon || !projection) {
      return;
    }

    anchor.position.y = 1.74 + Math.sin(clock.elapsedTime * 1.45) * 0.025;
    anchor.updateWorldMatrix(true, false);

    const horizonPosition = horizonPositionRef.current;
    horizon.getWorldPosition(horizonPosition);
    const aboveHorizon = isAboveGlobeHorizon(
      horizonPosition,
      camera.position,
    );

    const projectedPosition = projectedPositionRef.current;
    anchor.getWorldPosition(projectedPosition);
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

    const stage = projection.parentElement;
    const nearbyHud = stage?.querySelector<HTMLElement>(
      ".explore-place-hud",
    );

    if (stage && nearbyHud) {
      const stageRect = stage.getBoundingClientRect();
      const hudRect = nearbyHud.getBoundingClientRect();
      const hudLeft = hudRect.left - stageRect.left;
      const hudTop = hudRect.top - stageRect.top;
      const hudRight = hudRect.right - stageRect.left;
      const hudBottom = hudRect.bottom - stageRect.top;
      const overlapsHud =
        left < hudRight + gap &&
        left + cardWidth > hudLeft - gap &&
        top < hudBottom + gap &&
        top + cardHeight > hudTop - gap;

      if (overlapsHud) {
        const leftOfHud = hudLeft - cardWidth - gap;

        if (leftOfHud >= margin) {
          left = leftOfHud;
        } else {
          top = MathUtils.clamp(
            hudBottom + gap,
            margin,
            stageHeight - cardHeight - margin,
          );
        }
      }
    }

    if (exploreMode) {
      const travelerProjectedPosition = travelerProjectedPositionRef.current
        .copy(travelerDirectionRef.current)
        .multiplyScalar(
          planetSurfaceRadiusAt(travelerDirectionRef.current) + 0.38,
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

function DestinationWorld({
  place,
  selected,
  exploreMode,
  projectionRef,
  travelerDirectionRef,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  exploreMode: boolean;
  projectionRef: RefObject<HTMLButtonElement | null>;
  travelerDirectionRef: MutableRefObject<Vector3>;
  onSelect: (placeId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const worldPositionRef = useRef(new Vector3());
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
    const aboveHorizon = isAboveGlobeHorizon(
      groupRef.current.getWorldPosition(worldPositionRef.current),
      camera.position,
    );
    aboveHorizonRef.current = aboveHorizon;
    groupRef.current.visible = aboveHorizon;

    const targetScale = selected ? 1.9 : hovered ? 1.65 : 1.48;
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
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        gl.domElement.style.cursor = "grab";
      }}
    >
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.19, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[0, selected ? 0.075 : 0.025, 0]}>
        <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial
            color={selected ? "#d04842" : "#d8c8aa"}
            emissive={selected ? "#4f0d0a" : "#000000"}
            emissiveIntensity={selected ? 0.22 : 0}
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
          horizonRef={groupRef}
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
  reduceMotion,
  onFootstep,
}: {
  inputRef: MutableRefObject<ExploreInput>;
  movementVelocityRef: MutableRefObject<number>;
  playerUpRef: MutableRefObject<Vector3>;
  playerForwardRef: MutableRefObject<Vector3>;
  reduceMotion: boolean;
  onFootstep: PlacesSceneProps["onFootstep"];
}) {
  const groupRef = useRef<Group>(null);
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

  useFrame((_, delta) => {
    const movementSpeed = Math.abs(movementVelocityRef.current);
    const moving = movementSpeed > 0.002;
    const movementBlend = MathUtils.clamp(movementSpeed / WALK_SPEED, 0, 1);
    const runBlend = MathUtils.clamp(
      (movementSpeed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED),
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
    const jumpLift = jumpCurve * (reduceMotion ? 0.08 : 0.38);

    if (moving && !wasMovingRef.current) {
      nextFootstepPhaseRef.current = phaseRef.current + Math.PI * 0.55;
    }

    if (moving) {
      const easedMovement = MathUtils.smoothstep(movementBlend, 0, 1);
      const fullGaitSpeed = MathUtils.lerp(9.5, 16, runBlend);
      const gaitSpeed = MathUtils.lerp(3.8, fullGaitSpeed, easedMovement);
      phaseRef.current += delta * gaitSpeed;

      while (phaseRef.current >= nextFootstepPhaseRef.current) {
        footstepIndexRef.current += 1;
        nextFootstepPhaseRef.current += Math.PI;

        if (!jumping && movementBlend >= 0.14) {
          onFootstep(movementBlend, runBlend, footstepIndexRef.current);
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
        MathUtils.lerp(0.018, 0.034, runBlend) *
        movementBlend
      : 0;
    const playerUp = playerUpRef.current;
    const playerForward = playerForwardRef.current;
    const position = positionRef.current
      .copy(playerUp)
      .multiplyScalar(
        planetSurfaceRadiusAt(playerUp) +
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
      leftLegRef.current.rotation.x = jumping ? -0.34 : stride * 0.55;
      rightLegRef.current.rotation.x = jumping ? -0.34 : -stride * 0.55;
    }

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = jumping ? -0.5 : -stride * 0.72;
      rightArmRef.current.rotation.x = jumping ? -0.5 : stride * 0.72;
    }
  });

  return (
    <group ref={groupRef} scale={1.9}>
      <group>
        <mesh
          ref={leftLegRef}
          position={[-0.035, 0.055, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshStandardMaterial color="#2c3b40" flatShading />
        </mesh>
        <mesh
          ref={rightLegRef}
          position={[0.035, 0.055, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshStandardMaterial color="#2c3b40" flatShading />
        </mesh>
        <mesh
          position={[0, 0.17, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <capsuleGeometry args={[0.065, 0.13, 4, 8]} />
          <meshStandardMaterial color="#d04842" flatShading />
        </mesh>
        <mesh
          ref={leftArmRef}
          position={[-0.09, 0.19, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.035, 0.16, 0.04]} />
          <meshStandardMaterial color="#e9c5a4" flatShading />
        </mesh>
        <mesh
          ref={rightArmRef}
          position={[0.09, 0.19, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.035, 0.16, 0.04]} />
          <meshStandardMaterial color="#e9c5a4" flatShading />
        </mesh>
        <mesh
          position={[0, 0.32, 0]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <icosahedronGeometry args={[0.078, 1]} />
          <meshStandardMaterial color="#e9c5a4" flatShading />
        </mesh>
        <mesh
          position={[0, 0.2, -0.065]}
          renderOrder={TRAVELER_RENDER_ORDER}
          castShadow
        >
          <boxGeometry args={[0.105, 0.13, 0.055]} />
          <meshStandardMaterial color="#d4a64c" flatShading />
        </mesh>
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
  skyPhase,
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
  const tornadoDirectionRef = useRef(new Vector3(0, 1, 0));
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
    canvas.style.cursor = "grab";
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
      canvas.style.cursor = "grabbing";

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
      canvas.style.cursor = "grab";

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
      const movementInputMagnitude = Math.min(
        1,
        Math.hypot(input.horizontal, input.vertical),
      );
      const movementTargetDirection = movementTargetDirectionRef.current;

      if (movementInputMagnitude !== 0) {
        const cameraMovementForward = cameraMovementForwardRef.current
          .copy(camera.position)
          .addScaledVector(playerUp, -camera.position.dot(playerUp))
          .multiplyScalar(-1);

        if (cameraMovementForward.lengthSq() < 0.0001) {
          cameraMovementForward.copy(playerForward);
        } else {
          cameraMovementForward.normalize();
        }

        const cameraMovementRight = cameraMovementRightRef.current
          .crossVectors(cameraMovementForward, playerUp)
          .normalize();
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
        (input.running ? RUN_SPEED : WALK_SPEED) *
        movementReadiness;
      const movementResponse = targetMovementVelocity === 0 ? 5.5 : 7;
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
      }

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

      const nearbyPlace =
        nearestPlace && nearestDot > NEARBY_DISTANCE ? nearestPlace : null;
      const nearbyPlaceId = nearbyPlace?.id ?? null;

      if (nearbyPlaceIdRef.current !== nearbyPlaceId) {
        nearbyPlaceIdRef.current = nearbyPlaceId;
        onNearbyChangeRef.current(nearbyPlaceId);
      }

      return;
    }

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
      <CelestialSky skyPhase={skyPhase} />

      <group ref={globeRef}>
        <PlanetoidWorld
          travelerDirectionRef={playerUpRef}
          movementVelocityRef={movementVelocityRef}
          tornadoDirectionRef={tornadoDirectionRef}
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
            reduceMotion={reduceMotion}
            onFootstep={onFootstep}
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
        .multiplyScalar(28)
        .toArray() as [number, number, number],
    [props.solarDirection],
  );

  return (
    <Canvas
      className="places-canvas"
      aria-hidden="true"
      camera={{ position: [0, 0.45, 18.8], fov: 40, near: 0.05, far: 80 }}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#000000"), 0);
        gl.domElement.style.cursor = "grab";
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
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
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
