import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { SiteLinks } from "../components/SiteLinks";
import { VguiWindow } from "../components/VguiWindow";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import { getPageMeta, SITE_DESCRIPTION, SITE_TITLE } from "../data/siteMeta";

type BrowserTab = "all" | "projects" | "writing";
type ProjectSortKey = "default" | "title" | "destination";
type PostSortKey = "date" | "title" | "read";
type SortDir = "asc" | "desc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: getPageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  }),
  component: Home,
});

function Home() {
  const [activeTab, setActiveTab] = useState<BrowserTab>("all");
  const [filterText, setFilterText] = useState("");
  const [projectSort, setProjectSort] = useState<{ key: ProjectSortKey; dir: SortDir }>({
    key: "default",
    dir: "asc",
  });
  const [postSort, setPostSort] = useState<{ key: PostSortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const query = filterText.trim().toLowerCase();

  const visibleProjects = useMemo(() => {
    const filtered = query
      ? projects.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            p.destination.toLowerCase().includes(query),
        )
      : projects;

    const sortKey = projectSort.key;
    if (sortKey === "default") return filtered;
    const dir = projectSort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => a[sortKey].localeCompare(b[sortKey]) * dir);
  }, [query, projectSort]);

  const visiblePosts = useMemo(() => {
    const filtered = query
      ? postPreviews.filter(
          (post) =>
            post.title.toLowerCase().includes(query) ||
            post.previewText.toLowerCase().includes(query) ||
            post.dateTime.includes(query),
        )
      : postPreviews;

    const dir = postSort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (postSort.key === "title") return a.title.localeCompare(b.title) * dir;
      if (postSort.key === "read") return (a.readingMinutes - b.readingMinutes) * dir;
      return a.dateTime.localeCompare(b.dateTime) * dir;
    });
  }, [query, postSort]);

  function toggleProjectSort(key: Exclude<ProjectSortKey, "default">) {
    setProjectSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function togglePostSort(key: PostSortKey) {
    setPostSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" ? "desc" : "asc" },
    );
  }

  function handleRefresh() {
    setIsRefreshing(true);
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setIsRefreshing(false), 320);
  }

  const showProjects = activeTab === "all" || activeTab === "projects";
  const showWriting = activeTab === "all" || activeTab === "writing";
  const shownCount =
    (showProjects ? visibleProjects.length : 0) + (showWriting ? visiblePosts.length : 0);

  const statusText = isRefreshing
    ? "Refreshing server list..."
    : query
      ? `${shownCount} matching ${shownCount === 1 ? "server" : "servers"}`
      : activeTab === "projects"
        ? `${visibleProjects.length} project servers responding`
        : activeTab === "writing"
          ? `${visiblePosts.length} dispatches ready`
          : `${shownCount} servers (${projects.length} projects, ${postPreviews.length} posts)`;

  return (
    <main className="page-shell">
      <div className="site-panel">
        <VguiWindow
          title="Servers — josevalerio.com"
          statusBar={
            <>
              <span className="vgui-status-cell vgui-status-cell--grow" role="status">
                {statusText}
              </span>
              <span className="vgui-status-cell vgui-status-cell--hide-sm">Map: de_stockx</span>
              <span className="vgui-status-cell vgui-status-ping">
                <span className="vgui-status-led" aria-hidden="true" />
                12 ms
              </span>
            </>
          }
        >
          <header className="browser-profile">
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

          <div className="vgui-tabs-shell">
            <div className="vgui-tabbar" role="tablist" aria-label="Server categories">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={`vgui-tab ${activeTab === "all" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All ({projects.length + postPreviews.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "projects"}
                className={`vgui-tab ${activeTab === "projects" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("projects")}
              >
                Projects ({projects.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "writing"}
                className={`vgui-tab ${activeTab === "writing" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("writing")}
              >
                Writing ({postPreviews.length})
              </button>
            </div>

            <div className={`vgui-tab-body ${isRefreshing ? "is-refreshing" : ""}`}>
              {showProjects && (
                <section className="index-section" id="projects" aria-labelledby="projects-title">
                  <div className="section-bar">
                    <h2 id="projects-title">Projects</h2>
                    <span className="section-count">
                      {visibleProjects.length} {visibleProjects.length === 1 ? "server" : "servers"}
                    </span>
                  </div>

                  <div className="server-list-well">
                    <div className="server-col-headers server-col-headers--projects">
                      <span className="server-col-head server-col-head--icon" aria-hidden="true">
                        ●
                      </span>
                      <button
                        type="button"
                        className="server-col-head server-col-btn"
                        onClick={() => toggleProjectSort("title")}
                      >
                        Servers
                        {projectSort.key === "title" && (
                          <span className="sort-arrow" aria-hidden="true">
                            {projectSort.dir === "asc" ? "▴" : "▾"}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="server-col-head server-col-btn server-col-head--host"
                        onClick={() => toggleProjectSort("destination")}
                      >
                        Host
                        {projectSort.key === "destination" && (
                          <span className="sort-arrow" aria-hidden="true">
                            {projectSort.dir === "asc" ? "▴" : "▾"}
                          </span>
                        )}
                      </button>
                      <span className="server-col-head server-col-head--ping" aria-hidden="true">
                        Ping
                      </span>
                    </div>

                    <div className="project-grid">
                      {visibleProjects.length > 0 ? (
                        visibleProjects.map((project) => (
                          <ProjectPreview key={project.title} {...project} />
                        ))
                      ) : (
                        <p className="server-empty">No project servers match “{filterText}”.</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {showWriting && (
                <section className="index-section" id="writing" aria-labelledby="writing-title">
                  <div className="section-bar">
                    <h2 id="writing-title">Writing</h2>
                    <span className="section-count">
                      {visiblePosts.length} {visiblePosts.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>

                  <div className="server-list-well">
                    <div className="server-col-headers server-col-headers--posts">
                      <span className="server-col-head server-col-head--icon" aria-hidden="true">
                        ●
                      </span>
                      <button
                        type="button"
                        className="server-col-head server-col-btn"
                        onClick={() => togglePostSort("title")}
                      >
                        Dispatch
                        {postSort.key === "title" && (
                          <span className="sort-arrow" aria-hidden="true">
                            {postSort.dir === "asc" ? "▴" : "▾"}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="server-col-head server-col-btn server-col-head--read"
                        onClick={() => togglePostSort("read")}
                      >
                        Read
                        {postSort.key === "read" && (
                          <span className="sort-arrow" aria-hidden="true">
                            {postSort.dir === "asc" ? "▴" : "▾"}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="server-col-head server-col-btn server-col-head--date"
                        onClick={() => togglePostSort("date")}
                      >
                        Date
                        {postSort.key === "date" && (
                          <span className="sort-arrow" aria-hidden="true">
                            {postSort.dir === "asc" ? "▴" : "▾"}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="post-list">
                      {visiblePosts.length > 0 ? (
                        visiblePosts.map((post) => <PoastPreview key={post.link} {...post} />)
                      ) : (
                        <p className="server-empty">No writing entries match “{filterText}”.</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className="browser-toolbar">
                <label className="vgui-filter-field">
                  <span className="vgui-filter-label">Filter</span>
                  <input
                    type="search"
                    value={filterText}
                    onChange={(event) => setFilterText(event.target.value)}
                    placeholder="Find server or post..."
                    className="vgui-input"
                    aria-label="Filter servers"
                  />
                </label>

                <div className="browser-toolbar-actions">
                  {filterText && (
                    <button type="button" className="chip" onClick={() => setFilterText("")}>
                      Clear
                    </button>
                  )}
                  <button type="button" className="chip" onClick={handleRefresh}>
                    Refresh all
                  </button>
                </div>
              </div>
            </div>
          </div>
        </VguiWindow>
      </div>
    </main>
  );
}
