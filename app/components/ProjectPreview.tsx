import { ExternalAnchor } from "./ExternalLink";

export type ProjectPreviewProps = {
  title: string;
  description: string;
  href: string;
  destination: string;
};

export function ProjectPreview({
  title,
  description,
  href,
  destination,
}: ProjectPreviewProps) {
  return (
    <ExternalAnchor href={href} className="project-card">
      <div className="project-card-top">
        <h3>{title}</h3>
        <span className="project-destination">
          {destination}{" "}
          <span className="project-arrow" aria-hidden="true">
            ↗
          </span>
        </span>
      </div>
      <p>{description}</p>
    </ExternalAnchor>
  );
}
