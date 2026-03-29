"use client";

import { useEffect, useRef, useCallback } from "react";

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.addEventListener("message", (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {
        // Ignore parse errors
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
    };
  }, []);
}

export function useRefreshOnEvent(refreshFn: () => void) {
  const refresh = useCallback(refreshFn, [refreshFn]);

  useSSE(() => {
    refresh();
  });
}
