"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewUrl } from "@/lib/file-preview";

interface ImagePreviewProps {
  filePath: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;
const WHEEL_FACTOR = 0.002;

/**
 * Hybrid CSS + transform approach:
 * - The <img> is sized by CSS (max-w-full max-h-full) and centered by flexbox.
 * - Zoom and pan are applied via CSS transform on top of the CSS layout.
 * - zoom=1 means "fit to view" (the CSS default). zoom=2 means 2x the fit size.
 * - No container measurement needed for positioning — CSS handles it.
 */
export function ImagePreview({ filePath }: ImagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  // Refs for native event handlers
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  function handleImageLoad() {
    const img = imgRef.current;
    if (img) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }

  // Zoom toward a point, keeping that point visually fixed.
  // (cx, cy) is relative to the container's center.
  const applyZoom = useCallback((newZoom: number, cx: number, cy: number) => {
    const clamped = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
    const oldZoom = zoomRef.current;
    const oldPan = panRef.current;
    const ratio = clamped / oldZoom;

    setPan({
      x: cx - (cx - oldPan.x) * ratio,
      y: cy - (cy - oldPan.y) * ratio,
    });
    setZoom(clamped);
  }, []);

  // Get cursor position relative to the img element's layout center
  function getCursorRelCenter(clientX: number, clientY: number) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    // rect accounts for the transform, so we need the untransformed center
    // Untransformed center = rect center adjusted for current transform
    const z = zoomRef.current;
    const p = panRef.current;
    // The visual center of the img = layout center + pan, scaled by zoom
    // Actually, with transform-origin: center, the layout center stays at rect's center
    // when pan=0 and zoom=1. With transform, visual center shifts.
    // Cursor relative to the container center works best:
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const cr = container.getBoundingClientRect();
    return {
      x: clientX - (cr.left + cr.width / 2),
      y: clientY - (cr.top + cr.height / 2),
    };
  }

  // Scroll-wheel zoom (native handler for reliable preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const cr = el.getBoundingClientRect();
      const cx = e.clientX - (cr.left + cr.width / 2);
      const cy = e.clientY - (cr.top + cr.height / 2);
      const factor = 1 - e.deltaY * WHEEL_FACTOR;
      applyZoom(zoomRef.current * factor, cx, cy);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyZoom]);

  // Pinch-to-zoom (native touch handlers)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function getTouchDist(e: TouchEvent) {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function getTouchCenterRel(e: TouchEvent) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const cr = el!.getBoundingClientRect();
      return {
        x: (a.clientX + b.clientX) / 2 - (cr.left + cr.width / 2),
        y: (a.clientY + b.clientY) / 2 - (cr.top + cr.height / 2),
      };
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStart.current = { dist: getTouchDist(e), zoom: zoomRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart.current) {
        e.preventDefault();
        const newDist = getTouchDist(e);
        const ratio = newDist / pinchStart.current.dist;
        const newZoom = pinchStart.current.zoom * ratio;
        const center = getTouchCenterRel(e);
        applyZoom(newZoom, center.x, center.y);
      }
    };

    const onTouchEnd = () => {
      pinchStart.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyZoom]);

  function zoomInBtn() {
    applyZoom(zoom * 1.5, 0, 0);
  }

  function zoomOutBtn() {
    applyZoom(zoom / 1.5, 0, 0);
  }

  function fitToView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (zoom === 1) {
      const rel = getCursorRelCenter(e.clientX, e.clientY);
      // Zoom to ~2.5x fit, centered on cursor
      applyZoom(2.5, rel.x, rel.y);
    } else {
      fitToView();
    }
  }

  // Drag to pan
  function handlePointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return;
    if (e.pointerType === "touch" && pinchStart.current) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  // Compute display percentage relative to natural size
  // CSS fit scale = img.clientWidth / naturalWidth (when zoom=1)
  const percentage = (() => {
    const img = imgRef.current;
    if (!img || !naturalSize || naturalSize.w === 0) return 100;
    // img.clientWidth is the CSS-fitted width (before transform)
    const cssScale = img.clientWidth / naturalSize.w;
    return Math.round(cssScale * zoom * 100);
  })();

  const isZoomed = zoom > 1;

  return (
    <div className="relative size-full select-none touch-none">
      <div
        ref={containerRef}
        className={
          "size-full overflow-hidden flex items-center justify-center p-3 " +
          (isDragging
            ? "cursor-grabbing"
            : isZoomed
              ? "cursor-grab"
              : "cursor-zoom-in")
        }
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={previewUrl(filePath)}
          alt=""
          draggable={false}
          onLoad={handleImageLoad}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: zoom === 1 && pan.x === 0 && pan.y === 0
              ? undefined
              : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border/50 p-1 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={zoomOutBtn}
        >
          <ZoomOut className="size-3.5" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground w-12 text-center tabular-nums">
          {percentage}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={zoomInBtn}
        >
          <ZoomIn className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={fitToView}
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
