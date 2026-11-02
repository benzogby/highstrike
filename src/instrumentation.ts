import type { Instrumentation } from "next";

// Every error the server catches in a page, a route or a server action goes to Admin → Errors (src/lib/capture.ts), as
// on getripping.com. Node only: the service client isn't for the edge runtime the proxy runs in.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureError } = await import("@/lib/capture");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
  await captureError(err, { source: context.routeType === "route" ? "route" : "server", path: request.path.split("?")[0], digest });
};
