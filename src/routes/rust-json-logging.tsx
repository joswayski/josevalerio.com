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
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <p className="text-blue-800 font-medium">
            <strong>TLDR:</strong> Use the{" "}
            <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded text-sm font-mono">
              valuable
            </code>{" "}
            crate for proper JSON logging in Rust.{" "}
            <a
              href="#solution"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100 underline"
            >
              Jump to solution →
            </a>
          </p>
        </div>
        <p className="">
          If you look around the Rust ecosystem on how to "do logging", you'll
          be recommended the{" "}
          <a
            href="https://github.com/tokio-rs/tracing"
            target="_blank"
            className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
          >
            tracing crate
          </a>{" "}
          pretty much everywhere you go
          <sup>
            <a
              href="https://www.shuttle.dev/blog/2023/09/20/logging-in-rust"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
            >
              [1]
            </a>
            <a
              href="https://github.com/slog-rs/slog?tab=readme-ov-file#you-might-consider-using-tracing-instead"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
            >
              [2]
            </a>
            <a
              href="https://www.reddit.com/r/rust/comments/1elgimo/how_do_you_log_your_applications/"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
            >
              [3]
            </a>
            <a
              href="https://users.rust-lang.org/t/best-way-to-log-with-json/83385"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
            >
              [4]
            </a>
            <a
              href="https://www.youtube.com/watch?v=YHo_ab5S1bo"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
            >
              [5]
            </a>
          </sup>
          . You look and the docs and it says something about events, spans, and
          OpenTelemetry, but you don't really have time for that you just want
          to laaaaaaaawg.
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
          It's because we added the{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            ?
          </code>{" "}
          sigil which tells the tracing subscriber to format it using it's
          `Debug` implementation. We don't really want that so.. what can we do?
          A lot of comments and LLMs might suggest to move the fields that you
          want to the top or even convert it to a{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            serde_json::Value
          </code>{" "}
          first, and use the{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            %
          </code>{" "}
          sigil for the{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            Display
          </code>
          implementation..
        </p>
        <img src="/rlog-3.png" />

        <p>
          Except... sometimes you don't know what those fields will be.. and
          it's also extremely tedious... and you also end up with the same
          problem on nested structs or arrays where they're still strings..
        </p>

        <h3 id="solution" className="text-2xl font-bold">
          The Solution
        </h3>
        <p>
          The tracing crate has an{" "}
          <a
            href="https://github.com/tokio-rs/tracing/discussions/1906"
            target="_blank"
            className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
          >
            experimental feature flag since February 2022
          </a>{" "}
          which adds support for another crate called{" "}
          <a
            href="https://crates.io/crates/valuable"
            target="_blank"
            className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
          >
            valuable
          </a>
          . This crate + feature flag allows us to get the proper JSON formatted
          logs that we're looking for. Here is how to set it up:
        </p>
        <p>
          First, add the valuable crate with{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            cargo add valuable
          </code>
          .
        </p>
        <img src="./rlog-4.png" />
        <p>
          Enable the{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            derive
          </code>{" "}
          feature flag on{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            valuable
          </code>
          , and the{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            valuable
          </code>{" "}
          feature flags on{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            tracing
          </code>{" "}
          and{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            tracing-subscriber
          </code>
          ..
        </p>
        <img src="./rlog-5.png" />

        <p>
          During your{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            cargo build
          </code>
          , enable unstable flags with{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            RUSTFLAGS="--cfg tracing_unstable"
          </code>{" "}
          or, alternatively, create a{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            .cargo/config.toml
          </code>{" "}
          file and add the Rust flags:
        </p>
        <img src="./rlog-6.png" />

        <p>
          Now add the Valuable trait to each struct, and call it using{" "}
          <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            as_value()
          </code>
        </p>
        <img src="./rlog-7.png" />

        <p>
          I've setup{" "}
          <a
            href="https://github.com/joswayski/tracing-valuable-example"
            target="_blank"
            className="text-blue-600 hover:text-blue-800 transition-colors duration-100"
          >
            a sample repo here
          </a>{" "}
          if you'd like to take a look. I hope you found this helpful!
        </p>
      </div>
    </PoastLayout>
  );
}
