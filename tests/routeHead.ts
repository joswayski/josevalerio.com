export type MetaTag = {
  title?: string;
  name?: string;
  property?: string;
  charSet?: string;
  content?: string;
};

export type LinkTag = {
  rel?: string;
  href?: string;
  sizes?: string;
  type?: string;
};

type RouteWithHead = { options: { head?: unknown } };

/**
 * Calls a route's `head()` outside of a router match, which the generated route
 * types do not model, and returns the tags it declares.
 */
export function routeHead(route: RouteWithHead): {
  meta: MetaTag[];
  links: LinkTag[];
} {
  const head = route.options.head;
  if (typeof head !== "function") throw new Error("route has no head()");

  const result: unknown = head({});
  if (typeof result !== "object" || result === null) {
    throw new Error("route head() returned no tags");
  }

  const meta = "meta" in result ? result.meta : [];
  const links = "links" in result ? result.links : [];
  if (!Array.isArray(meta) || !Array.isArray(links)) {
    throw new Error("route head() returned non-array tags");
  }

  return { meta: meta as MetaTag[], links: links as LinkTag[] };
}

export function tagContent(meta: MetaTag[], key: string): string | undefined {
  return meta.find((tag) => tag.name === key || tag.property === key)?.content;
}
