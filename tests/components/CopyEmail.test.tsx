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
  });

  it("copies the email through the clipboard api and resets the label after the timeout", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    setClipboard(writeText);
    render(<CopyEmail />);

    const button = screen.getByRole("button", { name: `Copy email ${EMAIL}` });
    expect(button).toHaveTextContent("Email");

    await click(button);
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    expect(
      screen.getByRole("button", { name: `Copied ${EMAIL}` }),
    ).toHaveTextContent("Copied");

    await act(async () => {
      vi.advanceTimersByTime(1_800);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Email");
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

  it("shows the address as selectable text when copying is impossible", async () => {
    setClipboard(() => Promise.reject(new Error("denied")));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => {
        throw new Error("unsupported");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<CopyEmail />);

    await click(screen.getByRole("button"));

    expect(
      screen.getByRole("button", {
        name: `Could not copy ${EMAIL}, select it manually`,
      }),
    ).toHaveTextContent("Copy failed");
    expect(screen.getByText(EMAIL)).toHaveClass("email-fallback");
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
