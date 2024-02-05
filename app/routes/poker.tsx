import { Link, Outlet, useLocation } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function PokerLayout() {
  const location = useLocation();

  const [pages, setPages] = useState([
    { name: "New Pointing Session", href: "/poker", current: true },
  ]);

  useEffect(() => {
    if (location.pathname.includes("/poker/rooms/room_")) {
      setPages([
        { name: "New Pointing Session", href: "/poker", current: false },
        { name: "Room", href: location.pathname, current: true },
      ]);
    } else {
      setPages([
        { name: "New Pointing Session", href: "/poker", current: true },
      ]);
    }
  }, [location]);

  console.log(location);

  return (
    <div className="py-10 h-full p-8">
      <nav className="flex flex-row " aria-label="Breadcrumb">
        <ol
          role="list"
          className="flex space-x-4 rounded-md bg-white px-6 shadow"
        >
          <li className="flex">
            <div className="flex items-center">
              <Link
                to="/"
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-home"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>{" "}
                <span className="sr-only">Home</span>
              </Link>
            </div>
          </li>
          {pages.map((page) => (
            <li key={page.name} className="flex">
              <div className="flex items-center">
                <svg
                  className="h-full w-6 flex-shrink-0 text-gray-200"
                  viewBox="0 0 24 44"
                  preserveAspectRatio="none"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
                </svg>
                <a
                  href={page.href}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  aria-current={page.current ? "page" : undefined}
                >
                  {page.name}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      <main className="mx-auto max-w-7xl sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
