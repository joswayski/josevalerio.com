import { useEffect, useRef, useState } from "react";

const email = "contact@josevalerio.com";

type CopyStatus = "idle" | "copied" | "failed";

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

/** Header chip that copies the email address; shows it as text if copying fails. */
export function CopyEmail() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function scheduleReset(delay: number) {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), delay);
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
      scheduleReset(8_000);
      return;
    }

    setStatus("copied");
    scheduleReset(1_800);
  }

  const label =
    status === "copied"
      ? `Copied ${email}`
      : status === "failed"
        ? `Could not copy ${email}, select it manually`
        : `Copy email ${email}`;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="chip"
        aria-label={label}
        title={email}
      >
        <span role="status">
          {status === "copied" ? (
            <span className="chip-status">Copied</span>
          ) : status === "failed" ? (
            <span className="chip-status">Copy failed</span>
          ) : (
            "Email"
          )}
        </span>
        <span aria-hidden="true">⧉</span>
      </button>
      {status === "failed" && <span className="email-fallback">{email}</span>}
    </>
  );
}
