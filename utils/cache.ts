type Handler<TProps, TContext, TReturn> = (
  props: TProps,
  req: Request,
  ctx: TContext,
) => Promise<TReturn | null>;

const CACHE_NAME = "deco-aliens";

const cache = await caches.open(CACHE_NAME);

export const withCache = <TProps, TContext, TReturn>(
  handler: Handler<TProps, TContext, TReturn>,
) =>
async (props: TProps, req: Request, ctx: TContext): Promise<TReturn | null> => {
  try {
    const url = new URL(req.url);
    url.searchParams.set("props", JSON.stringify(props));

    const cached = await cache.match(url);

    if (cached) {
      return cached.json();
    }

    const response = await handler(props, req, ctx);

    if (response) {
      cache.put(url, new Response(JSON.stringify(response)));
    }

    return response;
  } catch (error) {
    console.error(error);
  }

  return null;
};
