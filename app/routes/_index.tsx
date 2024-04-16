import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Jose Valerio" },
    { name: "description", content: "Writings, thoughts, archive." },
  ];
};

const items = [
  {
    id: "1",
    text: "This site's code on GitHub",
    href: "https://github.com/joswayski/josevalerio.com",
  },
  {
    id: "2",
    text: "Jose on X / Twitter",
    href: "https://twitter.com/notjoswayski",
  },
  {
    id: "3",
    text: "Jose's company Plutomi Inc.",
    href: "https://plutomi.com",
  },
];

export default function Index() {
  return (
    <div className="mx-auto mt-40 max-w-2xl p-8 bg-gray-50 rounded-md shadow">
      <h1 className="text-3xl font-bold text-slate-800 my-4">Hi :) </h1>

      <div className="flex flex-col space-y-4 ">
        <p className="text-slate-500">I&apos;ll write something here soon</p>
        {/* 
        <p className="text-md text-slate-500">
          Site runs on Nginx, Remix + Express, and Postgres for data. Setting up
          Jira pointing poker right now.
        </p> */}
      </div>

      <ul className="divide-y divide-gray-200 py-4 ">
        {items.map((item) => (
          <li key={item.id} className="py-2">
            <a
              target="_blank"
              href={item.href}
              rel="noreferrer"
              className="text-blue-500 underline text-center hover:text-blue-700 transition duration-200 ease-in-out"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>

      {/* <Link to="/poker" className="w-full flex  justify-end">
        <button
          type="button"
          className="inline-flex self-end items-center gap-x-2 rounded-md bg-slate-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
        >
          Pointing Poker
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-arrow-right"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </Link> */}
    </div>
  );
}
