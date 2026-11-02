"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.dataset.theme === "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDark(next === "dark");
    try { localStorage.setItem("kindred-theme", next); } catch { /* Browsing without storage still allows switching themes. */ }
  }

  return <button className="theme-toggle" type="button" onClick={toggle}
    aria-label={`Switch to ${dark ? "light" : "dark"} mode`} aria-pressed={dark} title={`Switch to ${dark ? "light" : "dark"} mode`}>
    <Icon name={dark ? "sun" : "moon"} size={18} />
    <span>{dark ? "Light" : "Dark"} mode</span>
  </button>;
}
