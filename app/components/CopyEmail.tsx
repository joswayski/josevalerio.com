import { useState } from "react";

const email = "contact@josevalerio.com";

type CopyEmailProps = {
  compact?: boolean;
};

export function CopyEmail({ compact = false }: CopyEmailProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`email-button${compact ? " email-button--compact" : ""}`}
      aria-label={`Copy ${email}`}
    >
      <span aria-live={compact ? "polite" : undefined}>
        {compact && copied ? "Email copied" : email}
      </span>
      {!compact && (
        <span className="email-button-status" aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </span>
      )}
    </button>
  );
}
