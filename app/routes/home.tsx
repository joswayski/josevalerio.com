import type { Route } from "./+types/home";
import { CopyEmail } from "../components/CopyEmail";
import { ExternalLink } from "../components/ExternalLink";
import { PlacesGlobe } from "../components/PlacesGlobe";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
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

        <section
          className="index-section"
          id="places"
          aria-labelledby="places-title"
        >
          <div className="section-heading section-heading--places">
            <h2 id="places-title">Places I&apos;ve Been</h2>
          </div>

          <PlacesGlobe />
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

        <footer className="site-footer">
          <CopyEmail compact />
          <div className="footer-links">
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
      </div>
    </main>
  );
}
