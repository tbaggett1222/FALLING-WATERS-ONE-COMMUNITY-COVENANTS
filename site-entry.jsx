import React from "react";
import { createRoot } from "react-dom/client";
import App from "./falling-waters-portal.jsx";

const rootElement = document.getElementById("root");

function showBootstrapError(message, details) {
  if (!rootElement) return;
  const safeMessage = String(message || "Unknown startup error.");
  const safeDetails = details ? String(details) : "";
  rootElement.innerHTML = [
    '<div style="max-width:760px;margin:40px auto;padding:18px 20px;border:1px solid #ef4444;border-radius:8px;background:#fef2f2;color:#7f1d1d;font-family:system-ui,sans-serif;line-height:1.55;">',
    "<strong>Portal startup error</strong>",
    `<div style="margin-top:8px;">${safeMessage}</div>`,
    safeDetails
      ? `<pre style="white-space:pre-wrap;margin-top:10px;padding:10px;border-radius:6px;background:#fff;font-size:12px;color:#7f1d1d;">${safeDetails}</pre>`
      : "",
    "</div>",
  ].join("");
}

if (rootElement) {
  window.addEventListener("error", (event) => {
    showBootstrapError("A JavaScript error prevented the site from rendering.", event?.error?.stack || event?.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason?.stack || event?.reason?.message || String(event?.reason || "Unknown rejection");
    showBootstrapError("An unhandled promise rejection prevented the site from rendering.", reason);
  });

  try {
    createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    setTimeout(() => {
      if (!rootElement.firstChild) {
        showBootstrapError(
          "The app did not mount. Try hard refresh or clear cached files.",
          "If this persists, share this message so we can diagnose browser compatibility."
        );
      }
    }, 2000);
  } catch (error) {
    showBootstrapError("React failed while mounting the app.", error?.stack || String(error));
  }
}
