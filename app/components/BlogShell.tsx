import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PoastPreviewProps } from "./PoastPreview";
import { ExternalAnchor } from "./ExternalLink";
import { SiteLinks } from "./SiteLinks";
import { formatPostDate } from "../data/postPreviews";

export function BlogShell({ children, post }: { children: ReactNode; post: PoastPreviewProps }) {
  const { title, previewText, dateTime, readingMinutes, link } = post;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <div className="page-shell">
      <div className="site-panel">
        <header className="site-header">
          <Link to="/" className="back-link" preload="intent">
            <span aria-hidden="true">←</span> Back
          </Link>
          <SiteLinks />
        </header>

        <main className="site-panel">
          <header className="article-header">
            <span className="article-meta">
              <time dateTime={dateTime}>{formatPostDate(dateTime)}</time> · {readingMinutes} min
              read
            </span>
            <h1>{title}</h1>
            <p className="article-summary">{previewText}</p>
          </header>

          <article className="article-body">{children}</article>

          <footer className="article-footer">
            <ExternalAnchor href={githubEditUrl} className="suggest-changes-link">
              Suggest an edit <span aria-hidden="true">↗</span>
            </ExternalAnchor>
          </footer>
        </main>
      </div>
    </div>
  );
}
