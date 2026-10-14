# Repository guidance

A static blog: TanStack Start pre-rendered to `dist/client` and served by
Cloudflare Workers Static Assets. See README for development commands.

## Validation

Run `npm run check` (Oxlint, Oxfmt check, TypeScript typecheck, Vitest and the
static build) before pushing; use `npm run fmt` to format first.

## Shipping

Speed beats ceremony: there are no real users yet, so ship, watch, and fix forward.

- Commit and push straight to `main`; no pull requests. Run `npm run check` first, then `git pull --rebase origin main` and push. Never force-push `main` or rewrite other agents' commits.
- Never put literal CI-skip directives in commit messages, even to explain them.
- Pushes to `main` run `CI` (`.github/workflows/ci.yml`, `npm run check`, under a minute of work) and deploy automatically through Cloudflare Workers Builds (`josevalerio-com`). Nothing in `joswayski/infrastructure` deploys this site, so there is no deploy workflow to dispatch.
- After pushing, confirm both for your commit `SHA`: `gh run list --repo joswayski/josevalerio.com --commit "$SHA"` then `gh run watch <id> --exit-status` for `CI`, and `gh api repos/joswayski/josevalerio.com/commits/"$SHA"/check-runs --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'` until `Workers Builds: josevalerio-com` succeeds. Spot-check the changed pages on https://josevalerio.com and report what shipped.
- If `CI` or the Workers build fails, fix it forward with another commit (or `git revert` the bad commit and push). Use a Cloudflare rollback (`npx wrangler rollback`, or the dashboard) only when a fix will take longer than a few minutes and you have Cloudflare credentials.
- Still ask the owner first for anything irreversible: deleting the Worker, DNS or other Cloudflare resources, or rotating secrets.
