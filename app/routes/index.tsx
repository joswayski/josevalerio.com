import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalAnchor } from "../components/ExternalLink";
import { IslandGame } from "../components/IslandGame";
import { PortalShell } from "../components/PortalShell";
import { SiteLinks } from "../components/SiteLinks";
import { islandSpots } from "../data/island";
import { formatPostDate, postPreviews } from "../data/postPreviews";
import { getPageMeta, SITE_DESCRIPTION, SITE_TITLE } from "../data/siteMeta";
import { play } from "../lib/sound";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: getPageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  }),
  component: Home,
});

function Home() {
  const projectSpots = islandSpots.flatMap((spot) => (spot.kind === "project" ? [spot] : []));

  return (
    <PortalShell>
      <div className="portal-columns">
        <main className="portal-main">
          <div className="portal-welcome">
            <h1>Hi, I'm Jose Valerio!</h1>
            <p>
              I fix shipping labels at{" "}
              <ExternalAnchor href="https://stockx.com">StockX</ExternalAnchor>. Sometimes I make
              things. Waddle around the island to see them!
            </p>
          </div>
          <IslandGame />
        </main>

        <aside className="portal-side portal-left">
          <section className="portal-box" id="projects" aria-labelledby="projects-title">
            <h2 id="projects-title">Projects</h2>
            <ul className="game-list">
              {projectSpots.map(({ id, art, project }) => (
                <li key={id} className="game-card">
                  <img src={art} alt="" width={64} height={56} />
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                    <ExternalAnchor
                      href={project.href}
                      className="play-button"
                      aria-label={`Play ${project.title} at ${project.destination}`}
                    >
                      PLAY ▶
                    </ExternalAnchor>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <aside className="portal-side portal-right">
          <section className="portal-box" id="writing" aria-labelledby="writing-title">
            <h2 id="writing-title">Writing</h2>
            <ul className="post-list">
              {postPreviews.map((post, index) => (
                <li key={post.link}>
                  <Link to={post.link} preload="intent" onPointerEnter={() => play("tick")}>
                    {index === 0 && <span className="new-badge">NEW!</span>}
                    <b>{post.title}</b>
                    <small>{post.previewText}</small>
                    <time dateTime={post.dateTime}>{formatPostDate(post.dateTime)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="portal-box" id="contact" aria-labelledby="contact-title">
            <h2 id="contact-title">Contact</h2>
            <SiteLinks />
          </section>

          <div className="web-badges" aria-hidden="true">
            <span className="web-badge web-badge-sound">
              BEST VIEWED
              <br />
              WITH SOUND ON
            </span>
            <span className="web-badge web-badge-rust">
              I ♥ RUST
              <br />
              &lt;/&gt;
            </span>
            <span className="web-badge web-badge-construction">
              <span>UNDER CONSTRUCTION</span>
            </span>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
