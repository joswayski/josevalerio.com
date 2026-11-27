import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PoastPreview } from "../components/PoastPreview";
import { ProjectPreview } from "../components/ProjectPreview";
import { SiteLinks } from "../components/SiteLinks";
import { VguiWindow } from "../components/VguiWindow";
import { postPreviews } from "../data/postPreviews";
import { projects } from "../data/projects";
import { getPageMeta, SITE_DESCRIPTION, SITE_TITLE } from "../data/siteMeta";
import { pingSite } from "../lib/ping";

type BrowserTab = "all" | "projects" | "writing";
type ProjectSortKey = "default" | "title" | "destination" | "latency";
type PostSortKey = "date" | "title" | "read";
type SortDir = "asc" | "desc";
type LatencyFilter = "all" | "50" | "100" | "250" | "500";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: getPageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  }),
  component: Home,
});

function Home() {
  const [activeTab, setActiveTab] = useState<BrowserTab>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [maxLatency, setMaxLatency] = useState<LatencyFilter>("all");
  const [hideUnreachable, setHideUnreachable] = useState(false);
  const [projectSort, setProjectSort] = useState<{ key: ProjectSortKey; dir: SortDir }>({
    key: "default",
    dir: "asc",
  });
  const [postSort, setPostSort] = useState<{ key: PostSortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });
  const [latencies, setLatencies] = useState<Record<string, number | null>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runPings = useCallback((showRefreshStatus: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (showRefreshStatus) {
      setIsRefreshing(true);
      setLatencies({});
    }

    let remaining = projects.length;
    for (const project of projects) {
      void pingSite(project.href, controller.signal).then((ms) => {
        if (controller.signal.aborted) return;
        setLatencies((prev) => ({ ...prev, [project.href]: ms }));
        remaining -= 1;
        if (remaining === 0) {
          setIsRefreshing(false);
        }
      });
    }
  }, []);

  const stopRefresh = useCallback(() => {
    abortRef.current?.abort();
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    runPings(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [runPings]);

  const query = filterText.trim().toLowerCase();
  const maxLatencyNum = maxLatency === "all" ? null : Number(maxLatency);
  const hasActiveFilters = Boolean(query || maxLatencyNum !== null || hideUnreachable);

  const visibleProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      if (
        query &&
        !p.title.toLowerCase().includes(query) &&
        !p.description.toLowerCase().includes(query) &&
        !p.destination.toLowerCase().includes(query)
      ) {
        return false;
      }

      const ms = latencies[p.href];
      if (hideUnreachable && typeof ms !== "number") {
        return false;
      }
      if (maxLatencyNum !== null && (typeof ms !== "number" || ms >= maxLatencyNum)) {
        return false;
      }
      return true;
    });

    const sortKey = projectSort.key;
    if (sortKey === "default") return filtered;
    const dir = projectSort.dir === "asc" ? 1 : -1;

    if (sortKey === "latency") {
      return [...filtered].sort((a, b) => {
        const aMs = latencies[a.href];
        const bMs = latencies[b.href];
        const aVal = typeof aMs === "number" ? aMs : Number.POSITIVE_INFINITY;
        const bVal = typeof bMs === "number" ? bMs : Number.POSITIVE_INFINITY;
        if (aVal === bVal) return a.title.localeCompare(b.title);
        if (aVal === Number.POSITIVE_INFINITY) return 1;
        if (bVal === Number.POSITIVE_INFINITY) return -1;
        return (aVal - bVal) * dir;
      });
    }

    return [...filtered].sort((a, b) => a[sortKey].localeCompare(b[sortKey]) * dir);
  }, [query, projectSort, latencies, maxLatencyNum, hideUnreachable]);

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

  function resetFilters() {
    setFilterText("");
    setMaxLatency("all");
    setHideUnreachable(false);
  }

  const filterSummaryParts: string[] = [];
  if (filterText.trim()) filterSummaryParts.push(filterText.trim());
  if (maxLatencyNum !== null) filterSummaryParts.push(`< ${maxLatencyNum} ms`);
  if (hideUnreachable) filterSummaryParts.push("responding");
  const filterSummary = filterSummaryParts.join(", ");

  const showProjects = activeTab === "all" || activeTab === "projects";
  const showWriting = activeTab === "all" || activeTab === "writing";
  const shownCount =
    (showProjects ? visibleProjects.length : 0) + (showWriting ? visiblePosts.length : 0);

  const statusText = isRefreshing
    ? "Refreshing server list..."
    : hasActiveFilters
      ? `${shownCount} matching`
      : "";

  return (
    <main className="page-shell">
      <div className="site-panel">
        <VguiWindow
          header={
            <header className="site-header">
              <h1 className="site-name">Jose Valerio</h1>
              <SiteLinks />
            </header>
          }
          statusText={statusText ? <span role="status">{statusText}</span> : null}
        >
          <p className="home-bio">
            I fix shipping labels at{" "}
            <a href="https://stockx.com" target="_blank" rel="noopener noreferrer">
              StockX
            </a>
            . Sometimes I make things.
          </p>

          <div className="vgui-tabs-shell">
            <div className="vgui-tabbar" role="tablist" aria-label="Sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={`vgui-tab ${activeTab === "all" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "projects"}
                className={`vgui-tab ${activeTab === "projects" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("projects")}
              >
                Projects
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "writing"}
                className={`vgui-tab ${activeTab === "writing" ? "vgui-tab--active" : ""}`}
                onClick={() => setActiveTab("writing")}
              >
                Writing
              </button>
            </div>

            <div className={`vgui-tab-body ${isRefreshing ? "is-refreshing" : ""}`}>
              <div className="vgui-browser-box">
                <div className="vgui-browser-content">
                  {showProjects && (
                    <section
                      className="index-section"
                      id="projects"
                      aria-labelledby="projects-title"
                    >
                      <div className="server-col-headers server-col-headers--projects">
                        <span className="server-col-head server-col-head--icon" aria-hidden="true">
                          <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                            <path
                              d="M5.5 1L9.5 2.4V5.6C9.5 7.7 7.8 9.3 5.5 10C3.2 9.3 1.5 7.7 1.5 5.6V2.4L5.5 1Z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                        <button
                          type="button"
                          className="server-col-head server-col-btn"
                          onClick={() => toggleProjectSort("title")}
                        >
                          <h2 id="projects-title">Projects</h2>
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
                          Site
                          {projectSort.key === "destination" && (
                            <span className="sort-arrow" aria-hidden="true">
                              {projectSort.dir === "asc" ? "▴" : "▾"}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="server-col-head server-col-btn server-col-head--latency"
                          onClick={() => toggleProjectSort("latency")}
                        >
                          Latency
                          {projectSort.key === "latency" && (
                            <span className="sort-arrow" aria-hidden="true">
                              {projectSort.dir === "asc" ? "▴" : "▾"}
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="project-grid">
                        {visibleProjects.length > 0 ? (
                          visibleProjects.map((project) => (
                            <ProjectPreview
                              key={project.title}
                              {...project}
                              latencyMs={latencies[project.href]}
                              isPinging={isRefreshing && !(project.href in latencies)}
                            />
                          ))
                        ) : (
                          <p className="server-empty">No projects match the current filters.</p>
                        )}
                      </div>
                    </section>
                  )}

                  {showWriting && (
                    <section className="index-section" id="writing" aria-labelledby="writing-title">
                      <div className="server-col-headers server-col-headers--posts">
                        <span className="server-col-head server-col-head--icon" aria-hidden="true">
                          <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                            <path
                              d="M2 1.5H6.8L9 3.7V9.5H2V1.5Z"
                              stroke="currentColor"
                              strokeWidth="1.1"
                              fill="none"
                            />
                          </svg>
                        </span>
                        <button
                          type="button"
                          className="server-col-head server-col-btn"
                          onClick={() => togglePostSort("title")}
                        >
                          <h2 id="writing-title">Writing</h2>
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
                          <p className="server-empty">No posts match the current filters.</p>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                <div className="vgui-scrollbar" aria-hidden="true">
                  <span className="vgui-scroll-arrow">▲</span>
                  <div className="vgui-scroll-track">
                    <span className="vgui-scroll-thumb" />
                  </div>
                  <span className="vgui-scroll-arrow">▼</span>
                </div>
              </div>

              <div className="browser-toolbar">
                <div className="vgui-filter-group">
                  <button
                    type="button"
                    className={`chip vgui-action-btn ${filtersOpen ? "chip--pressed" : ""}`}
                    aria-expanded={filtersOpen}
                    aria-controls="browser-filters-panel"
                    onClick={() => setFiltersOpen((open) => !open)}
                  >
                    Change filters
                  </button>
                  {filterSummary && <span className="vgui-filter-summary">{filterSummary}</span>}
                </div>

                <div className="browser-toolbar-actions">
                  <button
                    type="button"
                    className="chip vgui-action-btn"
                    disabled={isRefreshing}
                    onClick={() => runPings(true)}
                  >
                    Quick refresh
                  </button>
                  <button
                    type="button"
                    className="chip vgui-action-btn"
                    disabled={!isRefreshing}
                    onClick={stopRefresh}
                  >
                    Stop refresh
                  </button>
                </div>
              </div>

              {filtersOpen && (
                <div id="browser-filters-panel" className="vgui-filters-panel">
                  <label className="vgui-filter-row">
                    <span>Search</span>
                    <input
                      type="search"
                      value={filterText}
                      onChange={(event) => setFilterText(event.target.value)}
                      placeholder="Name, description, or site..."
                      className="vgui-input"
                      aria-label="Filter servers"
                    />
                  </label>

                  <label className="vgui-filter-row">
                    <span>Latency</span>
                    <select
                      value={maxLatency}
                      onChange={(event) => setMaxLatency(event.target.value as LatencyFilter)}
                      className="vgui-select"
                    >
                      <option value="all">&lt; All &gt;</option>
                      <option value="50">&lt; 50</option>
                      <option value="100">&lt; 100</option>
                      <option value="250">&lt; 250</option>
                      <option value="500">&lt; 500</option>
                    </select>
                  </label>

                  <label className="vgui-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={hideUnreachable}
                      onChange={(event) => setHideUnreachable(event.target.checked)}
                    />
                    <span>Responding only</span>
                  </label>

                  {hasActiveFilters && (
                    <button type="button" className="chip vgui-filter-clear" onClick={resetFilters}>
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </VguiWindow>
      </div>
    </main>
  );
}
