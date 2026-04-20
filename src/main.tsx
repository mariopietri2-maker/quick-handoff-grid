import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeStatusBar } from "./lib/native-status-bar";

void initNativeStatusBar();

createRoot(document.getElementById("root")!).render(<App />);
