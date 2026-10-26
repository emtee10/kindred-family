import { useEffect, useRef, useState } from "react";
import { Controls } from "@xyflow/react";

/** Fullscreen the whole graph section so its heading and legend stay available. */
export function GraphControls() {
  const button = useRef<HTMLButtonElement>(null);
  const [supported, setSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const section = button.current?.closest(".graph-section");
    setSupported(Boolean(document.fullscreenEnabled && section?.requestFullscreen));
    let wasFullscreen = false;
    const sync = () => {
      const active = document.fullscreenElement === section;
      setFullscreen(active);
      setError("");
      if (wasFullscreen && !active) button.current?.focus({ preventScroll: true });
      wasFullscreen = active;
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    const section = button.current?.closest<HTMLElement>(".graph-section");
    if (!section || pending) return;
    setPending(true);
    setError("");
    try {
      if (document.fullscreenElement === section) await document.exitFullscreen();
      else await section.requestFullscreen();
    } catch {
      setError("Full screen could not be changed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const label = fullscreen ? "Exit Full Screen" : "Enter Full Screen";
  return <>
    <Controls showInteractive={false}>
      <button ref={button} type="button" className="react-flow__controls-button" onClick={toggleFullscreen}
        disabled={!supported} aria-disabled={!supported || pending} aria-busy={pending}
        aria-label={label} aria-pressed={fullscreen}
        title={supported ? `${label}${fullscreen ? " (Esc)" : ""}` : "Full screen is unavailable in this browser"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path fill="none" d={fullscreen
            ? "M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6"
            : "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"} />
        </svg>
      </button>
    </Controls>
    {error && <div className="graph-control-error" role="alert">{error}</div>}
  </>;
}
