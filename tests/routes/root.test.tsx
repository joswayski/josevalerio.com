import type { ComponentType } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route as RootRoute } from "../../app/routes/__root";
import { NotFoundPage } from "../../app/components/NotFoundPage";
import { getSocialMeta } from "../../app/data/siteMeta";
import { renderWithRouter } from "../renderWithRouter";
import { routeHead } from "../routeHead";

const { meta, links } = routeHead(RootRoute);

function rel(value: string) {
  return links.filter((link) => link.rel === value);
}

describe("root route head", () => {
  it("declares the document defaults", () => {
    expect(meta).toContainEqual({ charSet: "utf-8" });
    expect(meta).toContainEqual({
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    });
    expect(meta).toContainEqual({ name: "theme-color", content: "#121314" });
    expect(meta).toContainEqual({ title: "Jose Valerio" });
  });

  it("includes the shared social meta", () => {
    for (const shared of getSocialMeta()) {
      expect(meta).toContainEqual(shared);
    }
  });

  it("links the stylesheet, icons and the web manifest", () => {
    expect(rel("stylesheet")).toHaveLength(1);
    expect(rel("icon").map((link) => link.href)).toEqual([
      "/favicon.ico",
      "/favicon.svg",
    ]);
    expect(rel("apple-touch-icon")[0]?.sizes).toBe("180x180");
    expect(rel("manifest")[0]?.href).toBe("/site.webmanifest");
  });
});

describe("root route components", () => {
  it("renders the 404 page when no route matches", () => {
    expect(RootRoute.options.notFoundComponent).toBe(NotFoundPage);
  });

  it("shows the error message and stack in development", async () => {
    const ErrorComponent = RootRoute.options.errorComponent as
      | ComponentType<{ error: Error }>
      | undefined;
    if (!ErrorComponent) throw new Error("root route has no errorComponent");
    const error = new Error("boom");

    await renderWithRouter(<ErrorComponent error={error} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Oops!");
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return home/ })).toHaveAttribute(
      "href",
      "/",
    );
    expect(document.querySelector("pre code")?.textContent).toBe(error.stack);
  });
});
