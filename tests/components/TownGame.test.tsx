import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TownGame } from "../../app/components/TownGame";
import { projects } from "../../app/data/projects";
import { renderWithRouter } from "../renderWithRouter";

const project = (title: string) => projects.find((p) => p.title === title)!;

describe("TownGame", () => {
  it("opens on the Town Center with the bio and contact links", async () => {
    await renderWithRouter(<TownGame />);

    expect(screen.getByRole("button", { name: "Jose Valerio: about me" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/I fix shipping labels at/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/joswayski",
    );
  });

  it("shows a selected project's link, and Next moves to the following building", async () => {
    await renderWithRouter(<TownGame />);
    const anybase = project("Anybase");

    fireEvent.click(screen.getByRole("button", { name: `Anybase: ${anybase.description}` }));
    expect(screen.getByRole("link", { name: /Visit anyba\.se/ })).toHaveAttribute(
      "href",
      anybase.href,
    );
    expect(screen.getByText("You selected Anybase (Storehouse).")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const horoscope = project("Credit Card Horoscope");
    expect(screen.getByRole("link", { name: /Visit creditcardhoroscope\.com/ })).toHaveAttribute(
      "href",
      horoscope.href,
    );
    expect(screen.queryByRole("link", { name: /Visit anyba\.se/ })).not.toBeInTheDocument();
  });
});
