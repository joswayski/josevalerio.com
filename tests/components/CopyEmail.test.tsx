import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyEmail } from "../../app/components/CopyEmail";

const EMAIL = "contact@josevalerio.com";

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

const realLocation = window.location;

function stubWindowLocation() {
  const stub = { href: "" };
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: stub,
  });
  return stub;
}

function click(element: HTMLElement) {
  return act(async () => {
    element.click();
  });
}

describe("CopyEmail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: realLocation,
    });
  });

  it("copies the email through the clipboard api and resets the label after the timeout", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    setClipboard(writeText);
    render(<CopyEmail />);

    const button = screen.getByRole("button", { name: `Copy ${EMAIL}` });
    expect(button).toHaveTextContent("Copy");

    await click(button);
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    expect(button).toHaveTextContent("Copied");

    await act(async () => {
      vi.advanceTimersByTime(1_800);
    });
    expect(button).toHaveTextContent("Copy");
  });

  it("falls back to a hidden textarea and execCommand when the clipboard api rejects", async () => {
    setClipboard(() => Promise.reject(new Error("denied")));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    render(<CopyEmail />);

    await click(screen.getByRole("button"));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(screen.getByRole("button")).toHaveTextContent("Copied");
  });

  it("falls back to a mailto navigation when copying is impossible", async () => {
    setClipboard(() => Promise.reject(new Error("denied")));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => {
        throw new Error("unsupported");
      },
    });
    // jsdom cannot navigate, so observe the assignment on a stand-in location.
    const stubLocation = stubWindowLocation();
    render(<CopyEmail />);

    await click(screen.getByRole("button"));

    expect(stubLocation.href).toBe(`mailto:${EMAIL}`);
    expect(screen.getByRole("button")).toHaveTextContent("Copy");
  });

  it("renders the compact chip with copy state in its accessible name", async () => {
    setClipboard(() => Promise.resolve());
    render(<CopyEmail compact />);

    const chip = screen.getByRole("button", { name: `Copy email ${EMAIL}` });
    expect(chip).toHaveTextContent("click to copy");

    await click(chip);

    expect(
      screen.getByRole("button", { name: `Copied ${EMAIL}` }),
    ).toHaveTextContent("copied!");
  });

  it("clears the pending reset timer on unmount", async () => {
    setClipboard(() => Promise.resolve());
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(<CopyEmail />);

    await click(screen.getByRole("button"));
    unmount();

    expect(clearTimeout).toHaveBeenCalled();
  });
});
