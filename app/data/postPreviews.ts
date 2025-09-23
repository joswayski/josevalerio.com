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
    '{"message":"Stop fighting with escaped strings","solution":"[{\\"crate\\":\\"valuable\\"}]"}',
  date: "September 1, 2025",
  link: "/rust-json-logging",
};

export const HomelabInit: PoastPreviewProps = {
  id: "3",
  title: "Homelab Init",
  previewText:
    "Using K3S to host all of my apps and projects at home Or: How I spent $2,774.05 in order to save $10/month.",
  date: "September 25, 2025",
  link: "/homelab",
};

export const postPreviews: PoastPreviewProps[] = [
  HomelabInit,
  RustJsonLogging,
  JustDoTheThing,
];
