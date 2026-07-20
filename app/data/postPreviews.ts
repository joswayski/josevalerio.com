import type { PoastPreviewProps } from "../components/PoastPreview";

export const JustDoTheThing: PoastPreviewProps = {
  title: "Just do the thing",
  previewText:
    "Don't make a ticket, don't have a meeting, don't ask for permission, just do the thing.",
  date: "March 23, 2025",
  dateTime: "2025-03-23",
  link: "/just-do-the-thing",
};

export const RustJsonLogging: PoastPreviewProps = {
  title: "How to log structured JSON in Rust",
  previewText:
    '{"message":"Stop fighting with escaped strings","solution":"[{\\"crate\\":\\"sjl\\"}]"}',
  date: "September 1, 2025",
  dateTime: "2025-09-01",
  link: "/rust-json-logging",
};

export const NoFunAllowed: PoastPreviewProps = {
  title: "No Fun Allowed",
  previewText:
    'Old man yells at video games',
  date: "December 21, 2025",
  dateTime: "2025-12-21",
  link: "/no-fun-allowed",
};


export const postPreviews: PoastPreviewProps[] = [
  NoFunAllowed,
  RustJsonLogging,
  JustDoTheThing,
];
