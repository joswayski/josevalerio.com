import { describe, expect, it } from "vitest";
import { getSocialMeta } from "../../app/data/siteMeta";

describe("getSocialMeta", () => {
  it("returns a fresh array on each call", () => {
    const first = getSocialMeta();
    const second = getSocialMeta();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("declares the open graph image with matching twitter fallbacks", () => {
    const meta = getSocialMeta();
    const byProperty = new Map(
      meta
        .filter((tag) => "property" in tag)
        .map((tag) => [tag.property, tag.content]),
    );
    const byName = new Map(
      meta.filter((tag) => "name" in tag).map((tag) => [tag.name, tag.content]),
    );

    expect(byProperty.get("og:site_name")).toBe("Jose Valerio");
    expect(byProperty.get("og:type")).toBe("website");
    expect(byProperty.get("og:image")).toBe("https://josevalerio.com/og.png");
    expect(byProperty.get("og:image:width")).toBe("1728");
    expect(byProperty.get("og:image:height")).toBe("910");
    expect(byProperty.get("og:image:alt")).toBeTruthy();
    expect(byName.get("twitter:card")).toBe("summary_large_image");
    expect(byName.get("twitter:image")).toBe(byProperty.get("og:image"));
  });

  it("uses absolute https urls for the image tags", () => {
    const imageKeys = ["og:image", "twitter:image"];
    for (const tag of getSocialMeta()) {
      const key = ("property" in tag ? tag.property : tag.name) ?? "";
      if (!imageKeys.includes(key)) continue;
      expect(new URL(tag.content).protocol).toBe("https:");
    }
  });
});
