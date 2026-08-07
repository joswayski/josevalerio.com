import type { Route } from "./+types/home";
import { CopyEmail } from "../components/CopyEmail";
import { ExternalLink } from "../components/ExternalLink";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import { getSocialMeta } from "../data/siteMeta";

const GITHUB_URL = "https://github.com/joswayski";
const X_URL = "https://x.com/josevalerio";

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
    <main className="page-shell">
      <div className="site-panel">
        <section className="home-hero" aria-labelledby="home-title">
          <h1 id="home-title" className="hero-name">
            Jose Valerio
          </h1>
          <p className="hero-blurb">
            I&apos;m a senior software engineer at{" "}
            <ExternalLink href="https://stockx.com">StockX</ExternalLink>.
            Sometimes I make things.
          </p>
          <p className="hero-find-me">
            You can find me on{" "}
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-chip"
              aria-label="Jose Valerio on X"
            >
              <XIcon className="social-icon" />
              X
            </a>
            ,{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-chip"
              aria-label="Jose Valerio on GitHub"
            >
              <GitHubIcon className="social-icon" />
              GitHub
            </a>
            , or by email{" "}
            <CopyEmail compact />.
          </p>
        </section>

        <section
          className="index-section"
          id="projects"
          aria-labelledby="projects-title"
        >
          <div className="section-heading">
            <h2 id="projects-title">Projects</h2>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <ProjectPreview key={project.title} {...project} />
            ))}
          </div>
        </section>

        <section
          className="index-section"
          id="writing"
          aria-labelledby="writing-title"
        >
          <div className="section-heading">
            <h2 id="writing-title">Writing</h2>
          </div>

          <div className="post-list">
            {postPreviews.map((post) => (
              <PoastPreview key={post.link} {...post} />
            ))}
          </div>
        </section>

        {/*
        <section
          className="index-section"
          id="reviews"
          aria-labelledby="reviews-title"
        >
          <div className="section-heading">
            <h2 id="reviews-title">Reviews</h2>
          </div>

          <div className="review-categories">
            <section>
              <h3>Restaurants</h3>
            </section>
            <section>
              <h3>Wine</h3>
            </section>
          </div>
        </section>
        */}
      </div>
    </main>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.467-1.11-1.467-.908-.621.069-.609.069-.609 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.748 0 .268.18.58.688.481A10.02 10.02 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z" />
    </svg>
  );
}

