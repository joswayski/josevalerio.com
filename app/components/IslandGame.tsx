import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalAnchor } from "./ExternalLink";
import { SiteLinks } from "./SiteLinks";
import { formatPostDate, postPreviews } from "../data/postPreviews";
import { islandSpots, PENGUIN_START, type IslandSpot } from "../data/island";
import { play, soundStore, toggleMuted } from "../lib/sound";

type Phase = "loading" | "ready" | "playing";
type Point = { x: number; y: number };

// The island's walkable snow, in stage percentages.
const BOUNDS = { minX: 8, maxX: 92, minY: 20, maxY: 90 };
// The stage is 3:2, so a percent of width is 1.5× longer on screen than a percent of height.
const STAGE_ASPECT = 1.5;
const WALK_MS_PER_UNIT = 26;

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The Flash-style island: a fake preloader, then a penguin that waddles to
 * whichever building you click and opens that building's popup.
 */
export function IslandGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [penguin, setPenguin] = useState<Point>(PENGUIN_START);
  const [walkMs, setWalkMs] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const penguinRef = useRef(PENGUIN_START);
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSpotButton = useRef<HTMLButtonElement | null>(null);
  const { muted } = useSyncExternalStore(
    soundStore.subscribe,
    soundStore.getSnapshot,
    soundStore.getServerSnapshot,
  );

  useEffect(() => {
    if (phase !== "loading") return;
    if (reducedMotion()) {
      setProgress(100);
      setPhase("ready");
      return;
    }
    const timer = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 6 + Math.random() * 12);
        if (next === 100) setPhase("ready");
        return next;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      walkTimers.current.forEach(clearTimeout);
      clearTimeout(bubbleTimer.current);
    },
    [],
  );

  function say(text: string) {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 2400);
  }

  function walkTo(target: Point, onArrive?: () => void) {
    walkTimers.current.forEach(clearTimeout);
    walkTimers.current = [];
    const from = penguinRef.current;
    const distance = Math.hypot((target.x - from.x) * STAGE_ASPECT, target.y - from.y);
    const ms = reducedMotion() ? 0 : Math.round(Math.max(150, distance * WALK_MS_PER_UNIT));
    if (target.x !== from.x) setFacing(target.x < from.x ? -1 : 1);
    penguinRef.current = target;
    setWalkMs(ms);
    setPenguin(target);
    for (let t = 0; t < ms; t += 170) {
      walkTimers.current.push(setTimeout(() => play("step"), t));
    }
    walkTimers.current.push(
      setTimeout(() => {
        setWalkMs(0);
        onArrive?.();
      }, ms),
    );
  }

  function start() {
    play("go");
    setPhase("playing");
    say("Welcome to my island!");
  }

  function visit(spot: IslandSpot, button: HTMLButtonElement) {
    lastSpotButton.current = button;
    setOpenId(null);
    play("pop");
    walkTo({ x: spot.x, y: Math.min(BOUNDS.maxY, spot.y + 3) }, () => {
      say(`${spot.label}!`);
      play("boing");
      setOpenId(spot.id);
    });
  }

  function closePopup() {
    if (!openId) return;
    play("close");
    setOpenId(null);
    lastSpotButton.current?.focus();
  }

  function walkOnSnow(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOpenId(null);
    walkTo({
      x: Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, x)),
      y: Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, y)),
    });
  }

  const openSpot = islandSpots.find((spot) => spot.id === openId);

  return (
    <section className="island-frame" aria-label="Jose Island">
      <div className="island-stage" onKeyDown={(event) => event.key === "Escape" && closePopup()}>
        {/* Clicking open snow walks the penguin there. Every building is also a button. */}
        <div className="island-snow" onClick={walkOnSnow} aria-hidden="true" />
        <img className="island-map" src="/island/map.svg" alt="" draggable={false} />

        {islandSpots.map((spot) => (
          <button
            key={spot.id}
            type="button"
            className="island-spot"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.width}%`,
              zIndex: Math.round(spot.y),
            }}
            aria-label={spotLabel(spot)}
            aria-haspopup="dialog"
            tabIndex={phase === "playing" ? 0 : -1}
            onPointerEnter={() => play("tick")}
            onClick={(event) => visit(spot, event.currentTarget)}
          >
            <img src={spot.art} alt="" draggable={false} />
            <span className="island-spot-label">{spot.label}</span>
          </button>
        ))}

        <div
          className={`island-penguin${walkMs ? " is-walking" : ""}`}
          style={{
            left: `${penguin.x}%`,
            top: `${penguin.y}%`,
            zIndex: Math.round(penguin.y) + 1,
            transitionDuration: `${walkMs}ms`,
          }}
          aria-hidden="true"
        >
          {bubble && <span className="island-bubble">{bubble}</span>}
          <img src="/island/penguin.svg" alt="" style={{ scale: `${facing} 1` }} />
        </div>

        {openSpot && <SpotPopup spot={openSpot} onClose={closePopup} />}

        {phase !== "playing" && (
          <div className="island-preloader">
            <p>{phase === "loading" ? "LOADING..." : "READY!"}</p>
            <div className="island-loadbar" role="progressbar" aria-valuenow={Math.floor(progress)}>
              <i style={{ width: `${progress}%` }} />
            </div>
            <p className="island-percent">{Math.floor(progress)}%</p>
            <button
              type="button"
              className="big-button"
              disabled={phase !== "ready"}
              onClick={start}
            >
              PLAY!
            </button>
          </div>
        )}
      </div>
      <div className="island-toolbar">
        <span>Click a building to visit it!</span>
        <button type="button" aria-pressed={muted} onClick={toggleMuted}>
          Sound: {muted ? "Off" : "On"}
        </button>
      </div>
    </section>
  );
}

function spotLabel(spot: IslandSpot) {
  if (spot.kind === "project") return `${spot.label}: ${spot.project.description}`;
  return spot.kind === "writing" ? "Writing: my blog posts" : "Contact: ways to reach me";
}

function SpotPopup({ spot, onClose }: { spot: IslandSpot; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = `island-popup-${spot.id}`;

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("a, button:not(.island-popup-close)")?.focus();
  }, [spot.id]);

  return (
    <div className="island-popup" role="dialog" aria-labelledby={titleId} ref={dialog}>
      <button type="button" className="island-popup-close" aria-label="Close" onClick={onClose}>
        X
      </button>
      <img src={spot.art} alt="" className="island-popup-art" />
      <h2 id={titleId}>{spot.label}</h2>
      {spot.kind === "project" && (
        <>
          <p className="island-popup-dest">{spot.project.destination}</p>
          <p>{spot.project.description}</p>
          <ExternalAnchor href={spot.project.href} className="big-button">
            GO!
          </ExternalAnchor>
        </>
      )}
      {spot.kind === "writing" && (
        <ul className="island-popup-posts">
          {postPreviews.map((post) => (
            <li key={post.link}>
              <Link to={post.link} onClick={() => play("go")}>
                {post.title}
                <small>
                  {formatPostDate(post.dateTime)} · {post.readingMinutes} min read
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {spot.kind === "contact" && (
        <>
          <p>Send me a letter! Or find me here:</p>
          <SiteLinks />
        </>
      )}
    </div>
  );
}
