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

export type PlaceAreaType = "city" | "country" | "region" | "state";

export type Place = {
  id: string;
  name: string;
  areaType: PlaceAreaType;
  countryId: string;
  countryName: string;
  terrain: PlaceTerrain;
  landmark: PlaceLandmark;
  note?: string;
  photos: PlacePhoto[];
};

export type PlaceCountry = {
  id: string;
  name: string;
  places: Place[];
};

type CountryPlace = Omit<Place, "countryId" | "countryName">;

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

function defineCountry(
  id: string,
  name: string,
  destinations: CountryPlace[],
): PlaceCountry {
  return {
    id,
    name,
    places: destinations.map((destination) => ({
      ...destination,
      countryId: id,
      countryName: name,
    })),
  };
}

// This data is intentionally public and thematic. Countries are the grouping
// layer; each city, state, or region owns its own gallery. To add photos, find
// the country, find the destination, then append curated R2 objects to that
// destination's photos array. Every configured object becomes a gallery slide.
//
// Keep raw location history, visit dates, routes, and precise coordinates out
// of the website repository.
export const placeCountries: PlaceCountry[] = [
  defineCountry("united-states", "United States", [
    {
      id: "new-york",
      name: "New York",
      areaType: "city",
      terrain: "city",
      landmark: "skyline",
      photos: [placeholderPhoto],
    },
    {
      id: "new-jersey",
      name: "New Jersey",
      areaType: "state",
      terrain: "coast",
      landmark: "lighthouse",
      photos: [placeholderPhoto],
    },
    {
      id: "rhode-island",
      name: "Rhode Island",
      areaType: "state",
      terrain: "coast",
      landmark: "sailboat",
      photos: [placeholderPhoto],
    },
    {
      id: "chicago",
      name: "Chicago",
      areaType: "city",
      terrain: "city",
      landmark: "skyline",
      photos: [placeholderPhoto],
    },
    {
      id: "austin",
      name: "Austin",
      areaType: "city",
      terrain: "city",
      landmark: "barbecue",
      photos: [placeholderPhoto],
    },
    {
      id: "central-florida",
      name: "Central Florida",
      areaType: "region",
      terrain: "coast",
      landmark: "orange",
      photos: [placeholderPhoto],
    },
  ]),
  defineCountry("dominican-republic", "Dominican Republic", [
    {
      id: "dominican-republic",
      name: "Dominican Republic",
      areaType: "country",
      terrain: "coast",
      landmark: "palm",
      photos: [placeholderPhoto],
    },
  ]),
  defineCountry("turkiye", "Türkiye", [
    {
      id: "istanbul",
      name: "Istanbul",
      areaType: "city",
      terrain: "city",
      landmark: "mosque",
      photos: [placeholderPhoto],
    },
    {
      id: "ankara",
      name: "Ankara",
      areaType: "city",
      terrain: "city",
      landmark: "mosque",
      photos: [placeholderPhoto],
    },
    {
      id: "izmir",
      name: "Izmir",
      areaType: "city",
      terrain: "coast",
      landmark: "sailboat",
      photos: [placeholderPhoto],
    },
    {
      id: "bodrum",
      name: "Bodrum",
      areaType: "city",
      terrain: "coast",
      landmark: "sailboat",
      photos: [placeholderPhoto],
    },
    {
      id: "malatya",
      name: "Malatya",
      areaType: "city",
      terrain: "mountain",
      landmark: "mountain",
      photos: [placeholderPhoto],
    },
  ]),
  defineCountry("south-korea", "South Korea", [
    {
      id: "seoul",
      name: "Seoul",
      areaType: "city",
      terrain: "city",
      landmark: "tower",
      photos: [placeholderPhoto],
    },
  ]),
  defineCountry("japan", "Japan", [
    {
      id: "tokyo",
      name: "Tokyo",
      areaType: "city",
      terrain: "city",
      landmark: "torii",
      photos: [placeholderPhoto],
    },
    {
      id: "osaka",
      name: "Osaka",
      areaType: "city",
      terrain: "city",
      landmark: "sushi",
      photos: [osakaCastlePhoto],
    },
  ]),
];

export const places = placeCountries.flatMap((country) => country.places);

export const placeCountryById = new Map(
  placeCountries.map((country) => [country.id, country]),
);
