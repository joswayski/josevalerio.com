import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import { play, soundStore, toggleMusic, toggleMuted } from "../lib/sound";

/**
 * The Age of Empires frame every page sits in: the carved resource bar on
 * top and a stone footer. On the home page the name in the bar is the h1.
 */
export function GameShell({ children, isHome = false }: { children: ReactNode; isHome?: boolean }) {
  const brand = (
    <Link to="/" className="game-brand" onPointerEnter={() => play("hover")}>
      <Crest />
      Jose Valerio
    </Link>
  );

  return (
    <div className="game">
      <header className="resource-bar">
        {isHome ? <h1>{brand}</h1> : brand}
        <nav className="resources" aria-label="Site">
          <Link to="/" hash="projects" onPointerEnter={() => play("hover")}>
            <ResourceIcon name="projects" />
            Projects <b>{projects.length}</b>
          </Link>
          <Link to="/" hash="writing" onPointerEnter={() => play("hover")}>
            <ResourceIcon name="writing" />
            Writing <b>{postPreviews.length}</b>
          </Link>
          <Link to="/" hash="contact" onPointerEnter={() => play("hover")}>
            <ResourceIcon name="contact" />
            Contact
          </Link>
        </nav>
        <span className="game-age" aria-hidden="true">
          Imperial Age
        </span>
        <SoundButtons />
      </header>
      {children}
      <footer className="game-footer">
        Made by Jose Valerio. No villagers were harmed in the making of this website.
      </footer>
    </div>
  );
}

function SoundButtons() {
  const { music, muted } = useSyncExternalStore(
    soundStore.subscribe,
    soundStore.getSnapshot,
    soundStore.getServerSnapshot,
  );
  return (
    <div className="menu-buttons">
      <button type="button" className="menu-button" aria-pressed={music} onClick={toggleMusic}>
        Music: {music ? "On" : "Off"}
      </button>
      <button type="button" className="menu-button" aria-pressed={muted} onClick={toggleMuted}>
        Sound: {muted ? "Off" : "On"}
      </button>
    </div>
  );
}

function Crest() {
  return (
    <svg viewBox="0 0 24 28" width="22" height="26" aria-hidden="true">
      <path
        d="M2 2h20v11c0 7-5 11.5-10 13C7 24.5 2 20 2 13z"
        fill="#2b5bd7"
        stroke="#f3d684"
        strokeWidth="2"
      />
      <path
        d="M12 6c-1.6 2-1.6 4 0 6 1.6-2 1.6-4 0-6zm-5 5c1 2.6 3 3.6 5 3-1-2.4-3-3.4-5-3zm10 0c-1 2.6-3 3.6-5 3 1-2.4 3-3.4 5-3zM9 16h6v1.6H9z"
        fill="#f3d684"
      />
    </svg>
  );
}

const ICONS = {
  projects: (
    <>
      <path d="M3 21h18M5 21V11l7-5.5 7 5.5v10" fill="#a0743c" stroke="#1a0e05" strokeWidth="1.5" />
      <path d="M10 21v-6h4v6" fill="#3a220c" stroke="#1a0e05" />
      <path d="M3.5 11.5 12 4.5l8.5 7" fill="none" stroke="#c0442a" strokeWidth="2.5" />
    </>
  ),
  writing: (
    <>
      <path d="M4 5h7a2 2 0 0 1 1 1v14H5a1 1 0 0 1-1-1z" fill="#efe0b6" stroke="#1a0e05" />
      <path d="M20 5h-7a2 2 0 0 0-1 1v14h7a1 1 0 0 0 1-1z" fill="#d9c58f" stroke="#1a0e05" />
      <path d="M6 9h4M6 12h4M14 9h4M14 12h4" stroke="#7a5a2a" />
    </>
  ),
  contact: (
    <>
      <path d="M3 8l9 6 9-6v11H3z" fill="#efe0b6" stroke="#1a0e05" />
      <path d="M3 8h18l-9 6z" fill="#d9c58f" stroke="#1a0e05" />
      <circle cx="12" cy="15.5" r="2.2" fill="#b0302a" />
    </>
  ),
};

function ResourceIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
