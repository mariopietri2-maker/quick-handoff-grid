/* s-tier-push-2026-10-04 */
/* phase4-ops-2026-10-04 */
/* phase1-s-tier-2026-10-04 */
/* p0-p1-p2-2026-10-04 */
/* ops-assistant-visible-2026-10-03b */
/* build: 2026-09-30-order-ui */
// deploy-stamp: menu-editor-custom-1790691784
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initNativeStatusBar } from "./lib/native-status-bar";
import { initNativeShell, markNativeDocument } from "./lib/native-shell";
import { initPwaInstallCapture, registerStorePwa } from "@/lib/pwa";

// Apply native CSS classes before React paints (avoids web-chrome flash).
// redeploy-20260929-uber-eats-home
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
