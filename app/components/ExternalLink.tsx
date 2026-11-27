type ExternalAnchorProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Anchor to another site, with the safe target/rel pair applied. */
export function ExternalAnchor({
  href,
  children,
  className,
  "aria-label": ariaLabel,
}: ExternalAnchorProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

type ExternalLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function ExternalLink({ href, children, className = "" }: ExternalLinkProps) {
  return (
    <ExternalAnchor href={href} className={`text-link ${className}`}>
      {children}
    </ExternalAnchor>
  );
}

/** Crisp inline SVG external-link icon (square with outgoing arrow). */
export function ExternalIcon({ className = "external-icon" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9.5 6.75V9.75H2.25V2.5H5.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <path d="M7 2.25H9.75V5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
      <path d="M5.75 6.25L9.5 2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
