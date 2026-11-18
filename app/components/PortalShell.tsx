import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import { play, soundStore, toggleMusic } from "../lib/sound";

/** The early-2000s game portal frame every page sits in: logo, nav, news ticker, footer. */
export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="portal">
      <header className="portal-header">
        <Link to="/" className="portal-logo" aria-label="Jose Valerio, home">
          <img src="/island/penguin.svg" alt="" width={72} height={82} />
          <span className="portal-logo-text" aria-hidden="true">
            JoseValerio<small>.com</small>
          </span>
        </Link>
        <VisitCounter />
      </header>
      <nav className="portal-nav" aria-label="Site">
        <Link to="/" onPointerEnter={() => play("tick")}>
          <NavIcon name="home" />
          Home
        </Link>
        <Link to="/" hash="projects" onPointerEnter={() => play("tick")}>
          <NavIcon name="projects" />
          Projects
        </Link>
        <Link to="/" hash="writing" onPointerEnter={() => play("tick")}>
          <NavIcon name="writing" />
          Writing
        </Link>
        <Link to="/" hash="contact" onPointerEnter={() => play("tick")}>
          <NavIcon name="contact" />
          Contact
        </Link>
        <MusicButton />
      </nav>
      <Ticker />
      {children}
      <footer className="portal-footer">
        Made by Jose Valerio. No penguins were harmed in the making of this website.
      </footer>
    </div>
  );
}

function MusicButton() {
  const { music } = useSyncExternalStore(
    soundStore.subscribe,
    soundStore.getSnapshot,
    soundStore.getServerSnapshot,
  );
  return (
    <button
      type="button"
      aria-pressed={music}
      onPointerEnter={() => play("tick")}
      onClick={toggleMusic}
    >
      <NavIcon name="music" />
      Music: {music ? "On" : "Off"}
    </button>
  );
}

function Ticker() {
  const [newest] = postPreviews;
  const items = [
    `New post: "${newest.title}" (${newest.previewText})`,
    ...projects.map((project) => `${project.title}: ${project.description}`),
  ];
  const text = items.join("  ★  ");
  return (
    <div className="portal-ticker" aria-label="News">
      {/* Two copies so the loop scrolls without a gap; the second is decorative. */}
      <div className="portal-ticker-track">
        <span>★ {text} ★&nbsp;&nbsp;</span>
        <span aria-hidden="true">★ {text} ★&nbsp;&nbsp;</span>
      </div>
    </div>
  );
}

const VISITS_KEY = "jose-island-visits";

/** A hit counter for this browser only: it counts your visits, one per browser session. */
function VisitCounter() {
  const [visits, setVisits] = useState<number | null>(null);

  useEffect(() => {
    try {
      let count = Number(localStorage.getItem(VISITS_KEY)) || 0;
      if (!sessionStorage.getItem(VISITS_KEY)) {
        count += 1;
        localStorage.setItem(VISITS_KEY, String(count));
        sessionStorage.setItem(VISITS_KEY, "counted");
      }
      setVisits(count);
    } catch {
      // Storage can be disabled; the counter then stays blank.
    }
  }, []);

  const digits = visits === null ? "-------" : String(visits).padStart(7, "0");
  return (
    <div className="portal-counter">
      <span>Your visit number</span>
      <span
        className="portal-counter-digits"
        aria-label={visits === null ? undefined : String(visits)}
      >
        {digits.split("").map((digit, index) => (
          <span key={index} aria-hidden="true">
            {digit}
          </span>
        ))}
      </span>
    </div>
  );
}

const ICON_PATHS = {
  home: "M3 11 12 3l9 8v10h-6v-6H9v6H3z",
  projects:
    "M7 7h10a5 5 0 0 1 5 5v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a5 5 0 0 1 5-5zm0 3v2H5v2h2v2h2v-2h2v-2H9v-2zm9 1.5a1.3 1.3 0 1 0 0 .1zm2.5 2.5a1.3 1.3 0 1 0 0 .1z",
  writing: "M4 20l1-5L16 4l4 4L9 19zm11-14 3 3",
  contact: "M3 6h18v12H3zm0 0 9 7 9-7",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z",
};

function NavIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  const filled = name === "home" || name === "projects";
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d={ICON_PATHS[name]}
        fill={filled ? "#fff" : "none"}
        stroke={filled ? "#7a3000" : "#fff"}
        strokeWidth={filled ? 1.4 : 2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
