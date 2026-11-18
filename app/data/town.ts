import { projects, type Project } from "./projects";

/**
 * A building in the town. `x` and `y` are percentages of the map where the
 * building's base sits; `width` is a percentage of the map width.
 */
type Placement = { art: string; x: number; y: number; width: number };

export type SoundKey = "horn" | "tavern" | "shutter" | "coins" | "chimes" | "chop" | "bell" | "coo";

export type TownBuilding = Placement & {
  id: string;
  name: string;
  /** The Age of Empires building type, shown under the name. */
  kind: string;
  sound: SoundKey;
} & ({ type: "project"; project: Project } | { type: "home" | "writing" | "contact" });

const PROJECT_BUILDINGS: Record<string, Placement & { kind: string; sound: SoundKey }> = {
  Caper: { art: "/town/caper.webp", x: 27, y: 42, width: 15, kind: "Tavern", sound: "tavern" },
  Captures: {
    art: "/town/captures.webp",
    x: 50,
    y: 32,
    width: 14,
    kind: "Workshop",
    sound: "shutter",
  },
  Anybase: {
    art: "/town/anybase.webp",
    x: 73,
    y: 38,
    width: 17,
    kind: "Storehouse",
    sound: "coins",
  },
  "Credit Card Horoscope": {
    art: "/town/credit-card-horoscope.webp",
    x: 85,
    y: 70,
    width: 11,
    kind: "Observatory",
    sound: "chimes",
  },
  sjl: { art: "/town/sjl.webp", x: 17, y: 68, width: 13, kind: "Lumber Camp", sound: "chop" },
};

const HOME: TownBuilding = {
  id: "town-center",
  name: "Jose Valerio",
  kind: "Town Center",
  type: "home",
  sound: "horn",
  art: "/town/town-center.webp",
  x: 51,
  y: 68,
  width: 21,
};

export const townBuildings: TownBuilding[] = [
  HOME,
  ...projects.map((project): TownBuilding => {
    const placement = PROJECT_BUILDINGS[project.title];
    if (!placement) throw new Error(`No town building for project "${project.title}"`);
    return {
      ...placement,
      id: project.title.toLowerCase().replaceAll(" ", "-"),
      name: project.title,
      type: "project",
      project,
    };
  }),
  {
    id: "writing",
    name: "Writing",
    kind: "Monastery",
    type: "writing",
    sound: "bell",
    art: "/town/writing.webp",
    x: 31,
    y: 93,
    width: 15,
  },
  {
    id: "contact",
    name: "Contact",
    kind: "Dovecote",
    type: "contact",
    sound: "coo",
    art: "/town/contact.webp",
    x: 70,
    y: 95,
    width: 8.5,
  },
];

/** Where the villager stands when the game starts: by the Town Center's door. */
export const VILLAGER_START = { x: 57, y: 74 };
