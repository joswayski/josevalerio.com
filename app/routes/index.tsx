import { createFileRoute } from "@tanstack/react-router";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { SiteLinks } from "../components/SiteLinks";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import {
  getPageMeta,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "../data/siteMeta";

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
        <header>
          <div className="site-header">
            <h1 className="site-name">Jose Valerio</h1>
            <SiteLinks />
          </div>
          <p className="home-bio">
            I fix shipping labels at{" "}
            <a href="https://stockx.com" target="_blank" rel="noopener noreferrer">
              StockX
            </a>
            . Sometimes I make things.
          </p>
        </header>

        <section
          className="index-section"
          id="projects"
          aria-labelledby="projects-title"
        >
          <h2 id="projects-title">Projects</h2>
          <div className="project-grid">
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
          <h2 id="writing-title">Writing</h2>
          <div className="post-list">
            {postPreviews.map((post) => (
              <PoastPreview key={post.link} {...post} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
