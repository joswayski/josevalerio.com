import { createFileRoute } from "@tanstack/react-router";
import { CopyEmail } from "../components/CopyEmail";
import { ExternalAnchor, ExternalLink } from "../components/ExternalLink";
import { GitHubIcon, XIcon } from "../components/icons";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import {
  getPageMeta,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "../data/siteMeta";

const GITHUB_URL = "https://github.com/joswayski";
const X_URL = "https://x.com/josevalerio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: getPageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  }),
  component: Home,
});

function Home() {
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
            <ExternalAnchor
              href={X_URL}
              className="inline-chip inline-chip--icon"
              aria-label="Jose Valerio on X"
            >
              <XIcon className="social-icon" />
            </ExternalAnchor>
            ,{" "}
            <ExternalAnchor
              href={GITHUB_URL}
              className="inline-chip"
              aria-label="Jose Valerio on GitHub"
            >
              <GitHubIcon className="social-icon" />
              GitHub
            </ExternalAnchor>
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

          <div className="preview-list">
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

          <div className="preview-list">
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
