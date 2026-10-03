import type { ProjectPreviewProps } from "../components/ProjectPreview";

export const projects: ProjectPreviewProps[] = [
  {
    title: "Caper",
    description: "A place for your people to chat about anything.",
    href: "https://caper.chat",
    destination: "caper.chat",
  },
  {
    title: "Captures",
    description: "A cross-platform screen capture utility.",
    href: "https://captur.es",
    destination: "captur.es",
  },
  {
    title: "dbm",
    description:
      "A fast, local-first database manager for PostgreSQL, MySQL, and Redis.",
    href: "https://github.com/joswayski/dbm",
    destination: "github.com",
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
];
