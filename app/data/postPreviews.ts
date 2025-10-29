import type { PoastPreviewProps } from "../components/PoastPreview";

export const JustDoTheThing: PoastPreviewProps = {
  id: "1",
  title: "Just do the thing",
  previewText:
    "Don't make a ticket, don't have a meeting, don't ask for permission, just do the thing.",
  date: "March 23, 2025",
  link: "/just-do-the-thing",
};

export const RustJsonLogging: PoastPreviewProps = {
  id: "2",
  title: "How to log structured JSON in Rust",
  previewText:
    '{"message":"Stop fighting with escaped strings","solution":"[{\\"crate\\":\\"sjl\\"}]"}',
  date: "September 1, 2025",
  link: "/rust-json-logging",
};

export const postPreviews: PoastPreviewProps[] = [
  RustJsonLogging,
  JustDoTheThing,
];
