import { CopyEmail } from "./CopyEmail";
import { ExternalAnchor } from "./ExternalLink";

const X_URL = "https://x.com/josevalerio";
const GITHUB_URL = "https://github.com/joswayski";

export function SiteLinks() {
  return (
    <nav className="site-links" aria-label="Elsewhere">
      <ExternalAnchor href={X_URL} className="chip" aria-label="Jose Valerio on X">
        X<span aria-hidden="true">↗</span>
      </ExternalAnchor>
      <ExternalAnchor href={GITHUB_URL} className="chip" aria-label="Jose Valerio on GitHub">
        GitHub<span aria-hidden="true">↗</span>
      </ExternalAnchor>
      <CopyEmail />
    </nav>
  );
}
