import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initNativeStatusBar } from "./lib/native-status-bar";
import { initNativeShell, markNativeDocument } from "./lib/native-shell";
import { initPwaInstallCapture, registerStorePwa } from "@/lib/pwa";

// Apply native CSS classes before React paints (avoids web-chrome flash).
markNativeDocument();
void initNativeStatusBar();
void initNativeShell();
initPwaInstallCapture();
void registerStorePwa();
// Mapbox token is fetched on demand by useMapboxToken — do not warm it on boot
// so customer home stays free of the 1.7MB mapbox-gl chunk.

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
