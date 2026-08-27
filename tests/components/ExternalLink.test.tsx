import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExternalLink } from "../../app/components/ExternalLink";
import { CodeSnippet } from "../../app/components/CodeSnippet";

describe("ExternalLink", () => {
  it("opens in a new tab without leaking the referrer", () => {
    render(<ExternalLink href="https://stockx.com">StockX</ExternalLink>);

    const link = screen.getByRole("link", { name: "StockX" });
    expect(link).toHaveAttribute("href", "https://stockx.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("appends the caller's class to the base class", () => {
    render(
      <ExternalLink href="https://example.com" className="extra">
        Example
      </ExternalLink>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("class", "text-link extra");
  });

  it("defaults to only the base class", () => {
    render(<ExternalLink href="https://example.com">Example</ExternalLink>);

    expect(screen.getByRole("link")).toHaveAttribute("class", "text-link ");
  });
});

describe("CodeSnippet", () => {
  it("renders inline code with the base class", () => {
    render(<CodeSnippet>cargo add sjl</CodeSnippet>);

    const code = screen.getByText("cargo add sjl");
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveAttribute("class", "inline-code ");
  });

  it("appends the caller's class", () => {
    render(<CodeSnippet className="extra">sjl</CodeSnippet>);

    expect(screen.getByText("sjl")).toHaveAttribute(
      "class",
      "inline-code extra",
    );
  });
});
