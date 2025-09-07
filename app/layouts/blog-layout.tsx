import { Outlet, useNavigate, useLocation } from "react-router";
import { Home } from "lucide-react";
import { useClipboard } from "@mantine/hooks";
import { toast } from "sonner";
import { JustDoTheThing, RustJsonLogging } from "../data/postPreviews";

const email = "contact@josevalerio.com";

// Map routes to their post data
const routeToPostMap = {
  "/just-do-the-thing": JustDoTheThing,
  "/rust-json-logging": RustJsonLogging,
} as const;

export default function BlogLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const clipboard = useClipboard({ timeout: 500 });
  
  const currentPost = routeToPostMap[location.pathname as keyof typeof routeToPostMap];
  
  if (!currentPost) {
    return <Outlet />;
  }

  const { title, date, link } = currentPost;
  const githubEditUrl = `https://github.com/joswayski/josevalerio.com/edit/main/app/routes${link}.tsx`;

  return (
    <div className="pb-14 ">
      <div className="fixed top-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-white border-x border-b rounded-b-lg shadow-xl max-w-5xl w-full mx-4 border-slate-200">
          <div className="py-4 px-6 lg:px-8 flex items-center">
          <button
            onClick={() => navigate("/")}
            className="text-slate-700 flex items-center gap-2 cursor-pointer hover:text-slate-900 transition-colors"
          >
            <Home />
            Home
          </button>
          </div>
        </div>
      </div>
      <div className="flex justify-center flex-col mx-auto max-w-5xl px-6 lg:px-8 overflow-hidden pt-20 lg:pt-40  border-red-500">
        <h2 className="lg:text-6xl text-3xl font-bold mb-4 text-slate-900">
          {title}
        </h2>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-500 text-lg">{date}</p>
          <a
            href={githubEditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-500 transition-colors text-sm underline flex items-center gap-1"
          >
            ✏️ Edit on GitHub
          </a>
        </div>
        
        <Outlet />

        {/* Footer with contact links */}
        <footer className="mt-16 pt-8 border-t border-slate-200">
          <div className="flex flex-col items-center space-y-4">
            <p className="text-slate-600 text-lg font-medium">
              Questions or feedback?
            </p>
            <button
              type="button"
              onClick={() => {
                clipboard.copy(email);
                toast.success("Email copied!", {
                  position: "top-center",
                  duration: 1_500,
                });
              }}
              className="bg-white px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm border border-slate-200 transition-colors cursor-pointer"
            >
              {email}
            </button>
            <div className="flex justify-center space-x-8 underline text-slate-700">
              <a
                href="https://x.com/notjoswayski"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-500 transition-colors"
              >
                X
              </a>
              <a
                href="https://github.com/joswayski"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-500 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
