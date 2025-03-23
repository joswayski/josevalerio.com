import { createFileRoute } from "@tanstack/react-router";
import { PoastPreview } from "~/components/PoastPreview";
import { postPreviews } from "~/data/postPreviews";
import { useClipboard } from "@mantine/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

const email = "contact@josevalerio.com";

function Home() {
  const clipboard = useClipboard({ timeout: 500 });

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-black text-6xl font-bold mt-8">Jose Valerio</h1>
      <button
        type="button"
        onClick={() => {
          clipboard.copy(email);
          toast.success("Email copied!", {
            position: "top-center",
            duration: 1_500,
          });
        }}
        className="mt-4 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 rounded-md"
      >
        {email}
      </button>
      <div className="flex justify-center space-x-20 mt-4 underline text-slate-700 ">
        <a
          href="https://x.com/notjoswayski"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-500"
        >
          X
        </a>
        <a
          href="https://github.com/joswayski"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-500"
        >
          GitHub
        </a>
      </div>
      <div className="lg:p-8 px-4 py-8">
        {postPreviews.map((p) => (
          <PoastPreview key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
