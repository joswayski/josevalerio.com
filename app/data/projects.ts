import type { ProjectPreviewProps } from "../components/ProjectPreview";

export const projects: ProjectPreviewProps[] = [
  {
    title: "Caper",
    description: "A (wip!) place for chatting with your people.",
    href: "https://caper.chat",
    destination: "caper.chat",
  },
  {
    title: "Captures",
    description: "A place for your people to chat with anyone about anything.",
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
];
