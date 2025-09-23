import { HomelabInit } from "../data/postPreviews";
import { BlogShell } from "~/components/BlogShell";

export function meta() {
  return [
    { title: HomelabInit.title },
    { name: "description", content: HomelabInit.previewText },
  ];
}

export default function RustJSONLoggingPage() {
  return (
    <BlogShell>
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
        <p>I used to host all of my side projects on Railway.</p>
      </div>
    </BlogShell>
  );
}
