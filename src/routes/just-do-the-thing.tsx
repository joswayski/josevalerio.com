import { createFileRoute } from "@tanstack/react-router";
import { PoastLayout } from "~/components/PoastLayout";
import { JustDoTheThing } from "~/data/postPreviews";

export const Route = createFileRoute("/just-do-the-thing")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PoastLayout postPreview={JustDoTheThing}>
      <div>
        <p className="text-md text-slate-700">
          Sometimes you&apos;re working on a task that and come across a p
        </p>
      </div>
    </PoastLayout>
  );
}
