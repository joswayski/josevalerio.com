import { MathUtils, Vector3 } from "three";
import { places } from "./places";

export const PLANET_RADIUS = 6;
export const PLANET_MAX_SURFACE_RADIUS = 7.12;

export type BiomeKind =
  | "harbor"
  | "suncoast"
  | "highlands"
  | "garden";

export type BiomeDefinition = {
  id: BiomeKind;
  name: string;
  center: Vector3;
  angularRadius: number;
  baseHeight: number;
  peakHeight: number;
  seed: number;
  ground: string;
  groundDark: string;
  cliff: string;
  path: string;
};

export type WaterFeature = {
  id: string;
  biomeId: BiomeKind;
  center: Vector3;
  angularRadius: number;
  color: string;
  depth: number;
};

type PlaceLayout = {
  biomeId: BiomeKind;
  east: number;
  north: number;
};

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

export function sphericalDirection(
  azimuthDegrees: number,
  elevationDegrees: number,
) {
  const azimuth = MathUtils.degToRad(azimuthDegrees);
  const elevation = MathUtils.degToRad(elevationDegrees);
  const ring = Math.cos(elevation);

  return new Vector3(
    Math.sin(azimuth) * ring,
    Math.sin(elevation),
    Math.cos(azimuth) * ring,
  ).normalize();
}

export function tangentBasis(direction: Vector3) {
  const normal = direction.clone().normalize();
  const east = new Vector3().crossVectors(Y_AXIS, normal);

  if (east.lengthSq() < 0.0001) {
    east.crossVectors(Z_AXIS, normal);
  }

  east.normalize();

  return {
    normal,
    east,
    north: new Vector3().crossVectors(normal, east).normalize(),
  };
}

export function directionFromOffset(
  center: Vector3,
  eastAngle: number,
  northAngle: number,
) {
  const { east, north } = tangentBasis(center);
  const offsetLength = Math.hypot(eastAngle, northAngle);

  if (offsetLength < 0.00001) {
    return center.clone().normalize();
  }

  const tangent = east
    .multiplyScalar(eastAngle)
    .addScaledVector(north, northAngle)
    .normalize();

  return center
    .clone()
    .normalize()
    .multiplyScalar(Math.cos(offsetLength))
    .addScaledVector(tangent, Math.sin(offsetLength))
    .normalize();
}

export const BIOMES: BiomeDefinition[] = [
  {
    id: "harbor",
    name: "Harbor Commons",
    center: sphericalDirection(-18, 34),
    angularRadius: 0.48,
    baseHeight: 0.3,
    peakHeight: 0.42,
    seed: 11,
    ground: "#8cab72",
    groundDark: "#67885d",
    cliff: "#82715f",
    path: "#d8c39f",
  },
  {
    id: "suncoast",
    name: "Sun Coast",
    center: sphericalDirection(73, 5),
    angularRadius: 0.46,
    baseHeight: 0.24,
    peakHeight: 0.32,
    seed: 29,
    ground: "#b7b96d",
    groundDark: "#7c965f",
    cliff: "#a07d5d",
    path: "#e6c584",
  },
  {
    id: "highlands",
    name: "Anatolian Highlands",
    center: sphericalDirection(157, 25),
    angularRadius: 0.53,
    baseHeight: 0.32,
    peakHeight: 0.72,
    seed: 47,
    ground: "#9ca775",
    groundDark: "#6d775f",
    cliff: "#8d7965",
    path: "#d9bd8d",
  },
  {
    id: "garden",
    name: "Lantern Gardens",
    center: sphericalDirection(-116, -8),
    angularRadius: 0.49,
    baseHeight: 0.28,
    peakHeight: 0.5,
    seed: 71,
    ground: "#7faa72",
    groundDark: "#557b65",
    cliff: "#766f67",
    path: "#cdb99a",
  },
];

export const BIOME_BY_ID = new Map(
  BIOMES.map((biome) => [biome.id, biome]),
);

const PLACE_LAYOUT: Record<string, PlaceLayout> = {
  "new-york": { biomeId: "harbor", east: -0.13, north: 0.09 },
  "new-jersey": { biomeId: "harbor", east: 0.05, north: 0.13 },
  "rhode-island": { biomeId: "harbor", east: 0.17, north: 0.02 },
  chicago: { biomeId: "harbor", east: -0.04, north: -0.13 },
  austin: { biomeId: "suncoast", east: -0.14, north: 0.1 },
  "central-florida": { biomeId: "suncoast", east: 0.05, north: -0.08 },
  "dominican-republic": {
    biomeId: "suncoast",
    east: 0.16,
    north: 0.1,
  },
  istanbul: { biomeId: "highlands", east: -0.17, north: 0.13 },
  ankara: { biomeId: "highlands", east: 0.01, north: 0.08 },
  izmir: { biomeId: "highlands", east: -0.13, north: -0.08 },
  bodrum: { biomeId: "highlands", east: 0.08, north: -0.16 },
  malatya: { biomeId: "highlands", east: 0.18, north: 0.02 },
  seoul: { biomeId: "garden", east: -0.16, north: 0.08 },
  tokyo: { biomeId: "garden", east: 0.02, north: 0.13 },
  osaka: { biomeId: "garden", east: 0.15, north: -0.07 },
};

export const PLACE_DIRECTIONS = new Map(
  places.map((place) => {
    const layout = PLACE_LAYOUT[place.id];
    const biome = BIOME_BY_ID.get(layout.biomeId);

    if (!biome) {
      throw new Error(`Missing biome for ${place.id}`);
    }

    return [
      place.id,
      directionFromOffset(biome.center, layout.east, layout.north),
    ] as const;
  }),
);

export const WATER_FEATURES: WaterFeature[] = [
  {
    id: "harbor-inlet",
    biomeId: "harbor",
    center: directionFromOffset(
      BIOME_BY_ID.get("harbor")!.center,
      0.2,
      -0.17,
    ),
    angularRadius: 0.105,
    color: "#70b5bd",
    depth: 0.1,
  },
  {
    id: "sun-lagoon",
    biomeId: "suncoast",
    center: directionFromOffset(
      BIOME_BY_ID.get("suncoast")!.center,
      0.12,
      0.01,
    ),
    angularRadius: 0.125,
    color: "#59c3c0",
    depth: 0.12,
  },
  {
    id: "highland-spring",
    biomeId: "highlands",
    center: directionFromOffset(
      BIOME_BY_ID.get("highlands")!.center,
      -0.02,
      -0.16,
    ),
    angularRadius: 0.075,
    color: "#73aeb5",
    depth: 0.08,
  },
  {
    id: "garden-pond",
    biomeId: "garden",
    center: directionFromOffset(
      BIOME_BY_ID.get("garden")!.center,
      -0.04,
      -0.05,
    ),
    angularRadius: 0.09,
    color: "#65aaa5",
    depth: 0.08,
  },
];

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = MathUtils.clamp(
    (value - edge0) / (edge1 - edge0),
    0,
    1,
  );

  return progress * progress * (3 - 2 * progress);
}

function angularDistance(a: Vector3, b: Vector3) {
  return Math.acos(
    MathUtils.clamp(
      a.clone().normalize().dot(b.clone().normalize()),
      -1,
      1,
    ),
  );
}

function terrainNoise(direction: Vector3, seed: number) {
  const seedOffset = seed * 0.173;
  const broad =
    Math.sin(direction.x * 9.7 + seedOffset) *
      Math.cos(direction.z * 8.1 - seedOffset * 0.7) *
      0.5 +
    0.5;
  const detail =
    Math.sin(
      direction.x * 22.3 +
        direction.y * 18.7 +
        direction.z * 20.1 +
        seedOffset * 2.3,
    ) *
      0.5 +
    0.5;

  return broad * 0.68 + detail * 0.32;
}

export function biomeHeightAt(
  direction: Vector3,
  biome: BiomeDefinition,
) {
  const distance = angularDistance(direction, biome.center);

  if (distance >= biome.angularRadius) {
    return 0;
  }

  const edge = 1 - smoothstep(
    biome.angularRadius * 0.76,
    biome.angularRadius,
    distance,
  );
  const centerRise = Math.pow(
    Math.max(0, 1 - distance / biome.angularRadius),
    biome.id === "highlands" ? 1.05 : 1.8,
  );
  const noise = terrainNoise(direction, biome.seed);
  const rolling = Math.pow(Math.max(0, noise - 0.26), 1.45);
  const ridge =
    biome.id === "highlands"
      ? Math.pow(
          Math.max(
            0,
            Math.sin(
              direction.x * 17 +
                direction.z * 12 -
                direction.y * 7,
            ),
          ),
          2,
        ) * 0.28
      : 0;

  return (
    edge *
    (biome.baseHeight +
      biome.peakHeight *
        (rolling * 0.62 + centerRise * 0.38 + ridge))
  );
}

function baseRockHeight(direction: Vector3) {
  return (
    (Math.sin(direction.x * 13 + direction.z * 9) *
      Math.sin(direction.y * 11 - direction.x * 7) +
      1) *
    0.018
  );
}

export function surfaceHeightAt(direction: Vector3) {
  let height = baseRockHeight(direction);

  for (const biome of BIOMES) {
    height = Math.max(height, biomeHeightAt(direction, biome));
  }

  return height;
}

export function surfaceRadiusAt(direction: Vector3) {
  return PLANET_RADIUS + surfaceHeightAt(direction);
}

export function isWaterDirection(direction: Vector3) {
  return WATER_FEATURES.some(
    (water) =>
      angularDistance(direction, water.center) < water.angularRadius,
  );
}

export function biomeForDirection(direction: Vector3) {
  let nearest: BiomeDefinition | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const biome of BIOMES) {
    const distance = angularDistance(direction, biome.center);

    if (
      distance < biome.angularRadius &&
      distance < nearestDistance
    ) {
      nearest = biome;
      nearestDistance = distance;
    }
  }

  return nearest;
}
