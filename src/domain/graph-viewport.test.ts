import { describe, expect, it } from "vitest";
import { automaticGraphViewport, resizedGraphViewport } from "./graph-viewport";

const focus = { x: 300, y: 400, width: 190, height: 95 };
const large = { x: -1000, y: -1000, width: 5000, height: 4000 };

describe("automatic graph framing", () => {
  it("fits all people on desktop", () => {
    const size = { width: 900, height: 565 };
    const viewport = automaticGraphViewport(large, focus, size, 1440);
    expect(viewport.zoom).toBeLessThan(0.85);
    expect(large.x * viewport.zoom + viewport.x).toBeGreaterThan(0);
    expect(large.y * viewport.zoom + viewport.y).toBeGreaterThan(0);
    expect((large.x + large.width) * viewport.zoom + viewport.x).toBeLessThan(size.width);
    expect((large.y + large.height) * viewport.zoom + viewport.y).toBeLessThan(size.height);
  });

  it.each([[390, 1], [768, 0.85], [1024, 0.85]])(
    "keeps the selected person readable on a %spx screen", (screenWidth, zoom) => {
      const size = { width: screenWidth - 40, height: 455 };
      const viewport = automaticGraphViewport(large, focus, size, screenWidth);
      expect(viewport.zoom).toBe(zoom);
      expect((focus.x + focus.width / 2) * zoom + viewport.x).toBeCloseTo(size.width / 2);
      expect((focus.y + focus.height / 2) * zoom + viewport.y).toBeCloseTo(size.height / 2);
    },
  );

  it("fits a small graph on mobile without enlarging cards", () => {
    const size = { width: 390, height: 455 };
    const viewport = automaticGraphViewport(focus, focus, size, 390);
    expect(viewport.zoom).toBe(1);
    expect(focus.x * viewport.zoom + viewport.x).toBeGreaterThan(0);
    expect((focus.x + focus.width) * viewport.zoom + viewport.x).toBeLessThan(size.width);
  });

  it("preserves manual zoom and the graph centre when expanding the canvas", () => {
    const viewport = resizedGraphViewport({ x: -200, y: -200, zoom: 1 },
      { width: 500, height: 500 }, { width: 900, height: 700 }, focus);
    expect(viewport).toEqual({ x: 0, y: -100, zoom: 1 });
  });

  it("keeps the selected person visible after rotation to a narrow canvas", () => {
    const size = { width: 390, height: 455 };
    const viewport = resizedGraphViewport({ x: -800, y: -900, zoom: 1.4 },
      { width: 1100, height: 800 }, size, focus);
    expect(viewport.zoom).toBe(1.4);
    expect((focus.x + focus.width / 2) * viewport.zoom + viewport.x).toBeCloseTo(size.width / 2);
    expect((focus.y + focus.height / 2) * viewport.zoom + viewport.y).toBeCloseTo(size.height / 2);
  });
});
