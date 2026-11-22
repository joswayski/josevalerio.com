import type { PoastPreviewProps } from "../components/PoastPreview";

export const SITE_TITLE = "Jose Valerio";
export const SITE_DESCRIPTION =
  "Software engineer building Caper, Captures, and Anybase. Projects and occasional writing.";

export function getSocialMeta(type: "website" | "article" = "website") {
  return [
    { property: "og:site_name", content: SITE_TITLE },
    { property: "og:type", content: type },
    {
      property: "og:image",
      content: "https://josevalerio.com/og.png",
    },
    { property: "og:image:width", content: "1728" },
    { property: "og:image:height", content: "910" },
    {
      property: "og:image:alt",
      content: 'Minimal typographic card reading "Jose Valerio" beside a blood-orange color field',
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
  socialTitle = title,
  description,
  type = "website",
}: {
  title: string;
  socialTitle?: string;
  description: string;
  type?: "website" | "article";
}) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: socialTitle },
    { property: "og:description", content: description },
    { name: "twitter:title", content: socialTitle },
    { name: "twitter:description", content: description },
    ...getSocialMeta(type),
  ];
}

export function getPostMeta(post: PoastPreviewProps) {
  return getPageMeta({
    title: `${post.title} - ${SITE_TITLE}`,
    socialTitle: post.title,
    description: post.previewText,
    type: "article",
  });
}
