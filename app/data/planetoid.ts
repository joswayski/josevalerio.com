import { MathUtils, Vector3 } from "three";
import { places } from "./places";

export const PLANET_RADIUS = 10;
export const OCEAN_SURFACE_RADIUS = PLANET_RADIUS + 0.14;
export const PLANET_MAX_SURFACE_RADIUS = 11.45;

export type TraversalMode = "boat" | "land" | "swim";

export type BiomeKind =
  | "united-states"
  | "dominican-republic"
  | "turkiye"
  | "south-korea"
  | "japan";

export type IslandPart = {
  east: number;
  north: number;
  scaleEast: number;
  scaleNorth: number;
  rotation: number;
  outline: readonly number[];
  heightScale?: number;
};

export type BiomeDefinition = {
  id: BiomeKind;
  name: string;
  countryName: string;
  center: Vector3;
  angularRadius: number;
  parts: readonly IslandPart[];
  flagOffset: readonly [number, number];
  baseHeight: number;
  peakHeight: number;
  seed: number;
  ground: string;
  groundDark: string;
  cliff: string;
  path: string;
  shore: string;
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
    id: "united-states",
    name: "United States",
    countryName: "United States",
    center: sphericalDirection(-18, 32),
    angularRadius: 0.76,
    parts: [
      {
        east: 0,
        north: 0,
        scaleEast: 0.68,
        scaleNorth: 0.39,
        rotation: -0.08,
        // A broad continental silhouette with a northeastern shoulder,
        // Texas-like southwest weight, and a narrow Florida-like tail.
        outline: [
          0.92, 0.96, 0.98, 0.93, 0.88, 0.9, 0.94, 1, 0.97, 0.91,
          0.9, 0.94, 1.04, 1, 0.9, 0.84, 0.8, 0.86, 0.96, 1.08,
          1.02, 0.9, 0.84, 0.86, 0.92, 0.88, 0.8, 0.76, 0.84, 0.92,
          0.96, 0.94,
        ],
      },
    ],
    flagOffset: [-0.04, 0.02],
    baseHeight: 0.29,
    peakHeight: 0.5,
    seed: 11,
    ground: "#79aa68",
    groundDark: "#47754f",
    cliff: "#806c55",
    path: "#e0c48e",
    shore: "#e9d09a",
  },
  {
    id: "dominican-republic",
    name: "Dominican Republic",
    countryName: "Dominican Republic",
    center: sphericalDirection(70, 18),
    angularRadius: 0.42,
    parts: [
      {
        east: 0,
        north: 0,
        scaleEast: 0.36,
        scaleNorth: 0.16,
        rotation: -0.05,
        outline: [
          0.98, 0.92, 0.88, 0.94, 1.04, 0.98, 0.9, 0.86, 0.9, 0.97,
          1.02, 0.96, 0.9, 0.86, 0.92, 1.02, 1.06, 0.98, 0.9, 0.88,
          0.94, 1, 1.04, 1,
        ],
      },
    ],
    flagOffset: [-0.02, 0],
    baseHeight: 0.22,
    peakHeight: 0.35,
    seed: 29,
    ground: "#7fc46a",
    groundDark: "#3d855c",
    cliff: "#a97b50",
    path: "#f1ce83",
    shore: "#f0d78e",
  },
  {
    id: "turkiye",
    name: "Türkiye",
    countryName: "Türkiye",
    center: sphericalDirection(154, 27),
    angularRadius: 0.61,
    parts: [
      {
        east: 0,
        north: 0,
        scaleEast: 0.55,
        scaleNorth: 0.23,
        rotation: 0.04,
        outline: [
          0.96, 0.92, 0.94, 1.02, 0.98, 0.9, 0.86, 0.9, 0.96, 1.02,
          1.06, 1, 0.92, 0.88, 0.84, 0.9, 1, 1.08, 1.02, 0.94,
          0.9, 0.94, 1.02, 1,
        ],
      },
    ],
    flagOffset: [0.01, 0.01],
    baseHeight: 0.31,
    peakHeight: 0.72,
    seed: 47,
    ground: "#a4ad69",
    groundDark: "#6c7550",
    cliff: "#97735a",
    path: "#dcb878",
    shore: "#ddc28d",
  },
  {
    id: "south-korea",
    name: "South Korea",
    countryName: "South Korea",
    center: sphericalDirection(-132, 4),
    angularRadius: 0.44,
    parts: [
      {
        east: 0,
        north: 0,
        scaleEast: 0.21,
        scaleNorth: 0.37,
        rotation: -0.18,
        outline: [
          0.9, 0.96, 1.04, 1, 0.92, 0.88, 0.9, 0.96, 1, 0.94,
          0.86, 0.82, 0.88, 0.98, 1.06, 1.02, 0.94, 0.88, 0.84, 0.9,
          1, 1.04, 0.98, 0.92,
        ],
      },
    ],
    flagOffset: [0, -0.01],
    baseHeight: 0.3,
    peakHeight: 0.56,
    seed: 61,
    ground: "#6ca46c",
    groundDark: "#416c55",
    cliff: "#746c60",
    path: "#d8c59e",
    shore: "#d8c79f",
  },
  {
    id: "japan",
    name: "Japan",
    countryName: "Japan",
    center: sphericalDirection(-93, -31),
    angularRadius: 0.58,
    parts: [
      {
        east: 0,
        north: 0,
        scaleEast: 0.19,
        scaleNorth: 0.4,
        rotation: -0.38,
        outline: [
          0.9, 0.96, 1.02, 0.98, 0.9, 0.86, 0.9, 1, 1.05, 0.98,
          0.9, 0.84, 0.88, 0.96, 1.04, 1, 0.92, 0.86, 0.9, 0.98,
          1.03, 0.98, 0.92, 0.88,
        ],
      },
      {
        east: 0.12,
        north: 0.37,
        scaleEast: 0.13,
        scaleNorth: 0.13,
        rotation: 0.1,
        outline: [
          0.94, 1.02, 0.96, 0.9, 0.94, 1.04, 1, 0.92, 0.88, 0.94,
          1.03, 0.98, 0.9, 0.92, 1, 0.98,
        ],
        heightScale: 0.82,
      },
      {
        east: -0.11,
        north: -0.36,
        scaleEast: 0.12,
        scaleNorth: 0.15,
        rotation: -0.22,
        outline: [
          0.96, 1.04, 0.96, 0.9, 0.94, 1.02, 0.98, 0.9, 0.92, 1,
          1.04, 0.96, 0.9, 0.94, 1, 0.98,
        ],
        heightScale: 0.74,
      },
    ],
    flagOffset: [0.01, -0.01],
    baseHeight: 0.27,
    peakHeight: 0.49,
    seed: 71,
    ground: "#73a86f",
    groundDark: "#456f5b",
    cliff: "#766b64",
    path: "#d5b79d",
    shore: "#e4d0ad",
  },
];

export const BIOME_BY_ID = new Map(
  BIOMES.map((biome) => [biome.id, biome]),
);

// These are thematic display offsets rather than precise coordinates. Dense
// regions are intentionally spread out so their landmarks remain explorable.
const PLACE_LAYOUT: Record<string, PlaceLayout> = {
  "new-york": {
    biomeId: "united-states",
    east: 0.37,
    north: 0.09,
  },
  "new-jersey": {
    biomeId: "united-states",
    east: 0.25,
    north: 0,
  },
  "rhode-island": {
    biomeId: "united-states",
    east: 0.5,
    north: 0.17,
  },
  chicago: {
    biomeId: "united-states",
    east: -0.17,
    north: 0.14,
  },
  austin: {
    biomeId: "united-states",
    east: -0.18,
    north: -0.24,
  },
  "central-florida": {
    biomeId: "united-states",
    east: 0.38,
    north: -0.24,
  },
  "dominican-republic": {
    biomeId: "dominican-republic",
    east: 0,
    north: 0,
  },
  istanbul: {
    biomeId: "turkiye",
    east: -0.34,
    north: 0.095,
  },
  ankara: {
    biomeId: "turkiye",
    east: -0.015,
    north: 0.045,
  },
  izmir: {
    biomeId: "turkiye",
    east: -0.33,
    north: -0.07,
  },
  bodrum: {
    biomeId: "turkiye",
    east: -0.17,
    north: -0.155,
  },
  malatya: {
    biomeId: "turkiye",
    east: 0.32,
    north: 0.02,
  },
  seoul: { biomeId: "south-korea", east: 0, north: 0.025 },
  tokyo: { biomeId: "japan", east: 0.045, north: -0.135 },
  osaka: { biomeId: "japan", east: -0.06, north: -0.02 },
};

export const PLACE_DIRECTIONS = new Map(
  places.map((place) => {
    const layout = PLACE_LAYOUT[place.id];

    if (!layout) {
      throw new Error(`Missing island layout for ${place.id}`);
    }

    if (layout.biomeId !== place.countryId) {
      throw new Error(
        `${place.name} must stay on the ${place.countryName} island`,
      );
    }

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
    id: "great-lake",
    biomeId: "united-states",
    center: directionFromOffset(
      BIOME_BY_ID.get("united-states")!.center,
      0.025,
      0.13,
    ),
    angularRadius: 0.1,
    color: "#66aeb7",
    depth: 0.24,
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

function wrapAngle(angle: number) {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

export function islandOutlineRadius(
  part: IslandPart,
  angle: number,
) {
  const wrapped = wrapAngle(angle);
  const scaledIndex =
    (wrapped / (Math.PI * 2)) * part.outline.length;
  const currentIndex = Math.floor(scaledIndex) % part.outline.length;
  const nextIndex = (currentIndex + 1) % part.outline.length;
  const blend = scaledIndex - Math.floor(scaledIndex);

  return MathUtils.lerp(
    part.outline[currentIndex],
    part.outline[nextIndex],
    blend,
  );
}

export function islandPartDirection(
  biome: BiomeDefinition,
  part: IslandPart,
  radialProgress: number,
  angle: number,
) {
  const outlineRadius = islandOutlineRadius(part, angle);
  const localEast =
    Math.cos(angle) *
    part.scaleEast *
    outlineRadius *
    radialProgress;
  const localNorth =
    Math.sin(angle) *
    part.scaleNorth *
    outlineRadius *
    radialProgress;
  const cosine = Math.cos(part.rotation);
  const sine = Math.sin(part.rotation);
  const east = localEast * cosine - localNorth * sine;
  const north = localEast * sine + localNorth * cosine;

  return directionFromOffset(
    biome.center,
    part.east + east,
    part.north + north,
  );
}

function tangentOffsetFromCenter(
  center: Vector3,
  direction: Vector3,
) {
  const normalizedCenter = center.clone().normalize();
  const normalizedDirection = direction.clone().normalize();
  const cosine = MathUtils.clamp(
    normalizedCenter.dot(normalizedDirection),
    -1,
    1,
  );
  const distance = Math.acos(cosine);

  if (distance < 0.000001) {
    return { east: 0, north: 0 };
  }

  const { east, north } = tangentBasis(normalizedCenter);
  const tangent = normalizedDirection
    .addScaledVector(normalizedCenter, -cosine)
    .normalize();

  return {
    east: tangent.dot(east) * distance,
    north: tangent.dot(north) * distance,
  };
}

function islandPartProgress(
  direction: Vector3,
  biome: BiomeDefinition,
  part: IslandPart,
) {
  const offset = tangentOffsetFromCenter(biome.center, direction);
  const east = offset.east - part.east;
  const north = offset.north - part.north;
  const cosine = Math.cos(part.rotation);
  const sine = Math.sin(part.rotation);
  const localEast = east * cosine + north * sine;
  const localNorth = -east * sine + north * cosine;
  const normalizedEast = localEast / part.scaleEast;
  const normalizedNorth = localNorth / part.scaleNorth;
  const angle = Math.atan2(normalizedNorth, normalizedEast);
  const radius = Math.hypot(normalizedEast, normalizedNorth);
  const boundary = islandOutlineRadius(part, angle);

  return radius / Math.max(boundary, 0.0001);
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
  const noise = terrainNoise(direction, biome.seed);
  const rolling = Math.pow(Math.max(0, noise - 0.26), 1.45);
  const ridge =
    biome.id === "turkiye" || biome.id === "south-korea"
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

  let height = 0;

  for (const part of biome.parts) {
    const progress = islandPartProgress(direction, biome, part);

    if (progress >= 1) {
      continue;
    }

    const edge = 1 - smoothstep(0.78, 1, progress);
    const centerRise = Math.pow(
      Math.max(0, 1 - progress),
      biome.id === "turkiye" ? 1.05 : 1.72,
    );
    const partHeight =
      edge *
      (biome.baseHeight +
        biome.peakHeight *
          (rolling * 0.62 + centerRise * 0.38 + ridge)) *
      (part.heightScale ?? 1);

    height = Math.max(height, partHeight);
  }

  return height;
}

function baseRockHeight(direction: Vector3) {
  return (
    (Math.sin(direction.x * 13 + direction.z * 9) *
      Math.sin(direction.y * 11 - direction.x * 7) +
      1) *
    0.018
  );
}

function landSurfaceHeightAt(direction: Vector3) {
  let height = baseRockHeight(direction);

  for (const biome of BIOMES) {
    height = Math.max(height, biomeHeightAt(direction, biome));
  }

  return height;
}

export function waterFeatureForDirection(direction: Vector3) {
  return (
    WATER_FEATURES.find(
      (water) =>
        angularDistance(direction, water.center) <
        water.angularRadius,
    ) ?? null
  );
}

export function waterSurfaceRadius(water: WaterFeature) {
  return (
    PLANET_RADIUS +
    landSurfaceHeightAt(water.center) -
    0.015
  );
}

export function surfaceHeightAt(direction: Vector3) {
  const landHeight = landSurfaceHeightAt(direction);
  const water = waterFeatureForDirection(direction);

  if (!water) {
    return landHeight;
  }

  const normalizedDistance = MathUtils.clamp(
    angularDistance(direction, water.center) / water.angularRadius,
    0,
    1,
  );
  const bowl = 1 - smoothstep(0.06, 0.96, normalizedDistance);
  const waterHeight = waterSurfaceRadius(water) - PLANET_RADIUS;
  const floorHeight =
    waterHeight - 0.025 - water.depth * bowl;

  return Math.min(landHeight, floorHeight);
}

export function surfaceRadiusAt(direction: Vector3) {
  return PLANET_RADIUS + surfaceHeightAt(direction);
}

export function isOceanDirection(direction: Vector3) {
  if (waterFeatureForDirection(direction)) {
    return false;
  }

  return (
    landSurfaceHeightAt(direction) <
    OCEAN_SURFACE_RADIUS - PLANET_RADIUS + 0.015
  );
}

export function traversalModeAt(direction: Vector3): TraversalMode {
  if (waterFeatureForDirection(direction)) {
    return "swim";
  }

  return isOceanDirection(direction) ? "boat" : "land";
}

export function isWaterDirection(direction: Vector3) {
  return traversalModeAt(direction) !== "land";
}

export function traversalSurfaceRadiusAt(direction: Vector3) {
  const water = waterFeatureForDirection(direction);

  if (water) {
    return waterSurfaceRadius(water);
  }

  return isOceanDirection(direction)
    ? OCEAN_SURFACE_RADIUS
    : surfaceRadiusAt(direction);
}

export function biomeForDirection(direction: Vector3) {
  let nearest: BiomeDefinition | null = null;
  let greatestHeight = 0;

  for (const biome of BIOMES) {
    const height = biomeHeightAt(direction, biome);

    if (height > greatestHeight) {
      nearest = biome;
      greatestHeight = height;
    }
  }

  return nearest;
}
