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
  Vector3,
  type Group,
  type Mesh,
} from "three";
import {
  BIOMES,
  BIOME_BY_ID,
  PLACE_DIRECTIONS,
  PLANET_RADIUS,
  WATER_FEATURES,
  biomeHeightAt,
  directionFromOffset,
  isWaterDirection,
  surfaceRadiusAt,
  tangentBasis,
  type BiomeDefinition,
  type BiomeKind,
  type WaterFeature,
} from "../data/planetoid";

type SkyPhase = "day" | "twilight" | "night";

type PlanetoidWorldProps = {
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  tornadoDirectionRef: MutableRefObject<Vector3>;
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
  phase: number;
};

const UP = new Vector3(0, 1, 0);
const TERRAIN_SEGMENTS = 42;
const TERRAIN_RINGS = 11;
const VEGETATION_INTERACTION_ANGLE = 0.105;
const TORNADO_DIRECTION = directionFromOffset(
  BIOME_BY_ID.get("suncoast")!.center,
  -0.22,
  -0.19,
);

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
        .multiplyScalar(PLANET_RADIUS + height + 0.006);
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
  const rings = 12;
  const segments = 48;

  for (let ring = 0; ring <= rings; ring += 1) {
    const ringRadius = radius * (ring / rings);

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
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
  const radius = water.angularRadius * PLANET_RADIUS * 0.92;
  const position = useMemo(
    () =>
      water.center
        .clone()
        .multiplyScalar(surfaceRadiusAt(water.center) + 0.035),
    [water.center],
  );
  const waterGeometry = useMemo(
    () => createWaterGeometry(radius),
    [radius],
  );
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      interaction: { value: 0 },
      motion: { value: reduceMotion ? 0 : 1 },
      waterColor: {
        value:
          skyPhase === "night"
            ? new Color(water.color).multiplyScalar(0.52)
            : new Color(water.color),
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
      Math.abs(movementVelocityRef.current) / 0.7,
      0,
      1,
    );

    uniforms.time.value = clock.elapsedTime;
    uniforms.interaction.value = nearby * movement;
  });

  return (
    <group position={position} quaternion={orientation}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.028, 0]}
        receiveShadow
      >
        <circleGeometry args={[radius * 1.08, 28]} />
        <meshStandardMaterial
          color="#516c63"
          roughness={1}
          flatShading
        />
      </mesh>
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
            varying float vCrest;
            varying float vEdge;

            void main() {
              float radialDistance = length(position.xy);
              float ambientWave = (
                sin(position.x * 16.0 + time * 1.4) +
                sin(position.y * 19.0 - time * 1.1) +
                sin((position.x + position.y) * 13.0 + time * 0.8)
              ) / 3.0;
              float wake = sin(
                radialDistance * 42.0 - time * 8.5
              ) * exp(-radialDistance * 2.8) * interaction;
              float displacement = motion * (
                ambientWave * 0.012 +
                wake * 0.045
              );
              vec3 displacedPosition =
                position + normal * displacement;

              vCrest = clamp(
                0.5 + ambientWave * 0.28 + wake * 0.72,
                0.0,
                1.0
              );
              vEdge = 1.0 - smoothstep(
                0.65,
                1.0,
                radialDistance / ${radius.toFixed(5)}
              );
              gl_Position = projectionMatrix * modelViewMatrix * vec4(
                displacedPosition,
                1.0
              );
            }
          `}
          fragmentShader={`
            uniform vec3 waterColor;
            varying float vCrest;
            varying float vEdge;

            void main() {
              vec3 crest = mix(
                waterColor * 0.72,
                vec3(0.84, 0.96, 0.92),
                vCrest * 0.48
              );
              float alpha = mix(0.58, 0.88, vCrest) * vEdge;
              gl_FragColor = vec4(crest, alpha);
            }
          `}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <torusGeometry args={[radius * 1.01, 0.025, 5, 36]} />
        <meshStandardMaterial
          color="#d7c99d"
          roughness={0.95}
          flatShading
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
  tornadoDirectionRef,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  tornadoDirectionRef: MutableRefObject<Vector3>;
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
      const tornadoDistance = angularDistance(
        plant.direction,
        tornadoDirectionRef.current,
      );
      const travelerBend =
        1 -
        MathUtils.smoothstep(
          travelerDistance,
          0.015,
          VEGETATION_INTERACTION_ANGLE,
        );
      const tornadoBend =
        1 -
        MathUtils.smoothstep(tornadoDistance, 0.02, 0.2);
      const wind =
        reduceMotion
          ? 0
          : Math.sin(clock.elapsedTime * 1.2 + plant.phase) * 0.035;
      const bend = Math.min(
        0.5,
        wind + travelerBend * 0.32 + tornadoBend * 0.44,
      );
      const bendAxis = bendAxisRef.current
        .crossVectors(plant.direction, tornadoDirectionRef.current)
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
        phase: random() * Math.PI * 2,
      });
    }
  });

  return props;
}

function LooseProps({
  travelerDirectionRef,
  movementVelocityRef,
  tornadoDirectionRef,
  exploreMode,
  reduceMotion,
}: {
  travelerDirectionRef: MutableRefObject<Vector3>;
  movementVelocityRef: MutableRefObject<number>;
  tornadoDirectionRef: MutableRefObject<Vector3>;
  exploreMode: boolean;
  reduceMotion: boolean;
}) {
  const props = useMemo(createLooseProps, []);
  const propRefs = useRef<Array<Mesh | null>>([]);
  const impulseRef = useRef(new Vector3());
  const axisRef = useRef(new Vector3());
  const orientationRef = useRef(new Quaternion());

  useFrame(({ clock }, delta) => {
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
      const tornadoDistance = angularDistance(
        prop.direction,
        tornadoDirectionRef.current,
      );

      if (
        exploreMode &&
        travelerDistance < 0.055 &&
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
            0.18 + Math.abs(movementVelocityRef.current) * 0.26,
          );
        }
      }

      if (tornadoDistance < 0.2) {
        const swirl = impulseRef.current
          .crossVectors(tornadoDirectionRef.current, prop.direction)
          .normalize();
        prop.tangentVelocity.addScaledVector(
          swirl,
          (0.2 - tornadoDistance) * frameDelta * 1.9,
        );
      }

      prop.tangentVelocity.multiplyScalar(
        Math.exp(-frameDelta * (reduceMotion ? 8 : 3.1)),
      );

      if (prop.tangentVelocity.lengthSq() > 0.000001) {
        const speed = prop.tangentVelocity.length();
        const axis = axisRef.current
          .crossVectors(prop.tangentVelocity, prop.direction)
          .normalize();
        const angle = speed * frameDelta;

        prop.direction.applyAxisAngle(axis, angle).normalize();
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

      const lift =
        tornadoDistance < 0.16 && !reduceMotion
          ? Math.sin(clock.elapsedTime * 4 + prop.phase) *
              (0.16 - tornadoDistance) *
              1.4
          : 0;
      mesh.position
        .copy(prop.direction)
        .multiplyScalar(surfaceRadiusAt(prop.direction) + prop.scale + lift);
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

function Tornado({
  tornadoDirectionRef,
  travelerDirectionRef,
  reduceMotion,
  skyPhase,
}: {
  tornadoDirectionRef: MutableRefObject<Vector3>;
  travelerDirectionRef: MutableRefObject<Vector3>;
  reduceMotion: boolean;
  skyPhase: SkyPhase;
}) {
  const groupRef = useRef<Group>(null);
  const puffRefs = useRef<Array<Mesh | null>>([]);
  const dustRefs = useRef<Array<Mesh | null>>([]);
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, TORNADO_DIRECTION),
    [],
  );
  const basePosition = useMemo(
    () =>
      TORNADO_DIRECTION.clone().multiplyScalar(
        surfaceRadiusAt(TORNADO_DIRECTION) + 0.04,
      ),
    [],
  );
  const puffs = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        height: 0.08 + index * 0.035,
        phase: index * 2.399963,
        radius: 0.04 + index * 0.006,
        scale: 0.055 + (index / 34) * 0.12,
      })),
    [],
  );

  useFrame(({ clock }) => {
    tornadoDirectionRef.current.copy(TORNADO_DIRECTION);
    const travelerDistance = angularDistance(
      travelerDirectionRef.current,
      TORNADO_DIRECTION,
    );
    const agitation =
      1 -
      MathUtils.smoothstep(travelerDistance, 0.03, 0.24);
    const time = reduceMotion ? 0 : clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.position.copy(basePosition);
      groupRef.current.rotation.y = time * (0.45 + agitation * 0.75);
    }

    puffs.forEach((puff, index) => {
      const mesh = puffRefs.current[index];

      if (!mesh) {
        return;
      }

      const widening = puff.radius + puff.height * 0.12;
      const orbit = puff.phase + time * (2.7 + puff.height * 1.8);
      const pulse = 1 + Math.sin(time * 2.1 + puff.phase) * 0.08;

      mesh.position.set(
        Math.cos(orbit) * widening,
        puff.height,
        Math.sin(orbit) * widening,
      );
      mesh.scale.setScalar(puff.scale * pulse);
    });

    dustRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const phase = (index / 18) * Math.PI * 2 + time * 3.4;
      const radius = 0.22 + Math.sin(index * 1.7) * 0.06;
      mesh.position.set(
        Math.cos(phase) * radius,
        0.025 + (index % 4) * 0.025,
        Math.sin(phase) * radius,
      );
      mesh.scale.setScalar(0.025 + agitation * 0.012);
    });
  });

  return (
    <group ref={groupRef} position={basePosition} quaternion={orientation}>
      {puffs.map((puff, index) => (
        <mesh
          key={`tornado-puff-${index}`}
          ref={(mesh) => {
            puffRefs.current[index] = mesh;
          }}
          castShadow
          renderOrder={7}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={skyPhase === "night" ? "#87909a" : "#d7d8d2"}
            emissive="#8a8f93"
            emissiveIntensity={0.06}
            transparent
            opacity={0.62}
            roughness={1}
            depthWrite={false}
            flatShading
          />
        </mesh>
      ))}
      {Array.from({ length: 18 }, (_, index) => (
        <mesh
          key={`tornado-dust-${index}`}
          ref={(mesh) => {
            dustRefs.current[index] = mesh;
          }}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#b89a70"
            transparent
            opacity={0.62}
            depthWrite={false}
            flatShading
          />
        </mesh>
      ))}
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
        color={skyPhase === "night" ? "#30424a" : "#516e68"}
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
  tornadoDirectionRef,
  exploreMode,
  reduceMotion,
  skyPhase,
}: PlanetoidWorldProps) {
  return (
    <group>
      <BasePlanetoid skyPhase={skyPhase} />

      {BIOMES.map((biome) => (
        <group key={biome.id}>
          <TerrainChunk biome={biome} />
          <BiomePaths biome={biome} />
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
        tornadoDirectionRef={tornadoDirectionRef}
        reduceMotion={reduceMotion}
      />
      <LooseProps
        travelerDirectionRef={travelerDirectionRef}
        movementVelocityRef={movementVelocityRef}
        tornadoDirectionRef={tornadoDirectionRef}
        exploreMode={exploreMode}
        reduceMotion={reduceMotion}
      />
      <Tornado
        tornadoDirectionRef={tornadoDirectionRef}
        travelerDirectionRef={travelerDirectionRef}
        reduceMotion={reduceMotion}
        skyPhase={skyPhase}
      />
    </group>
  );
}
