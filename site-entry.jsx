import React from "react";
import { createRoot } from "react-dom/client";
import App from "./falling-waters-portal.jsx";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
