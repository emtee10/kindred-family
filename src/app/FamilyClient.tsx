"use client";
import { useEffect, useState } from "react";
import App from "../App";
import { Genealogy } from "../domain/genealogy";
import { validateFamily } from "../domain/validation";
import type { ArchiveConfig, ArchiveData } from "../data/types";
export function FamilyClient() {
  const [archive, setArchive] = useState<{ family: Genealogy; config: ArchiveConfig } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/family-data", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.replace("/login"); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load the archive.");
        const records = data as ArchiveData;
        setArchive({ family: new Genealogy(validateFamily(records.people, records.relationships)), config: records.config });
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load the archive.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  if (error) return <main className="data-error"><h1>The family records need attention</h1><p>Fix the JSON records, then restart or redeploy the app.</p><pre role="alert">{error}</pre></main>;
  if (!archive) return <main className="data-error" role="status">Loading the family archive…</main>;
  return <App {...archive} />;
}
