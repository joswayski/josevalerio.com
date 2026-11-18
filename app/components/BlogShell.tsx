import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PoastPreviewProps } from "../data/postPreviews";
import { ExternalAnchor } from "./ExternalLink";
import { PortalShell } from "./PortalShell";
import { SiteLinks } from "./SiteLinks";
import { formatPostDate } from "../data/postPreviews";

export function BlogShell({ children, post }: { children: ReactNode; post: PoastPreviewProps }) {
  const { title, previewText, dateTime, readingMinutes, link } = post;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <PortalShell>
      <main className="portal-box article-box">
        <div className="article-topbar">
          <Link to="/" className="back-link" preload="intent">
            <span aria-hidden="true">«</span> Back to the island
          </Link>
          <img src="/island/writing.svg" alt="" width={44} height={52} />
        </div>

        <header className="article-header">
          <span className="article-meta">
            <time dateTime={dateTime}>{formatPostDate(dateTime)}</time> · {readingMinutes} min read
          </span>
          <h1>{title}</h1>
          <p className="article-summary">{previewText}</p>
        </header>

        <article className="article-body">{children}</article>

        <footer className="article-footer">
          <SiteLinks />
          <ExternalAnchor href={githubEditUrl} className="suggest-changes-link">
            Suggest an edit <span aria-hidden="true">↗</span>
          </ExternalAnchor>
        </footer>
      </main>
    </PortalShell>
  );
}
