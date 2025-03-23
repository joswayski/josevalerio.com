import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { PoastPreviewProps } from "./PoastPreview";
import { ArrowLeft, Home } from "lucide-react";
import { redirect } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

type PoastLayoutProps = {
  children: React.ReactNode;
  postPreview: PoastPreviewProps;
};

export function PoastLayout({
  children,
  postPreview: { title, date },
}: PoastLayoutProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();

  return (
    <div className="pb-28">
      <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b shadow-xl">
        <div className="py-4 px-4 flex items-center ">
          <button
            onClick={() =>
              canGoBack ? router.history.back() : navigate({ to: "/" })
            }
            className="text-slate-700 flex items-center gap-2"
          >
            <Home />
            Home
          </button>
        </div>
      </div>
      {/* Add pt-16 to create space below the fixed navbar */}
      <div className="flex justify-center flex-col mx-auto max-w-5xl px-6 lg:px-8 overflow-hidden pt-20 lg:pt-40">
        <h2 className="lg:text-6xl text-3xl font-bold mb-4 text-slate-900">
          {title}
        </h2>
        <p className="text-slate-500 text-lg mb-4">{date}</p>
        {children}
      </div>
    </div>
  );
}
