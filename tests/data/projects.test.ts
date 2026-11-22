import { describe, expect, it } from "vitest";
import { projects } from "../../app/data/projects";

describe("projects", () => {
  it("uses unique titles", () => {
    expect(new Set(projects.map((project) => project.title)).size).toBe(projects.length);
  });

  it("points every project at an https url whose host contains the destination", () => {
    for (const project of projects) {
      const url = new URL(project.href);
      expect(url.protocol).toBe("https:");
      expect(url.host).toContain(project.destination);
    }
  });

  it("describes every project", () => {
    for (const project of projects) {
      expect(project.description.trim()).not.toBe("");
      expect(project.title.trim()).not.toBe("");
    }
  });

  it("uses the intended Caper and Captures descriptions", () => {
    expect(projects.find((project) => project.title === "Caper")?.description).toBe(
      "Text and voice chat spaces for your people.",
    );
    expect(projects.find((project) => project.title === "Captures")?.description).toBe(
      "Fast, lightweight screenshots, screen recordings, and GIFs with built-in editing.",
    );
  });

  it("links Anybase to its website", () => {
    expect(projects.find((project) => project.title === "Anybase")).toEqual({
      title: "Anybase",
      description: "A fast database client for PostgreSQL, MySQL, and Redis.",
      href: "https://anyba.se",
      destination: "anyba.se",
    });
  });
});
