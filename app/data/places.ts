export type PlacePhoto = {
  objectKey?: string;
  src?: string;
  alt: string;
  width: number;
  height: number;
};

export type PlaceTerrain = "city" | "coast" | "mountain";

export type Place = {
  id: string;
  name: string;
  region: string;
  coordinates: [longitude: number, latitude: number];
  terrain: PlaceTerrain;
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
  src: "https://media.josevalerio.com/places/osaka/Captures_2026-07-22_19-10-28_129.png",
  alt: "Osaka Castle in Osaka, Japan",
  width: 1370,
  height: 1782,
};

// This list is intentionally public and approximate. Keep raw location history,
// visit dates, routes, and precise coordinates out of the website repository.
export const places: Place[] = [
  {
    id: "new-york",
    name: "New York",
    region: "United States",
    coordinates: [-74.01, 40.71],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "new-jersey",
    name: "New Jersey",
    region: "United States",
    coordinates: [-74.62, 40.15],
    terrain: "coast",
    photos: [placeholderPhoto],
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "United States",
    coordinates: [-87.63, 41.88],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "austin",
    name: "Austin",
    region: "United States",
    coordinates: [-97.74, 30.27],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "central-florida",
    name: "Central Florida",
    region: "United States",
    coordinates: [-81.38, 28.54],
    terrain: "coast",
    photos: [placeholderPhoto],
  },
  {
    id: "dominican-republic",
    name: "Dominican Republic",
    region: "Caribbean",
    coordinates: [-70.69, 19.78],
    terrain: "coast",
    photos: [placeholderPhoto],
  },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "Türkiye",
    coordinates: [28.98, 41.01],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "ankara",
    name: "Ankara",
    region: "Türkiye",
    coordinates: [32.86, 39.93],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "izmir",
    name: "Izmir",
    region: "Türkiye",
    coordinates: [27.14, 38.42],
    terrain: "coast",
    photos: [placeholderPhoto],
  },
  {
    id: "bodrum",
    name: "Bodrum",
    region: "Türkiye",
    coordinates: [27.43, 37.03],
    terrain: "coast",
    photos: [placeholderPhoto],
  },
  {
    id: "malatya",
    name: "Malatya",
    region: "Türkiye",
    coordinates: [38.31, 38.36],
    terrain: "mountain",
    photos: [placeholderPhoto],
  },
  {
    id: "seoul",
    name: "Seoul",
    region: "South Korea",
    coordinates: [126.98, 37.57],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Japan",
    coordinates: [139.65, 35.68],
    terrain: "city",
    photos: [placeholderPhoto],
  },
  {
    id: "osaka",
    name: "Osaka",
    region: "Japan",
    coordinates: [135.5, 34.69],
    terrain: "city",
    photos: [osakaCastlePhoto],
  },
];
