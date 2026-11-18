import type { PoastPreviewProps } from "../components/PoastPreview";

export const JustDoTheThing: PoastPreviewProps = {
  title: "Just do the thing",
  previewText:
    "Don't make a ticket, don't have a meeting, don't ask for permission, just do the thing.",
  dateTime: "2025-03-23",
  readingMinutes: 1,
  link: "/just-do-the-thing",
};

export const RustJsonLogging: PoastPreviewProps = {
  title: "How to log structured JSON in Rust",
  previewText:
    '{"message":"Stop fighting with escaped strings","solution":"[{\\"crate\\":\\"sjl\\"}]"}',
  dateTime: "2025-09-01",
  readingMinutes: 3,
  link: "/rust-json-logging",
};

export const NoFunAllowed: PoastPreviewProps = {
  title: "No Fun Allowed",
  previewText: "Old man yells at video games",
  dateTime: "2025-12-21",
  readingMinutes: 5,
  link: "/no-fun-allowed",
};

export const postPreviews: PoastPreviewProps[] = [NoFunAllowed, RustJsonLogging, JustDoTheThing];

/** Formats an ISO post date (YYYY-MM-DD) as "Mon YYYY", e.g. "Mar 2025". */
export function formatPostDate(dateTime: string) {
  return new Date(`${dateTime}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
