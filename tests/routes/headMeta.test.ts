import { describe, expect, it } from "vitest";
import { Route as IndexRoute } from "../../app/routes/index";
import { Route as JustDoTheThingRoute } from "../../app/routes/just-do-the-thing";
import { Route as NoFunAllowedRoute } from "../../app/routes/no-fun-allowed";
import { Route as RustJsonLoggingRoute } from "../../app/routes/rust-json-logging";
import {
  JustDoTheThing,
  NoFunAllowed,
  RustJsonLogging,
} from "../../app/data/postPreviews";
import { getSocialMeta } from "../../app/data/siteMeta";
import { routeHead, tagContent } from "../routeHead";

describe("route head meta", () => {
  it("titles and describes the home page", () => {
    const { meta } = routeHead(IndexRoute);

    expect(meta[0]?.title).toBe("Jose Valerio");
    expect(tagContent(meta, "description")).toBe(
      "Jose Valerio's personal website",
    );
    expect(tagContent(meta, "og:title")).toBe("Jose Valerio");
    expect(tagContent(meta, "twitter:title")).toBe("Jose Valerio");
  });

  it.each([
    ["just-do-the-thing", JustDoTheThingRoute, JustDoTheThing],
    ["rust-json-logging", RustJsonLoggingRoute, RustJsonLogging],
    ["no-fun-allowed", NoFunAllowedRoute, NoFunAllowed],
  ])("derives %s meta from its post preview", (_name, route, post) => {
    const { meta } = routeHead(route);

    expect(meta[0]?.title).toBe(post.title);
    for (const key of ["description", "og:description", "twitter:description"]) {
      expect(tagContent(meta, key)).toBe(post.previewText);
    }
    for (const key of ["og:title", "twitter:title"]) {
      expect(tagContent(meta, key)).toBe(post.title);
    }
  });

  it.each([
    ["index", IndexRoute],
    ["just-do-the-thing", JustDoTheThingRoute],
    ["rust-json-logging", RustJsonLoggingRoute],
    ["no-fun-allowed", NoFunAllowedRoute],
  ])("appends the shared social meta to %s", (_name, route) => {
    const { meta } = routeHead(route);

    for (const shared of getSocialMeta()) {
      expect(meta).toContainEqual(shared);
    }
  });
});
