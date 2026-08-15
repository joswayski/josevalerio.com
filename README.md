# josevalerio.com

Mostly a blog.

## Development

```sh
npm install
npm run dev
```

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
