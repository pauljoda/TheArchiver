type EventHandler = (data: SSEEvent) => void;

export interface SSEEvent {
  type:
    | "job:added"
    | "job:active"
    | "job:completed"
    | "job:failed"
    | "job:log"
    | "queue:cleared"
    | "failed:cleared"
    | "history:cleared";
  data: Record<string, unknown>;
}

// Use globalThis so the listeners Set is shared across all Next.js module
// contexts (instrumentation/worker vs API routes) in both dev and prod.
const g = globalThis as typeof globalThis & {
  __archiverSSEListeners?: Set<EventHandler>;
};
if (!g.__archiverSSEListeners) {
  g.__archiverSSEListeners = new Set();
}
const listeners = g.__archiverSSEListeners;

export function addSSEListener(handler: EventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function emitSSEEvent(event: SSEEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Ignore errors from closed connections
    }
  }
}
