# josevalerio.com

Mostly a blog.

## Place photos

Upload curated images to the R2 bucket under `places/<place-id>/`, then add an
`objectKey` and `alt` entry to that place's `photos` array in
`app/data/places.ts`. Width and height are optional. Every listed image appears
in the place's expanded gallery.

The public R2 custom domain serves individual objects but does not expose folder
listings, so the site cannot safely discover arbitrary filenames from a prefix.
