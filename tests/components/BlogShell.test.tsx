import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogShell } from "../../app/components/BlogShell";
import { JustDoTheThing, postPreviews } from "../../app/data/postPreviews";
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
    expect(screen.getByText(JustDoTheThing.date)).toHaveAttribute(
      "dateTime",
      JustDoTheThing.dateTime,
    );
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });

  it("links back to the index from the header and the footer", async () => {
    await renderWithRouter(
      <BlogShell post={JustDoTheThing}>
        <p>Body copy</p>
      </BlogShell>,
    );

    for (const name of [/All writing/, /More writing/]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "/");
    }
  });

  it.each(postPreviews)(
    'builds the GitHub edit url from the post link ($link)',
    async (post) => {
      await renderWithRouter(
        <BlogShell post={post}>
          <p>Body copy</p>
        </BlogShell>,
      );

      expect(
        screen.getByRole("link", { name: /Suggest changes on GitHub/ }),
      ).toHaveAttribute(
        "href",
        `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${post.link}.tsx`,
      );
    },
  );

  it("offers the email copy button in the footer", async () => {
    await renderWithRouter(
      <BlogShell post={JustDoTheThing}>
        <p>Body copy</p>
      </BlogShell>,
    );

    expect(
      screen.getByRole("button", { name: /contact@josevalerio\.com/ }),
    ).toBeInTheDocument();
  });
});
