import { createFileRoute } from "@tanstack/react-router";
import { PoastLayout } from "~/components/PoastLayout";
import { RustJsonLogging } from "~/data/postPreviews";
import { CodeSnippet } from "~/components/CodeSnippet";
import { ExternalLink } from "~/components/ExternalLink";

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
            <CodeSnippet className="bg-blue-100 text-blue-900 border-blue-200">
              valuable
            </CodeSnippet>{" "}
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
          <ExternalLink href="https://github.com/tokio-rs/tracing">
            tracing crate
          </ExternalLink>{" "}
          pretty much everywhere you go
          <sup>
            <ExternalLink href="https://www.shuttle.dev/blog/2023/09/20/logging-in-rust">
              [1]
            </ExternalLink>
            <ExternalLink href="https://github.com/slog-rs/slog?tab=readme-ov-file#you-might-consider-using-tracing-instead">
              [2]
            </ExternalLink>
            <ExternalLink href="https://www.reddit.com/r/rust/comments/1elgimo/how_do_you_log_your_applications/">
              [3]
            </ExternalLink>
            <ExternalLink href="https://users.rust-lang.org/t/best-way-to-log-with-json/83385">
              [4]
            </ExternalLink>
            <ExternalLink href="https://www.youtube.com/watch?v=YHo_ab5S1bo">
              [5]
            </ExternalLink>
          </sup>
          . You look at the docs and it says something about events, spans, and
          OpenTelemetry, but you don't really have time for that you just want
          to laaaaaaaawg.
        </p>
        <p>
          You setup the example given and see that you can{" "}
          <CodeSnippet>.json()</CodeSnippet> on the subscriber.. cool, lets try
          that.
        </p>
        <img src="/rlog-1.png" />

        <p>Yay! We have some logs! In JSON too! Let's add some data..</p>
        <img src="/rlog-2.png" />
        <p>Eww.. why does it look like that?</p>
        <p>
          It's because we added the <CodeSnippet>?</CodeSnippet> sigil which
          tells the tracing subscriber to format it using its{" "}
          <CodeSnippet>Debug</CodeSnippet> implementation. We don't really want
          that so.. what can we do? A lot of comments and LLMs might suggest to
          move the fields that you want to the top or even convert it to a{" "}
          <CodeSnippet>serde_json::Value</CodeSnippet> first, and use the{" "}
          <CodeSnippet>%</CodeSnippet> sigil for the{" "}
          <CodeSnippet>Display</CodeSnippet> implementation..
        </p>
        <img src="/rlog-3.png" />

        <p>
          Except... sometimes you don't know what those fields will be... and
          it's also extremely tedious. You also end up with the same problem on
          nested structs or arrays where they're still strings...
        </p>

        <h3 id="solution" className="text-3xl font-bold">
          The Solution
        </h3>
        <p>
          The tracing crate has an{" "}
          <ExternalLink href="https://github.com/tokio-rs/tracing/discussions/1906">
            experimental feature flag since February 2022
          </ExternalLink>{" "}
          which adds support for another crate called{" "}
          <ExternalLink href="https://crates.io/crates/valuable">
            valuable
          </ExternalLink>
          . This crate + feature flag allows us to get the proper JSON formatted
          logs that we're looking for. Here is how to set it up:
        </p>
        <p>
          First, add the valuable crate with{" "}
          <CodeSnippet>cargo add valuable</CodeSnippet>.
        </p>
        <img src="/rlog-4.png" />
        <p>
          Enable the <CodeSnippet>derive</CodeSnippet> feature flag on{" "}
          <CodeSnippet>valuable</CodeSnippet>, and the{" "}
          <CodeSnippet>valuable</CodeSnippet> feature flag on{" "}
          <CodeSnippet>tracing</CodeSnippet> and{" "}
          <CodeSnippet>tracing-subscriber</CodeSnippet>:
        </p>
        <img src="/rlog-5.png" />

        <p>
          During your <CodeSnippet>cargo build</CodeSnippet>, enable unstable
          flags with{" "}
          <CodeSnippet>RUSTFLAGS="--cfg tracing_unstable"</CodeSnippet> or,
          alternatively, create a <CodeSnippet>.cargo/config.toml</CodeSnippet>{" "}
          file and add the Rust flags:
        </p>
        <img src="/rlog-6.png" />

        <p>
          Now add <CodeSnippet>#[derive(Valuable)]</CodeSnippet> to each struct,
          and call it using <CodeSnippet>as_value()</CodeSnippet>:
        </p>
        <img src="/rlog-7.png" />

        <p>
          I've setup{" "}
          <ExternalLink href="https://github.com/joswayski/tracing-valuable-example">
            a sample repo here
          </ExternalLink>{" "}
          if you'd like to take a look. I hope you found this helpful!
        </p>
      </div>
    </PoastLayout>
  );
}
