import { ExternalAnchor } from "./ExternalLink";

export type ProjectPreviewProps = {
  title: string;
  description: string;
  href: string;
  destination: string;
};

export function ProjectPreview({ title, description, href, destination }: ProjectPreviewProps) {
  return (
    <ExternalAnchor href={href} className="project-card">
      <span className="server-status-pip" aria-hidden="true" />
      <div className="project-row-main">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="project-destination">
        {destination}{" "}
        <span className="project-arrow" aria-hidden="true">
          ↗
        </span>
      </span>
      <span className="server-signal" aria-hidden="true">
        <span className="server-signal-bar server-signal-bar--1" />
        <span className="server-signal-bar server-signal-bar--2" />
        <span className="server-signal-bar server-signal-bar--3" />
      </span>
    </ExternalAnchor>
  );
}
