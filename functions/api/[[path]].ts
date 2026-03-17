const BACKEND = "https://maxspeed-api.fly.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = `${BACKEND}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (
    context.request.method !== "GET" &&
    context.request.method !== "HEAD"
  ) {
    init.body = context.request.body;
    // @ts-ignore - duplex needed for streaming body
    init.duplex = "half";
  }

  const response = await fetch(target, init);

  // Forward the response back with all headers (including set-cookie)
  const respHeaders = new Headers(response.headers);
  respHeaders.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  });
};
