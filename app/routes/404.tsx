import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "../components/NotFoundPage";
import { getPageMeta, SITE_TITLE } from "../data/siteMeta";

export const Route = createFileRoute("/404")({
  head: () => ({
    meta: getPageMeta({
      title: `404 - ${SITE_TITLE}`,
      description: "This page doesn’t exist.",
    }),
  }),
  component: NotFoundPage,
});
