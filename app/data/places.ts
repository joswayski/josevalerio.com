export type PlacePhoto = {
  objectKey: string;
  alt: string;
  width: number;
  height: number;
};

export type Place = {
  id: string;
  name: string;
  region: string;
  coordinates: [longitude: number, latitude: number];
  note?: string;
  photos: PlacePhoto[];
};

// This list is intentionally public and approximate. Keep raw location history,
// visit dates, routes, and precise coordinates out of the website repository.
export const places: Place[] = [
  {
    id: "new-york",
    name: "New York",
    region: "United States",
    coordinates: [-74.01, 40.71],
    photos: [],
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "United States",
    coordinates: [-87.63, 41.88],
    photos: [],
  },
  {
    id: "austin",
    name: "Austin",
    region: "United States",
    coordinates: [-97.74, 30.27],
    photos: [],
  },
  {
    id: "central-florida",
    name: "Central Florida",
    region: "United States",
    coordinates: [-81.38, 28.54],
    photos: [],
  },
  {
    id: "dominican-republic",
    name: "Dominican Republic",
    region: "Caribbean",
    coordinates: [-70.69, 19.78],
    photos: [],
  },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "Türkiye",
    coordinates: [28.98, 41.01],
    photos: [],
  },
  {
    id: "ankara",
    name: "Ankara",
    region: "Türkiye",
    coordinates: [32.86, 39.93],
    photos: [],
  },
  {
    id: "izmir",
    name: "Izmir",
    region: "Türkiye",
    coordinates: [27.14, 38.42],
    photos: [],
  },
  {
    id: "bodrum",
    name: "Bodrum",
    region: "Türkiye",
    coordinates: [27.43, 37.03],
    photos: [],
  },
  {
    id: "malatya",
    name: "Malatya",
    region: "Türkiye",
    coordinates: [38.31, 38.36],
    photos: [],
  },
  {
    id: "seoul",
    name: "Seoul",
    region: "South Korea",
    coordinates: [126.98, 37.57],
    photos: [],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Japan",
    coordinates: [139.65, 35.68],
    photos: [],
  },
  {
    id: "osaka",
    name: "Osaka",
    region: "Japan",
    coordinates: [135.5, 34.69],
    photos: [],
  },
];
