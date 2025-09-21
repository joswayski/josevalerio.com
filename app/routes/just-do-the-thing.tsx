import { JustDoTheThing } from "../data/postPreviews";
import type { Route } from "../+types/root";
import { BlogShell } from "~/components/BlogShell";


export function meta({}: Route.MetaArgs) {
  return [
    { title: JustDoTheThing.title },
    { name: "description", content: JustDoTheThing.previewText },
  ];
}

export default function JustDoTheThingPage() {
  return (
          <BlogShell>
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
        <p className="pt-8">
          "
          <span className="italic ">
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
    </BlogShell>
  );
}
