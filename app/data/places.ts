export type PlacePhoto = {
  objectKey?: string;
  src?: string;
  alt: string;
  width?: number;
  height?: number;
};

export type PlaceTerrain = "city" | "coast" | "mountain";

export type PlaceLandmark =
  | "barbecue"
  | "lighthouse"
  | "mosque"
  | "mountain"
  | "orange"
  | "palm"
  | "sailboat"
  | "skyline"
  | "sushi"
  | "torii"
  | "tower";

export type Place = {
  id: string;
  name: string;
  region: string;
  terrain: PlaceTerrain;
  landmark: PlaceLandmark;
  note?: string;
  photos: PlacePhoto[];
};

const placeholderPhoto: PlacePhoto = {
  src: "/places/placeholder.svg",
  alt: "Travel photo placeholder",
  width: 1600,
  height: 1000,
};

const osakaCastlePhoto: PlacePhoto = {
  objectKey: "places/osaka/Captures_2026-07-22_19-10-28_129.png",
  alt: "Osaka Castle in Osaka, Japan",
  width: 1370,
  height: 1782,
};

// This list is intentionally public and thematic. Keep raw location history,
// visit dates, routes, and precise coordinates out of the website repository.
// R2 custom domains do not expose folder listings, so add each curated object to
// its place's photos array. Every entry becomes a slide in that place's gallery.
export const places: Place[] = [
  {
    id: "new-york",
    name: "New York",
    region: "United States",
    terrain: "city",
    landmark: "skyline",
    photos: [placeholderPhoto],
  },
  {
    id: "new-jersey",
    name: "New Jersey",
    region: "United States",
    terrain: "coast",
    landmark: "lighthouse",
    photos: [placeholderPhoto],
  },
  {
    id: "rhode-island",
    name: "Rhode Island",
    region: "United States",
    terrain: "coast",
    landmark: "sailboat",
    photos: [placeholderPhoto],
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "United States",
    terrain: "city",
    landmark: "skyline",
    photos: [placeholderPhoto],
  },
  {
    id: "austin",
    name: "Austin",
    region: "United States",
    terrain: "city",
    landmark: "barbecue",
    photos: [placeholderPhoto],
  },
  {
    id: "central-florida",
    name: "Central Florida",
    region: "United States",
    terrain: "coast",
    landmark: "orange",
    photos: [placeholderPhoto],
  },
  {
    id: "dominican-republic",
    name: "Dominican Republic",
    region: "Caribbean",
    terrain: "coast",
    landmark: "palm",
    photos: [placeholderPhoto],
  },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "Türkiye",
    terrain: "city",
    landmark: "mosque",
    photos: [placeholderPhoto],
  },
  {
    id: "ankara",
    name: "Ankara",
    region: "Türkiye",
    terrain: "city",
    landmark: "mosque",
    photos: [placeholderPhoto],
  },
  {
    id: "izmir",
    name: "Izmir",
    region: "Türkiye",
    terrain: "coast",
    landmark: "sailboat",
    photos: [placeholderPhoto],
  },
  {
    id: "bodrum",
    name: "Bodrum",
    region: "Türkiye",
    terrain: "coast",
    landmark: "sailboat",
    photos: [placeholderPhoto],
  },
  {
    id: "malatya",
    name: "Malatya",
    region: "Türkiye",
    terrain: "mountain",
    landmark: "mountain",
    photos: [placeholderPhoto],
  },
  {
    id: "seoul",
    name: "Seoul",
    region: "South Korea",
    terrain: "city",
    landmark: "tower",
    photos: [placeholderPhoto],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Japan",
    terrain: "city",
    landmark: "torii",
    photos: [placeholderPhoto],
  },
  {
    id: "osaka",
    name: "Osaka",
    region: "Japan",
    terrain: "city",
    landmark: "sushi",
    photos: [osakaCastlePhoto],
  },
];
