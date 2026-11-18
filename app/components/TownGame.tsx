import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalAnchor } from "./ExternalLink";
import { formatPostDate, postPreviews } from "../data/postPreviews";
import { townBuildings, VILLAGER_START, type TownBuilding } from "../data/town";
import { play, playBuilding } from "../lib/sound";

type Point = { x: number; y: number };
type ChatLine = { id: number; text: string; system?: boolean };

const EMAIL = "contact@josevalerio.com";
const X_URL = "https://x.com/josevalerio";
const GITHUB_URL = "https://github.com/joswayski";

// The map is 16:9, so a percent of width is 16/9 longer on screen than a percent of height.
const MAP_ASPECT = 16 / 9;
const WALK_MS_PER_UNIT = 22;

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The Age of Empires town: click a building to select it. The command panel
 * below the map shows what the building holds, and a villager walks over.
 */
export function TownGame() {
  const [selectedId, setSelectedId] = useState(townBuildings[0].id);
  const [villager, setVillager] = useState<Point>(VILLAGER_START);
  const [walkMs, setWalkMs] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [chat, setChat] = useState<ChatLine[]>([
    { id: 0, text: "Jose Valerio has advanced to the Imperial Age.", system: true },
    { id: 1, text: "Click a building to look inside." },
  ]);
  const villagerRef = useRef(VILLAGER_START);
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatId = useRef(2);

  useEffect(() => () => walkTimers.current.forEach(clearTimeout), []);

  const selected = townBuildings.find((building) => building.id === selectedId) ?? townBuildings[0];

  function say(text: string) {
    const line = { id: chatId.current++, text };
    setChat((lines) => [...lines.slice(-3), line]);
  }

  function walkTo(target: Point) {
    walkTimers.current.forEach(clearTimeout);
    walkTimers.current = [];
    const from = villagerRef.current;
    const distance = Math.hypot((target.x - from.x) * MAP_ASPECT, target.y - from.y);
    const ms = reducedMotion() ? 0 : Math.round(distance * WALK_MS_PER_UNIT);
    if (target.x !== from.x) setFacing(target.x < from.x ? -1 : 1);
    villagerRef.current = target;
    setWalkMs(ms);
    setVillager(target);
    for (let t = 0; t < ms; t += 240) walkTimers.current.push(setTimeout(() => play("step"), t));
    walkTimers.current.push(setTimeout(() => setWalkMs(0), ms));
  }

  function select(building: TownBuilding) {
    setSelectedId(building.id);
    play("click");
    playBuilding(building.sound);
    say(`You selected ${building.name} (${building.kind}).`);
    // Stand just in front of the building, on the open ground below it.
    walkTo({ x: building.x + building.width * 0.35, y: Math.min(97, building.y + 3) });
  }

  function step(delta: number) {
    play("button");
    const index = townBuildings.findIndex((building) => building.id === selected.id);
    select(townBuildings[(index + delta + townBuildings.length) % townBuildings.length]);
  }

  return (
    <section className="town" aria-label="The town">
      {/* On narrow screens the map keeps its size and scrolls sideways. */}
      <div className="town-viewport">
        <div className="town-map">
          <img className="town-terrain" src="/town/terrain.webp" alt="" draggable={false} />

          {townBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              className={`town-building${building.id === selected.id ? " is-selected" : ""}`}
              style={{
                left: `${building.x}%`,
                top: `${building.y}%`,
                width: `${building.width}%`,
                zIndex: Math.round(building.y),
              }}
              aria-label={buildingLabel(building)}
              aria-pressed={building.id === selected.id}
              onPointerEnter={() => play("hover")}
              onClick={() => select(building)}
            >
              <span className="town-selection" aria-hidden="true" />
              <img src={building.art} alt="" draggable={false} />
              <span className="town-plaque" aria-hidden="true">
                {building.name}
              </span>
            </button>
          ))}

          <div
            className={`town-villager${walkMs ? " is-walking" : ""}`}
            style={{
              left: `${villager.x}%`,
              top: `${villager.y}%`,
              zIndex: Math.round(villager.y) + 1,
              transitionDuration: `${walkMs}ms`,
            }}
            aria-hidden="true"
          >
            <img src="/town/villager.webp" alt="" style={{ scale: `${facing} 1` }} />
          </div>
          <div className="town-wanderer town-wanderer-1" aria-hidden="true">
            <img src="/town/villager.webp" alt="" />
          </div>
          <div className="town-wanderer town-wanderer-2" aria-hidden="true">
            <img src="/town/villager.webp" alt="" />
          </div>

          <div className="town-chat" aria-live="polite">
            {chat.map((line) => (
              <p key={line.id} className={line.system ? "is-system" : undefined}>
                {line.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="command-panel">
        <Minimap selectedId={selected.id} onSelect={select} />
        <div className="selection-info">
          <div className="selection-portrait">
            <img src={selected.art} alt="" />
            <span className="selection-hp" aria-hidden="true" />
          </div>
          <div className="selection-text">
            <p className="selection-name">{selected.name}</p>
            <p className="selection-kind">
              {selected.kind}
              {selected.type === "project" && ` · ${selected.project.destination}`}
            </p>
            <SelectionBody building={selected} />
          </div>
        </div>
        <div className="commands">
          <SelectionCommands building={selected} />
          <button type="button" className="command" onClick={() => step(-1)}>
            <CommandIcon name="prev" />
            Prev
          </button>
          <button type="button" className="command" onClick={() => step(1)}>
            <CommandIcon name="next" />
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function buildingLabel(building: TownBuilding) {
  if (building.type === "project") return `${building.name}: ${building.project.description}`;
  if (building.type === "writing") return "Writing: my blog posts";
  if (building.type === "contact") return "Contact: ways to reach me";
  return "Jose Valerio: about me";
}

function SelectionBody({ building }: { building: TownBuilding }) {
  switch (building.type) {
    case "home":
      return (
        <p className="selection-desc">
          I fix shipping labels at <ExternalAnchor href="https://stockx.com">StockX</ExternalAnchor>
          . Sometimes I make things. Click a building to see what's inside.
        </p>
      );
    case "project":
      return <p className="selection-desc">{building.project.description}</p>;
    case "writing":
      return (
        <ul className="selection-posts">
          {postPreviews.map((post) => (
            <li key={post.link}>
              <Link to={post.link} preload="intent" onClick={() => play("button")}>
                <span>{post.title}</span>
                <time dateTime={post.dateTime}>
                  {formatPostDate(post.dateTime)} · {post.readingMinutes} min
                </time>
              </Link>
            </li>
          ))}
        </ul>
      );
    case "contact":
      return (
        <p className="selection-desc">
          Send a pigeon. Or, you know, an email: <b>{EMAIL}</b>
        </p>
      );
  }
}

function SelectionCommands({ building }: { building: TownBuilding }) {
  if (building.type === "project") {
    return (
      <ExternalAnchor href={building.project.href} className="command command-wide">
        <CommandIcon name="visit" />
        Visit {building.project.destination}
      </ExternalAnchor>
    );
  }
  if (building.type === "writing") return <span className="command-gap" />;
  return (
    <>
      <ExternalAnchor href={X_URL} className="command">
        <CommandIcon name="x" />X
      </ExternalAnchor>
      <ExternalAnchor href={GITHUB_URL} className="command">
        <CommandIcon name="github" />
        GitHub
      </ExternalAnchor>
      <a href={`mailto:${EMAIL}`} className="command">
        <CommandIcon name="mail" />
        Email
      </a>
    </>
  );
}

function Minimap({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (building: TownBuilding) => void;
}) {
  return (
    <div className="minimap" aria-hidden="true">
      <div className="minimap-diamond">
        {townBuildings.map((building) => (
          <span
            key={building.id}
            className={`minimap-dot${building.id === selectedId ? " is-selected" : ""}`}
            style={{ left: `${18 + building.x * 0.64}%`, top: `${14 + building.y * 0.7}%` }}
            onClick={() => onSelect(building)}
          />
        ))}
      </div>
    </div>
  );
}

const COMMAND_ICONS: Record<string, ReactNode> = {
  visit: <path d="M6 18 18 6M9 6h9v9" fill="none" stroke="currentColor" strokeWidth="2.5" />,
  prev: <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.5" />,
  next: <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" />,
  x: <path d="M5 4h4l3 5 3-5h4l-5 8 5 8h-4l-3-5-3 5H5l5-8z" fill="currentColor" />,
  github: (
    <path
      d="M12 2a10 10 0 0 0-3 19.5c.5 0 .7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9 9 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"
      fill="currentColor"
    />
  ),
  mail: (
    <>
      <rect x="3" y="6" width="18" height="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m3 6 9 7 9-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
};

function CommandIcon({ name }: { name: keyof typeof COMMAND_ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {COMMAND_ICONS[name]}
    </svg>
  );
}
