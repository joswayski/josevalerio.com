import { projects, type Project } from "./projects";

/**
 * A building on the island map. `x` and `y` are percentages of the stage
 * where the building's base sits; `width` is a percentage of the stage width.
 */
type Placement = { art: string; x: number; y: number; width: number };

export type IslandSpot = Placement & { id: string; label: string } & (
    | { kind: "project"; project: Project }
    | { kind: "writing" }
    | { kind: "contact" }
  );

const PROJECT_PLACEMENTS: Record<string, Placement> = {
  Caper: { art: "/island/caper.svg", x: 26, y: 47, width: 22 },
  Captures: { art: "/island/captures.svg", x: 50, y: 41, width: 18 },
  Anybase: { art: "/island/anybase.svg", x: 76, y: 47, width: 26 },
  "Credit Card Horoscope": {
    art: "/island/credit-card-horoscope.svg",
    x: 32,
    y: 79,
    width: 19,
  },
  sjl: { art: "/island/sjl.svg", x: 79, y: 78, width: 20 },
};

export const islandSpots: IslandSpot[] = [
  ...projects.map((project): IslandSpot => {
    const placement = PROJECT_PLACEMENTS[project.title];
    if (!placement) throw new Error(`No island placement for project "${project.title}"`);
    return {
      ...placement,
      id: project.title.toLowerCase().replaceAll(" ", "-"),
      label: project.title,
      kind: "project",
      project,
    };
  }),
  {
    id: "writing",
    label: "Writing",
    kind: "writing",
    art: "/island/writing.svg",
    x: 13,
    y: 70,
    width: 13,
  },
  {
    id: "contact",
    label: "Contact",
    kind: "contact",
    art: "/island/contact.svg",
    x: 61,
    y: 87,
    width: 16,
  },
];

/** Where the penguin stands when the game starts: the top of the dock. */
export const PENGUIN_START = { x: 48, y: 90 };
