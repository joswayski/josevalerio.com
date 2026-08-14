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

React Router pre-renders every route into `build/client`. The production output
contains no server bundle and does not require Node.js at runtime.

## Cloudflare

The site uses Cloudflare Workers Static Assets with no Worker script. The
configuration in `wrangler.jsonc` serves the pre-rendered files directly and
preserves the site's trailing-slash-free URLs.

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
`build/client`.
