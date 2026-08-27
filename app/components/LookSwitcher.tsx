import { useEffect, useState } from "react";
import {
  DEFAULT_LOOK,
  LOOK_STORAGE_KEY,
  LOOKS,
  applyLook,
  isLookId,
  type LookId,
} from "../looks";

export function LookSwitcher() {
  const [look, setLook] = useState<LookId>(DEFAULT_LOOK);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-look");
    if (isLookId(current)) setLook(current);
  }, []);

  function onChoose(next: LookId) {
    setLook(next);
    applyLook(next);
    try {
      localStorage.setItem(LOOK_STORAGE_KEY, next);
    } catch {
      // Ignore private-mode or blocked storage.
    }
  }

  return (
    <div className="look-switcher" role="group" aria-label="Site look">
      <span className="look-switcher-label">Look</span>
      {LOOKS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="look-switcher-option"
          title={item.hint}
          aria-pressed={look === item.id}
          aria-label={`${item.label}: ${item.hint}`}
          onClick={() => onChoose(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
