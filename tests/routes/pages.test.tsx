import type { ComponentType } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route as IndexRoute } from "../../app/routes/index";
import { Route as JustDoTheThingRoute } from "../../app/routes/just-do-the-thing";
import { Route as NoFunAllowedRoute } from "../../app/routes/no-fun-allowed";
import { Route as RustJsonLoggingRoute } from "../../app/routes/rust-json-logging";
import {
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

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    for (const project of projects) {
      expect(hrefs).toContain(project.href);
    }
    for (const post of postPreviews) {
      expect(hrefs).toContain(post.link);
    }
  });

  it("shows the hero with social links and the email chip", async () => {
    await renderRoute(IndexRoute);

    expect(
      screen.getByRole("heading", { level: 1, name: "Jose Valerio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Jose Valerio on X" }),
    ).toHaveAttribute("href", "https://x.com/josevalerio");
    expect(
      screen.getByRole("link", { name: "Jose Valerio on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/joswayski");
    expect(
      screen.getByRole("button", { name: /contact@josevalerio\.com/ }),
    ).toBeInTheDocument();
  });

  it("renders the projects and writing sections", async () => {
    await renderRoute(IndexRoute);

    for (const name of ["Projects", "Writing"]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });
});

describe("post pages", () => {
  it.each([
    [JustDoTheThingRoute, JustDoTheThing],
    [RustJsonLoggingRoute, RustJsonLogging],
    [NoFunAllowedRoute, NoFunAllowed],
  ])("renders the post shell and body copy", async (route, post) => {
    await renderRoute(route);

    expect(
      screen.getByRole("heading", { level: 1, name: post.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(post.date)).toHaveAttribute(
      "dateTime",
      post.dateTime,
    );
    expect(
      screen.getByRole("link", { name: /Suggest changes on GitHub/ }),
    ).toHaveAttribute(
      "href",
      `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${post.link}.tsx`,
    );
    expect(document.querySelectorAll(".article-body p").length).toBeGreaterThan(
      0,
    );
  });
});
