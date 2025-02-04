const links = [
  {
    text: "X",
    href: "https://x.com/@notjoswayski",
  },
  {
    text: "GitHub",
    href: "https://github.com/joswayski",
  },
];
export default function Home() {
  return (
    <main className="flex my-40 flex-col items-center justify-center  space-y-20   ">
      <h1 className="font-bold text-6xl">Jose Valerio</h1>
      <ul className="flex flex-wrap gap-20 items-center justify-center ">
        {links.map((l) => (
          <li key={l.href}>
            <a
              className="rounded-full underline hover:bg-slate-200 transition-colors flex items-center justify-center text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {l.text}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
