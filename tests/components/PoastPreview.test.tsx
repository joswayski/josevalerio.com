import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoastPreview } from "../../app/components/PoastPreview";
import { RustJsonLogging } from "../../app/data/postPreviews";
import { renderWithRouter } from "../renderWithRouter";

describe("PoastPreview", () => {
  it("renders the post title, preview text and machine readable date", async () => {
    await renderWithRouter(<PoastPreview {...RustJsonLogging} />);

    expect(
      screen.getByRole("heading", { level: 3, name: RustJsonLogging.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(RustJsonLogging.previewText)).toBeInTheDocument();

    const time = screen.getByText(RustJsonLogging.date);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", RustJsonLogging.dateTime);
  });

  it("links to the post route", async () => {
    await renderWithRouter(<PoastPreview {...RustJsonLogging} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      RustJsonLogging.link,
    );
  });
});
