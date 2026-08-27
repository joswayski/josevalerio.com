import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFoundPage } from "../../app/components/NotFoundPage";
import { renderWithRouter } from "../renderWithRouter";

describe("NotFoundPage", () => {
  it("explains the error and links home", async () => {
    await renderWithRouter(<NotFoundPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("404");
    expect(
      screen.getByText("The requested page could not be found."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return home/ })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
