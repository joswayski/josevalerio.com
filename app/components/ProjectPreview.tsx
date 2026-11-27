import { ExternalAnchor, ExternalIcon } from "./ExternalLink";

export type ProjectPreviewProps = {
  title: string;
  description: string;
  href: string;
  destination: string;
  latencyMs?: number | null;
  isPinging?: boolean;
};

export function ProjectPreview({
  title,
  description,
  href,
  destination,
  latencyMs,
  isPinging = false,
}: ProjectPreviewProps) {
  const latencyLabel = typeof latencyMs === "number" ? String(latencyMs) : isPinging ? "..." : "--";

  return (
    <ExternalAnchor href={href} className="project-card">
      <svg
        className="row-glyph"
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M5.5 1L9.5 2.4V5.6C9.5 7.7 7.8 9.3 5.5 10C3.2 9.3 1.5 7.7 1.5 5.6V2.4L5.5 1Z"
          fill="currentColor"
        />
      </svg>
      <div className="project-row-main">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="project-destination">
        <span>{destination}</span>
        <ExternalIcon className="project-arrow external-icon" />
      </span>
      <span
        className="project-latency"
        aria-label={typeof latencyMs === "number" ? `${latencyMs} ms latency` : undefined}
      >
        {latencyLabel}
      </span>
    </ExternalAnchor>
  );
}
