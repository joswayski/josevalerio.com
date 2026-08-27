import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalAnchor } from "./ExternalLink";
import type { PostPath } from "./PoastPreview";

type PreviewRowProps = {
  variant: "post" | "project";
  title: string;
  description: string;
  /** Trailing column contents, e.g. a date or a destination host. */
  meta: ReactNode;
  arrow: string;
} & ({ to: PostPath } | { href: string });

export function PreviewRow({
  variant,
  title,
  description,
  meta,
  arrow,
  ...target
}: PreviewRowProps) {
  const className = `preview-row preview-row--${variant}`;
  const body = (
    <>
      <div className="preview-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="preview-meta">
        {meta}
        <span className="preview-arrow" aria-hidden="true">
          {arrow}
        </span>
      </div>
    </>
  );

  if ("to" in target) {
    return (
      <Link to={target.to} preload="intent" className={className}>
        {body}
      </Link>
    );
  }

  return (
    <ExternalAnchor href={target.href} className={className}>
      {body}
    </ExternalAnchor>
  );
}
