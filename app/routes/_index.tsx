import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Jose Valerio" },
    { name: "description", content: "Writings, thoughts, archive." },
  ];
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>WIP</h1>
      <p>
        This is running on a t4g.nano with a 3 year savings plan so it&apos;s
        costing ~$1.30/month - not bad! ipv4 tho... yikes. Trying to get ipv6 to
        work :)
      </p>

      <p>
        Site runs on Remix and Express. Postgres for data, will use it later.
      </p>
      <ul>
        <li>
          <a
            target="_blank"
            href="https://github.com/joswayski/josevalerio.com"
            rel="noreferrer"
          >
            This site&apos;s code on GitHub
          </a>
        </li>
        <li>
          <a
            target="_blank"
            href="https://twitter.com/notjoswayski"
            rel="noreferrer"
          >
            Jose on X / Twitter
          </a>
        </li>
        <li>
          <a target="_blank" href="https://plutomi.com" rel="noreferrer">
            Jose&apos;s company Plutomi Inc.
          </a>
        </li>
        {/* <li>
          <Link to="/pointing">Point your storys</Link>;
        </li>
        <li>
          <Link to="/infra">Infrastructure</Link>
        </li> */}
      </ul>
    </div>
  );
}
