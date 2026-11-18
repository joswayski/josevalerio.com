import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalAnchor } from "../components/ExternalLink";
import { GameShell } from "../components/GameShell";
import { SiteLinks } from "../components/SiteLinks";
import { TownGame } from "../components/TownGame";
import { formatPostDate, postPreviews } from "../data/postPreviews";
import { getPageMeta, SITE_DESCRIPTION, SITE_TITLE } from "../data/siteMeta";
import { townBuildings } from "../data/town";
import { play } from "../lib/sound";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: getPageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  }),
  component: Home,
});

function Home() {
  const projectBuildings = townBuildings.flatMap((building) =>
    building.type === "project" ? [building] : [],
  );

  return (
    <GameShell isHome>
      <TownGame />

      <div className="codex">
        <section className="scroll-panel" id="projects" aria-labelledby="projects-title">
          <h2 id="projects-title">Projects</h2>
          <ul className="codex-projects">
            {projectBuildings.map(({ id, art, kind, project }) => (
              <li key={id}>
                <ExternalAnchor href={project.href} className="codex-project">
                  <img src={art} alt="" width={96} height={72} loading="lazy" />
                  <span>
                    <b>{project.title}</b>
                    <small>
                      {kind} · {project.destination}
                    </small>
                    {project.description}
                  </span>
                </ExternalAnchor>
              </li>
            ))}
          </ul>
        </section>

        <section className="scroll-panel" id="writing" aria-labelledby="writing-title">
          <h2 id="writing-title">Writing</h2>
          <ul className="codex-posts">
            {postPreviews.map((post) => (
              <li key={post.link}>
                <Link to={post.link} preload="intent" onPointerEnter={() => play("hover")}>
                  <b>{post.title}</b>
                  <small>{post.previewText}</small>
                  <time dateTime={post.dateTime}>
                    {formatPostDate(post.dateTime)} · {post.readingMinutes} min read
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="scroll-panel" id="contact" aria-labelledby="contact-title">
          <h2 id="contact-title">Contact</h2>
          <p>Pigeons are slow. These are faster.</p>
          <SiteLinks />
        </section>
      </div>
    </GameShell>
  );
}
