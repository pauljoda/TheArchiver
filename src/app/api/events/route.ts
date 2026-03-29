import { addSSEListener, type SSEEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));

      unsubscribe = addSSEListener((event: SSEEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${data}\n\n`)
          );
        } catch {
          // Stream closed
        }
      });

      // Send keepalive every 30 seconds
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
        } catch {
          if (keepalive) clearInterval(keepalive);
          if (unsubscribe) unsubscribe();
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
