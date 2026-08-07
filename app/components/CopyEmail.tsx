import { useEffect, useRef, useState } from "react";

const email = "contact@josevalerio.com";

type CopyEmailProps = {
  /** Captures-style inline chip used in the home hero. */
  compact?: boolean;
};

export function CopyEmail({ compact = false }: CopyEmailProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Fallback for older browsers or denied clipboard permission.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = email;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        window.location.href = `mailto:${email}`;
        return;
      }
    }

    setCopied(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), 1_800);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="email-chip"
        aria-label={copied ? `Copied ${email}` : `Copy email ${email}`}
      >
        <span className="email-chip-address">
          <MailIcon className="social-icon" />
          <span className="email-chip-text">{email}</span>
        </span>
        <span className="email-chip-status" role="status">
          {copied ? "copied!" : "click to copy"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="email-button"
      aria-label={`Copy ${email}`}
    >
      <span>{email}</span>
      <span className="email-button-status" aria-live="polite">
        {copied ? "Copied" : "Copy"}
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
