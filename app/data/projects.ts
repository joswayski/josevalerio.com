import type { ProjectPreviewProps } from "../components/ProjectPreview";

export const projects: ProjectPreviewProps[] = [
  {
    title: "Captures",
    description:
      "A work-in-progress, cross-platform screen capture utility built for quick captures and privacy by default.",
    status: "Building",
    links: [
      { label: "Website", href: "https://captur.es" },
      { label: "GitHub", href: "https://github.com/joswayski/captures" },
    ],
  },
  {
    title: "DBM",
    description:
      "A local-first desktop database manager for macOS, Windows, and Linux.",
    status: "Building",
    links: [{ label: "GitHub", href: "https://github.com/joswayski/dbm" }],
  },
  {
    title: "Credit Card Horoscope",
    description: "A playful web app that reads your credit card like a horoscope.",
    status: "Live",
    links: [{ label: "Website", href: "https://creditcardhoroscope.com" }],
  },
  {
    title: "sjl",
    description:
      "A simple JSON logger for Rust that emits structured JSON to stderr.",
    status: "Rust crate",
    links: [{ label: "crates.io", href: "https://crates.io/crates/sjl" }],
  },
  {
    title: "snv",
    description: "A small, straightforward .env loader for Rust development.",
    status: "Rust crate",
    links: [{ label: "crates.io", href: "https://crates.io/crates/snv" }],
  },
];
