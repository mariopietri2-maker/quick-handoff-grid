import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initNativeStatusBar } from "./lib/native-status-bar";

void initNativeStatusBar();
// Mapbox token is fetched on demand by useMapboxToken — do not warm it on boot
// so customer home stays free of the 1.7MB mapbox-gl chunk.

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
