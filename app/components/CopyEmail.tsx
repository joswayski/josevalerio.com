import { useEffect, useRef, useState } from "react";

const email = "contact@josevalerio.com";

type CopyStatus = "idle" | "copied" | "failed";

type CopyEmailProps = {
  /** Captures-style inline chip used in the home hero. */
  compact?: boolean;
};

/** Legacy path for browsers without the async clipboard API. */
function copyWithExecCommand(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    if (!document.execCommand("copy")) {
      throw new Error('document.execCommand("copy") returned false');
    }
  } finally {
    textarea.remove();
  }
}

export function CopyEmail({ compact = false }: CopyEmailProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function scheduleReset() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 1_800);
  }

  async function handleCopy() {
    try {
      try {
        await navigator.clipboard.writeText(email);
      } catch (clipboardError) {
        console.warn(
          "Clipboard API copy failed, trying execCommand fallback",
          clipboardError,
        );
        copyWithExecCommand(email);
      }
    } catch (error) {
      console.error(`Unable to copy ${email} to the clipboard`, error);
      setStatus("failed");
      scheduleReset();
      return;
    }

    setStatus("copied");
    scheduleReset();
  }

  const label =
    status === "copied"
      ? `Copied ${email}`
      : status === "failed"
        ? `Could not copy ${email}, select it manually`
        : `Copy email ${email}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="email-chip"
        aria-label={label}
      >
        <span className="email-chip-address">
          <MailIcon className="social-icon" />
          <span className="email-chip-text">{email}</span>
        </span>
        <span className="email-chip-status" role="status">
          {status === "copied"
            ? "copied!"
            : status === "failed"
              ? "copy failed - select manually"
              : "click to copy"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="email-button"
      aria-label={label}
    >
      <span>{email}</span>
      <span className="email-button-status" aria-live="polite">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy failed"
            : "Copy"}
      </span>
    </button>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
