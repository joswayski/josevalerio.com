import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectPreview } from "../../app/components/ProjectPreview";

const project = {
  title: "sjl",
  description: "A simple JSON logger for Rust.",
  href: "https://crates.io/crates/sjl",
  destination: "crates.io",
};

describe("ProjectPreview", () => {
  it("renders the project copy and destination", () => {
    render(<ProjectPreview {...project} />);

    expect(
      screen.getByRole("heading", { level: 3, name: project.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(project.description)).toBeInTheDocument();
    expect(screen.getByText(project.destination)).toBeInTheDocument();
  });

  it("links out safely to the project url", () => {
    render(<ProjectPreview {...project} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", project.href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides the decorative arrow from assistive technology", () => {
    const { container } = render(<ProjectPreview {...project} />);

    const arrow = container.querySelector(".project-arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
  });
});
