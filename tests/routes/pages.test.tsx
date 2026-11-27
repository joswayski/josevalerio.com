import type { ComponentType } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route as IndexRoute } from "../../app/routes/index";
import { Route as JustDoTheThingRoute } from "../../app/routes/just-do-the-thing";
import { Route as NoFunAllowedRoute } from "../../app/routes/no-fun-allowed";
import { Route as RustJsonLoggingRoute } from "../../app/routes/rust-json-logging";
import {
  formatPostDate,
  JustDoTheThing,
  NoFunAllowed,
  RustJsonLogging,
  postPreviews,
} from "../../app/data/postPreviews";
import { projects } from "../../app/data/projects";
import { renderWithRouter } from "../renderWithRouter";

function renderRoute(route: { options: { component?: ComponentType } }) {
  const Component = route.options.component;
  if (!Component) throw new Error("route has no component");
  return renderWithRouter(<Component />);
}

describe("home page", () => {
  it("links every project and every post", async () => {
    await renderRoute(IndexRoute);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));

    for (const project of projects) {
      expect(hrefs).toContain(project.href);
    }
    for (const post of postPreviews) {
      expect(hrefs).toContain(post.link);
    }
  });

  it("shows the header with social links and the email chip", async () => {
    await renderRoute(IndexRoute);

    expect(screen.getByRole("heading", { level: 1, name: "Jose Valerio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jose Valerio on X" })).toHaveAttribute(
      "href",
      "https://x.com/josevalerio",
    );
    expect(screen.getByRole("link", { name: "Jose Valerio on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/joswayski",
    );
    expect(screen.getByRole("button", { name: /contact@josevalerio\.com/ })).toBeInTheDocument();
  });

  it("renders the projects section before the writing section", async () => {
    await renderRoute(IndexRoute);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Projects", "Writing"]);
  });

  it("switches server browser tabs and filters entries", async () => {
    await renderRoute(IndexRoute);

    expect(screen.queryByText(/5 projects, 3 posts/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resize window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Latency" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Jose Valerio on X" }).querySelector("svg.x-logo"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Writing/ }));
    expect(screen.queryByRole("heading", { level: 2, name: "Projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Writing" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    const filter = screen.getByRole("searchbox", { name: "Filter servers" });
    fireEvent.change(filter, { target: { value: "Rust" } });

    expect(screen.getByRole("heading", { level: 3, name: "sjl" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "How to log structured JSON in Rust" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Caper" })).not.toBeInTheDocument();
  });
});

describe("post pages", () => {
  it.each([
    [JustDoTheThingRoute, JustDoTheThing],
    [RustJsonLoggingRoute, RustJsonLogging],
    [NoFunAllowedRoute, NoFunAllowed],
  ])("renders the post shell and body copy", async (route, post) => {
    await renderRoute(route);

    expect(screen.getByRole("heading", { level: 1, name: post.title })).toBeInTheDocument();
    expect(screen.getByText(formatPostDate(post.dateTime))).toHaveAttribute(
      "dateTime",
      post.dateTime,
    );
    expect(screen.getByRole("link", { name: /Suggest an edit/ })).toHaveAttribute(
      "href",
      `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${post.link}.tsx`,
    );
    expect(document.querySelectorAll(".article-body p").length).toBeGreaterThan(0);
  });
});
