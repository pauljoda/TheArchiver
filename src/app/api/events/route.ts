import { addSSEListener, type SSEEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepalive) clearInterval(keepalive);
        if (unsubscribe) unsubscribe();
      };

      // Send initial ping
      controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));

      unsubscribe = addSSEListener((event: SSEEvent) => {
        if (closed) return;
        try {
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${data}\n\n`)
          );
        } catch {
          cleanup();
        }
      });

      // Send keepalive every 30 seconds
      keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
        } catch {
          cleanup();
        }
      }, 30000);
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
