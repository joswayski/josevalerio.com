export function getSocialMeta() {
  return [
    { property: "og:site_name", content: "Jose Valerio" },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: "https://josevalerio.com/og.png",
    },
    { property: "og:image:width", content: "1730" },
    { property: "og:image:height", content: "909" },
    {
      property: "og:image:alt",
      content: "Jose Valerio on a warm cream typographic card",
    },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://josevalerio.com/og.png",
    },
  ];
}
