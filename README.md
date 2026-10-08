# josevalerio.com

Mostly a blog.

## Development

Use Node 24 (the CI version), or another version supported by `package.json`.
The site uses Vite 8 (Rolldown/Oxc), Vitest 5, TypeScript 7's native compiler,
and the Rust-based Oxlint/Oxfmt tools. Node/npm remain the development tools;
deployment remains static.

```sh
npm ci
npm run dev
npm run check       # Lint, formatting, typecheck, tests, and static build
npm run lint        # Correctness rules; warnings fail
npm run fmt         # Format first-party source and configuration
```

Generated routes, public assets, and npm's lockfile are not reformatted. GitHub
Actions runs `npm run check` on pull requests and main; it does not deploy.

## Tests

```sh
npm test
npm run test:watch
npm run test:coverage
```

Vitest runs the unit tests in `tests/` against jsdom. `tests/renderWithRouter.tsx`
wraps components that render `Link` in a memory-history router.

## Static build

```sh
npm run typecheck
npm run build
```

TanStack Start pre-renders every public route into `dist/client`, including a
static `404.html` fallback. The build also creates `dist/server` temporarily so
TanStack can render the HTML files at build time. Cloudflare does not upload or
run that directory, so the deployed site has no Node.js runtime dependency.

## Cloudflare

The site uses Cloudflare Workers Static Assets with no Worker script. The
configuration in `wrangler.jsonc` uploads only `dist/client`, serves the
pre-rendered files directly, and preserves the site's trailing-slash-free URLs.

Preview the Cloudflare deployment locally:

```sh
npm run preview
```

Deploy after authenticating Wrangler:

```sh
npm run deploy
```

For Cloudflare Workers Builds, use `npm run build` as the build command and
`npx wrangler deploy` as the deploy command. The static asset directory is
`dist/client`.
