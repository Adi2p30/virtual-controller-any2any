// Server-Sent Events stream. The browser dashboard subscribes here and receives
// the current state immediately, then every subsequent update the hub emits.

import { hub } from "@/lib/hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // initial snapshot
      send("snapshot", { state: hub.state, log: hub.log, metrics: hub.metrics });

      const unsubscribe = hub.subscribe((e) => send("update", e));

      // keep-alive ping so proxies don't close the connection
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
