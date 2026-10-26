import { useEffect, useRef } from "react";
import { useNodesInitialized, useReactFlow, useStore, type Viewport } from "@xyflow/react";
import { automaticGraphViewport, resizedGraphViewport } from "../domain/graph-viewport";

const sameViewport = (a: Viewport, b: Viewport) =>
  Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.001;

/** Apply framing only after a new layout is measured, or when the canvas changes size. */
export function GraphViewport({ layout, focusId, enabled = true }: {
  layout: object; focusId: string; enabled?: boolean;
}) {
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const flow = useReactFlow();
  const previous = useRef<{
    layout: object; width: number; height: number; viewport: Viewport; automatic: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !initialized || width <= 0 || height <= 0) return;
    // React Flow updates its node store in effects; read it after those updates settle.
    const frame = requestAnimationFrame(() => {
      const last = previous.current;
      const changed = !last || last.layout !== layout;
      if (!changed && last.width === width && last.height === height) return;
      const nodes = flow.getNodes();
      if (!nodes.length) return;
      const focus = nodes.find((node) => node.id === focusId) ?? nodes[0];
      // IDs use React Flow's measured internal nodes, including in controlled graphs.
      const bounds = flow.getNodesBounds(nodes.map((node) => node.id));
      const focusBounds = flow.getNodesBounds([focus.id]);
      const current = flow.getViewport();
      const automatic = changed || (last.automatic && sameViewport(current, last.viewport));
      // A phone or tablet stays readable when rotated into a wide landscape viewport.
      const screenWidth = window.matchMedia("(pointer: coarse)").matches
        ? Math.min(window.innerWidth, window.innerHeight) : window.innerWidth;
      const viewport = automatic
        ? automaticGraphViewport(bounds, focusBounds, { width, height }, screenWidth)
        : resizedGraphViewport(current, last, { width, height }, focusBounds);
      previous.current = { layout, width, height, viewport, automatic };
      const animate = changed && last && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      void flow.setViewport(viewport, { duration: animate ? 220 : 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, initialized, width, height, layout, focusId, flow]);

  return null;
}
