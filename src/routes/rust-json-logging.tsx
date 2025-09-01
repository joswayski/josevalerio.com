import { createFileRoute } from "@tanstack/react-router";
import { PoastLayout } from "~/components/PoastLayout";
import { RustJsonLogging } from "~/data/postPreviews";

export const Route = createFileRoute("/rust-json-logging")({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: RustJsonLogging.title,
        description: RustJsonLogging.previewText,
      },
      {
        name: "description",
        content: RustJsonLogging.previewText,
      },
    ],
  }),
});

function RouteComponent() {
  return (
    <PoastLayout postPreview={RustJsonLogging}>
      <div className="text-lg text-slate-700 space-y-8">
        <p className="">
          If you look around the Rust ecosystem on how to "do logging", you'll
          be recommended the{" "}
          <a href="https://github.com/tokio-rs/tracing" target="_blank">
            tracing
          </a>{" "}
          crate pretty much everywhere you go. You look and the docs and it says
          something about events, spans, and OpenTelemetry, but you don't really
          have time for that you just want to laaawg.
        </p>
        <p>
          You setup the example given and and see that you can{" "}
          <code>.json()</code> on the subscriber.. cool lets try that.
        </p>
        <img src="/rlog-1.png" />

        <p>Yay! We have some logs! In JSON too! Let's add some data..</p>
        <img src="/rlog-2.png" />
        <p>Eww.. why does it look like that?</p>
        <p>
          It's because we added the `?` sigil which tells the tracing subscriber
          to format it using it's `Debug` implementation. We don't really want
          that so.. what can we do? A lot of comments and LLMs might suggest to
          move the fields that you want to the top or even convert it to a
          serde_json::Value first, and use the `%` sigil for the `Display`
          implementation..
        </p>
        <img src="/rlog-3.png" />

        <p>
          Except... sometimes you don't know what those fields will be.. and
          it's also extremely tedious... and you also end up with the same
          problem on nested structs or arrays where they're still strings..
        </p>

        <h3>The Solution</h3>
        <p>
          The tracing crate has an experimental feature flag since April 2022 in
          which adds support for another crate called Valuable. This crate
          allows us to get the proper JSON formatted logs that we're looking
          for. Here is how to set it up:
        </p>
      </div>
    </PoastLayout>
  );
}
