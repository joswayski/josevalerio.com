import type { ProjectPreviewProps } from "../components/ProjectPreview";

export const projects: ProjectPreviewProps[] = [
  {
    title: "Captures",
    description: "WIP cross-platform screen capture utility.",
    href: "https://captur.es",
    destination: "captur.es",
  },
  {
    title: "Credit Card Horoscope",
    description: "What does your credit card say about you?",
    href: "https://creditcardhoroscope.com",
    destination: "creditcardhoroscope.com",
  },
  {
    title: "sjl",
    description:
      "A simple JSON logger for Rust, built to avoid tracing's nested JSON limitations.",
    href: "https://crates.io/crates/sjl",
    destination: "crates.io",
  },
  {
    title: "snv",
    description: "Simple NV, a simple .env loader for Rust.",
    href: "https://crates.io/crates/snv",
    destination: "crates.io",
  },
];
