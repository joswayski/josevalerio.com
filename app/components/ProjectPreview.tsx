export type ProjectPreviewProps = {
  title: string;
  description: string;
  status: string;
  links: Array<{
    label: string;
    href: string;
  }>;
};

export function ProjectPreview({
  title,
  description,
  status,
  links,
}: ProjectPreviewProps) {
  return (
    <article className="project-row">
      <div className="project-copy">
        <div className="project-title-line">
          <h3>{title}</h3>
          <span className="project-status">{status}</span>
        </div>
        <p>{description}</p>
      </div>

      <nav className="project-links" aria-label={`${title} links`}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
    </article>
  );
}
