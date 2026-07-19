import { Link, Outlet, useLocation } from "react-router";
import { CopyEmail } from "../components/CopyEmail";
import {
  JustDoTheThing,
  NoFunAllowed,
  RustJsonLogging,
} from "../data/postPreviews";

const routeToPostMap = {
  "/just-do-the-thing": JustDoTheThing,
  "/rust-json-logging": RustJsonLogging,
  "/no-fun-allowed": NoFunAllowed,
} as const;

export default function BlogLayout() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/$/, "") || "/";
  const currentPost =
    routeToPostMap[pathname as keyof typeof routeToPostMap];

  if (!currentPost) {
    return <Outlet />;
  }

  const { id, title, date, dateTime, link } = currentPost;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <div className="page-shell">
      <div className="site-panel article-site">
        <header className="site-header article-nav">
          <Link
            to="/"
            className="brand-link"
            aria-label="Jose Valerio home"
            prefetch="intent"
            viewTransition
          >
            <span className="brand-mark" aria-hidden="true">
              ~/
            </span>
            <span className="brand-domain">josevalerio.com</span>
          </Link>
          <Link to="/" className="back-link" prefetch="intent" viewTransition>
            <span aria-hidden="true">←</span> All writing
          </Link>
        </header>

        <main className="article-page">
          <header className="article-header">
            <div className="article-kicker">
              <span>Writing / {id.padStart(2, "0")}</span>
              <time dateTime={dateTime}>{date}</time>
            </div>
            <h1>{title}</h1>
            <a
              href={githubEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="edit-link"
            >
              Edit on GitHub<span aria-hidden="true">↗</span>
            </a>
          </header>

          <Outlet />

          <footer className="article-footer">
            <div>
              <span className="section-number">Questions or feedback?</span>
              <CopyEmail />
            </div>
            <Link to="/" prefetch="intent" viewTransition>
              More writing<span aria-hidden="true">→</span>
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
