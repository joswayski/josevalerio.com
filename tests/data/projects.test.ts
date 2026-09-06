import { describe, expect, it } from "vitest";
import { projects } from "../../app/data/projects";

describe("projects", () => {
  it("uses unique titles", () => {
    expect(new Set(projects.map((project) => project.title)).size).toBe(
      projects.length,
    );
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
      "A (wip!) place for your people to chat about anything.",
    );
    expect(
      projects.find((project) => project.title === "Captures")?.description,
    ).toBe("A cross-platform screen capture utility.");
  });
});
