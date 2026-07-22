export type ProjectPreviewProps = {
  title: string;
  description: string;
  links: Array<{
    label: string;
    href: string;
  }>;
};

export function ProjectPreview({
  title,
  description,
  links,
}: ProjectPreviewProps) {
  return (
    <article className="project-row">
      <div className="project-copy">
        <h3>{title}</h3>
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
