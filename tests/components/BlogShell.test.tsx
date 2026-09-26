import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogShell } from "../../app/components/BlogShell";
import {
  formatPostDate,
  JustDoTheThing,
  postPreviews,
} from "../../app/data/postPreviews";
import { renderWithRouter } from "../renderWithRouter";

describe("BlogShell", () => {
  it("renders the post header and children", async () => {
    await renderWithRouter(
      <BlogShell post={JustDoTheThing}>
        <p>Body copy</p>
      </BlogShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: JustDoTheThing.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatPostDate(JustDoTheThing.dateTime)),
    ).toHaveAttribute("dateTime", JustDoTheThing.dateTime);
    expect(
      screen.getByText(`${JustDoTheThing.readingMinutes} min read`, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(JustDoTheThing.previewText)).toBeInTheDocument();
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });

  it("links back to the index from the header", async () => {
    await renderWithRouter(
      <BlogShell post={JustDoTheThing}>
        <p>Body copy</p>
      </BlogShell>,
    );

    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it.each(postPreviews)(
    "builds the GitHub edit url from the post link ($link)",
    async (post) => {
      await renderWithRouter(
        <BlogShell post={post}>
          <p>Body copy</p>
        </BlogShell>,
      );

      expect(
        screen.getByRole("link", { name: /Suggest an edit/ }),
      ).toHaveAttribute(
        "href",
        `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${post.link}.tsx`,
      );
    },
  );

  it("shows the social links and email chip in the header", async () => {
    await renderWithRouter(
      <BlogShell post={JustDoTheThing}>
        <p>Body copy</p>
      </BlogShell>,
    );

    expect(
      screen.getByRole("link", { name: "Jose Valerio on GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /contact@josevalerio\.com/ }),
    ).toBeInTheDocument();
  });
});
