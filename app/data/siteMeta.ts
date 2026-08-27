import type { PoastPreviewProps } from "../components/PoastPreview";

export const SITE_TITLE = "Jose Valerio";
export const SITE_DESCRIPTION = "Jose Valerio's personal website";

export function getSocialMeta() {
  return [
    { property: "og:site_name", content: SITE_TITLE },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: "https://josevalerio.com/og.png",
    },
    { property: "og:image:width", content: "1728" },
    { property: "og:image:height", content: "910" },
    {
      property: "og:image:alt",
      content:
        "Jose Valerio beside a blood-orange red color field in a minimal typographic card",
    },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://josevalerio.com/og.png",
    },
  ];
}

export function getPageMeta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...getSocialMeta(),
  ];
}

export function getPostMeta(post: PoastPreviewProps) {
  return getPageMeta({ title: post.title, description: post.previewText });
}
