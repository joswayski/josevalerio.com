export function getSocialMeta() {
  return [
    { property: "og:site_name", content: "Jose Valerio" },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: "https://josevalerio.com/og.png",
    },
    { property: "og:image:width", content: "1728" },
    { property: "og:image:height", content: "910" },
    {
      property: "og:image:alt",
      content: "Jose Valerio beside a blood-orange red color field in a minimal typographic card",
    },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://josevalerio.com/og.png",
    },
  ];
}
