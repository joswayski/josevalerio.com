import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { PoastPreviewProps } from "./PoastPreview";
import { ArrowLeft } from "lucide-react";

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

  return (
    <div>
      {canGoBack ? (
        <>
          <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b shadow-xl">
            <div className="py-4 px-4 flex items-center ">
              <button
                onClick={() => router.history.back()}
                className="text-slate-700 flex items-center gap-2"
              >
                <ArrowLeft />
                Go Back
              </button>
            </div>
          </div>
        </>
      ) : null}
      {/* Add pt-16 to create space below the fixed navbar */}
      <div className="flex justify-center flex-col mx-auto max-w-7xl px-6 lg:px-8 overflow-hidden pt-20 lg:pt-40">
        <h2 className="lg:text-6xl text-3xl font-bold mb-4 text-slate-900">
          {title}
        </h2>
        <p className="text-slate-500 text-lg mb-4">{date}</p>
        {children}
      </div>
    </div>
  );
}
