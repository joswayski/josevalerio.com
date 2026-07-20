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

  const { title, date, dateTime, link } = currentPost;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <div className="page-shell">
      <div className="site-panel article-site">
        <header className="site-header article-nav">
          <Link to="/" className="back-link" prefetch="intent" viewTransition>
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

          <Outlet />

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
            <Link to="/" prefetch="intent" viewTransition>
              More writing<span aria-hidden="true">→</span>
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
