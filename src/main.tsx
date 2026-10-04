import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadFamily } from "./data/load";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
try {
  const family = loadFamily();
  root.render(
    <React.StrictMode>
      <App family={family} />
    </React.StrictMode>,
  );
} catch (error) {
  root.render(
    <main className="data-error">
      <h1>The family records need attention</h1>
      <p>
        Fix the following issues in the JSON data, then rebuild or restart the
        app.
      </p>
      <pre role="alert">
        {error instanceof Error ? error.message : String(error)}
      </pre>
    </main>,
  );
}
