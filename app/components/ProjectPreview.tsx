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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="project-row"
    >
      <div className="project-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="project-meta">
        <span>{destination}</span>
        <span className="project-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
    </a>
  );
}
