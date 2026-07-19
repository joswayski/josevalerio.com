import type { Route } from "./+types/home";
import { Link } from "react-router";
import { CopyEmail } from "../components/CopyEmail";
import { PoastPreview } from "../components/PoastPreview";
import { postPreviews } from "../data/postPreviews";
import { getSocialMeta } from "../data/siteMeta";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Jose Valerio" },
    { name: "description", content: "Jose Valerio's personal website" },
    { property: "og:title", content: "Jose Valerio" },
    {
      property: "og:description",
      content: "Jose Valerio's personal website",
    },
    { name: "twitter:title", content: "Jose Valerio" },
    {
      name: "twitter:description",
      content: "Jose Valerio's personal website",
    },
    ...getSocialMeta(),
  ];
}

export default function Home() {
  return (
    <main className="site-frame">
      <header className="site-header">
        <Link
          to="/"
          className="brand-link"
          aria-label="Jose Valerio home"
          prefetch="intent"
          viewTransition
        >
          <span className="brand-mark" aria-hidden="true">
            JV
          </span>
          <span className="brand-domain">josevalerio.com</span>
        </Link>

        <nav className="site-nav" aria-label="Social links">
          <a
            href="https://x.com/josevalerio"
            target="_blank"
            rel="noopener noreferrer"
          >
            X<span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/joswayski"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub<span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-label" aria-hidden="true">
          <span>Personal index</span>
          <span className="hero-label-line" />
          <span>{String(postPreviews.length).padStart(2, "0")} notes</span>
        </div>

        <h1 id="home-title" className="hero-name">
          <span>Jose</span>
          <em>Valerio</em>
        </h1>

        <div className="hero-footer">
          <CopyEmail />
          <a className="hero-scroll" href="#writing">
            <span>Writing</span>
            <span className="hero-scroll-arrow" aria-hidden="true">
              ↓
            </span>
          </a>
        </div>
      </section>

      {/* Future project entries can reuse this indexed section and row system. */}
      <section className="index-section" id="writing" aria-labelledby="writing-title">
        <div className="section-heading">
          <span className="section-number">01</span>
          <h2 id="writing-title">Writing</h2>
          <span className="section-count">
            {String(postPreviews.length).padStart(2, "0")} entries
          </span>
        </div>

        <div className="post-list">
          {postPreviews.map((post) => (
            <PoastPreview key={post.id} {...post} />
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>Jose Valerio</span>
        <div className="footer-links">
          <CopyEmail compact />
          <a
            href="https://github.com/joswayski"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub<span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://x.com/josevalerio"
            target="_blank"
            rel="noopener noreferrer"
          >
            X<span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
