import { useEffect, useRef, useState } from "react";
import { ControlButton, Controls, useReactFlow } from "@xyflow/react";

/** Fullscreen the whole graph section so its heading and legend stay available. */
export function GraphControls() {
  const { fitView } = useReactFlow();
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
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton className="react-flow__controls-fitview" onClick={() => { void fitView(); }}
        aria-label="Fit View" title="Fit View">
        <svg className="graph-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="1.5" />
          <path d="m8 9 4 6 4-6" />
          <g fill="currentColor" stroke="none">
            <circle cx="8" cy="9" r="1.75" />
            <circle cx="16" cy="9" r="1.75" />
            <circle cx="12" cy="15" r="1.75" />
          </g>
        </svg>
      </ControlButton>
      <button ref={button} type="button" className="react-flow__controls-button" onClick={toggleFullscreen}
        disabled={!supported} aria-disabled={!supported || pending} aria-busy={pending}
        aria-label={label} aria-pressed={fullscreen}
        title={supported ? `${label}${fullscreen ? " (Esc)" : ""}` : "Full screen is unavailable in this browser"}>
        <svg className="graph-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path fill="none" d={fullscreen
            ? "M21 3l-7 7m0-6v6h6M3 21l7-7m-6 0h6v6"
            : "M14 3h7v7m0-7-7 7M10 21H3v-7m0 7 7-7"} />
        </svg>
      </button>
    </Controls>
    {error && <div className="graph-control-error" role="alert">{error}</div>}
  </>;
}
