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

export function ExternalLink({
  href,
  children,
  className = "",
}: ExternalLinkProps) {
  return (
    <ExternalAnchor href={href} className={`text-link ${className}`}>
      {children}
    </ExternalAnchor>
  );
}
