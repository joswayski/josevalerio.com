import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PoastPreviewProps } from "./PoastPreview";
import { CopyEmail } from "./CopyEmail";

export function BlogShell({
  children,
  post,
}: {
  children: ReactNode;
  post: PoastPreviewProps;
}) {
  const { title, date, dateTime, link } = post;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <div className="page-shell">
      <div className="site-panel article-site">
        <header className="site-header article-nav">
          <Link to="/" className="back-link" preload="intent">
            <span aria-hidden="true">←</span> All writing
          </Link>
        </header>

        <main className="article-page">
          <header className="article-header">
            <div className="article-kicker">
              <time dateTime={dateTime}>{date}</time>
            </div>
            <h1>{title}</h1>
          </header>

          <article className="article-body">{children}</article>

          <footer className="article-footer">
            <div>
              <span className="section-number">Questions or feedback?</span>
              <CopyEmail />
              <a
                href={githubEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="suggest-changes-link"
              >
                Suggest changes on GitHub<span aria-hidden="true">↗</span>
              </a>
            </div>
            <Link to="/" preload="intent">
              More writing<span aria-hidden="true">→</span>
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
