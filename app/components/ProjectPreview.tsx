import { PreviewRow } from "./PreviewRow";

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
    <PreviewRow
      variant="project"
      href={href}
      title={title}
      description={description}
      meta={<span>{destination}</span>}
      arrow="↗"
    />
  );
}
