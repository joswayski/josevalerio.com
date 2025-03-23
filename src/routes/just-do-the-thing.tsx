import { createFileRoute } from "@tanstack/react-router";
import { PoastLayout } from "~/components/PoastLayout";
import { JustDoTheThing } from "~/data/postPreviews";

export const Route = createFileRoute("/just-do-the-thing")({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: JustDoTheThing.title,
        description: JustDoTheThing.previewText,
      },
    ],
  }),
});

function RouteComponent() {
  return (
    <PoastLayout postPreview={JustDoTheThing}>
      <div className="text-lg text-slate-700 space-y-8">
        <p className="">
          Sometimes you'll be working on a task and encounter some other part of
          the codebase that needs fixing, tech debt if you will. Other times,
          when digging through logs for your current task, you'll discover a
          strange issue that affects a small percentage of users in a specific
          region, but only on the weekends.
          <span className="font-bold">
            {" "}
            If it takes less than an hour to fix, you should tackle it as part
            of your current task.
          </span>
        </p>
        <p>
          "
          <span className="italic">
            But I have another more important thing to do!
          </span>
          " I hear you say "<span className="italic">It's out of scope!</span>".
          I promise you it's not a big deal, you can do both. Don't make a Jira
          ticket and put it in the eternal backlog, just fix it. Don't post a
          Slack message for people to discuss, just DO THE THING that's required
          and fix it. Since your code will (hopefully) be reviewed anyway, in
          these cases it's better to ask for forgiveness when/if the time comes.
          More often than not, you'll actually be praised by your peers for
          finally tackling that thing nobody wanted to touch, and you'll save
          everyone from yet another conversation on how nobody has enough
          bandwidth this sprint to pick it up.
        </p>
      </div>
    </PoastLayout>
  );
}
