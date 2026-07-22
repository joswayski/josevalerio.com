import type { ProjectPreviewProps } from "../components/ProjectPreview";

export const projects: ProjectPreviewProps[] = [
  {
    title: "Captures",
    description: "WIP cross-platform screen capture utility.",
    links: [
      { label: "Website", href: "https://captur.es" },
      { label: "GitHub", href: "https://github.com/joswayski/captures" },
    ],
  },
  {
    title: "Credit Card Horoscope",
    description: "What does your credit card say about you?",
    links: [{ label: "Website", href: "https://creditcardhoroscope.com" }],
  },
  {
    title: "sjl",
    description:
      "A simple JSON logger for Rust, built to avoid tracing's nested JSON limitations.",
    links: [{ label: "crates.io", href: "https://crates.io/crates/sjl" }],
  },
  {
    title: "snv",
    description: "Simple NV, a simple .env loader for Rust.",
    links: [{ label: "crates.io", href: "https://crates.io/crates/snv" }],
  },
];
