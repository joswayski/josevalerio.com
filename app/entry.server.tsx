import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  let didError = false;

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error) {
        didError = true;
        console.error(error);
      },
      signal: request.signal,
    },
  );

  // This entry only runs while generating static files, so wait for the
  // complete document instead of streaming a partial shell.
  await body.allReady;
  responseHeaders.set("Content-Type", "text/html");

  return new Response(body, {
    headers: responseHeaders,
    status: didError ? 500 : responseStatusCode,
  });
}
