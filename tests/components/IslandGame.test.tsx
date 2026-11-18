import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IslandGame } from "../../app/components/IslandGame";
import { projects } from "../../app/data/projects";

describe("IslandGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks to a project's building and opens a popup that links to it", () => {
    render(<IslandGame />);

    act(() => vi.advanceTimersByTime(5_000));
    fireEvent.click(screen.getByRole("button", { name: "PLAY!" }));

    const anybase = projects.find((project) => project.title === "Anybase")!;
    fireEvent.click(screen.getByRole("button", { name: `Anybase: ${anybase.description}` }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    const dialog = screen.getByRole("dialog", { name: "Anybase" });
    expect(dialog).toHaveTextContent(anybase.description);
    expect(screen.getByRole("link", { name: "GO!" })).toHaveAttribute("href", anybase.href);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
