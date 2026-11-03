import { getViewportForBounds, type Rect, type Viewport } from "@xyflow/react";

export const GRAPH_MIN_ZOOM = 0.01;
export const GRAPH_FIT_PADDING = 0.12;
type Size = { width: number; height: number };

export function automaticGraphViewport(bounds: Rect, focus: Rect, size: Size, screenWidth: number): Viewport {
  const fitted = getViewportForBounds(bounds, size.width, size.height, GRAPH_MIN_ZOOM, 1, GRAPH_FIT_PADDING);
  // Small screens favour readable, tappable people over a miniature overview.
  const readableZoom = screenWidth <= 640 ? 1 : screenWidth <= 1024 ? 0.85 : GRAPH_MIN_ZOOM;
  if (fitted.zoom >= readableZoom) return fitted;
  return {
    x: size.width / 2 - (focus.x + focus.width / 2) * readableZoom,
    y: size.height / 2 - (focus.y + focus.height / 2) * readableZoom,
    zoom: readableZoom,
  };
}

export function resizedGraphViewport(current: Viewport, previous: Size, next: Size, focus: Rect): Viewport {
  let x = current.x + (next.width - previous.width) / 2;
  let y = current.y + (next.height - previous.height) / 2;
  const { zoom } = current;
  // Preserve the user's framing, bringing the selected person back if resizing hides them.
  if (focus.x * zoom + x < 24 || (focus.x + focus.width) * zoom + x > next.width - 24) {
    x = next.width / 2 - (focus.x + focus.width / 2) * zoom;
  }
  if (focus.y * zoom + y < 24 || (focus.y + focus.height) * zoom + y > next.height - 24) {
    y = next.height / 2 - (focus.y + focus.height / 2) * zoom;
  }
  return { x, y, zoom };
}
