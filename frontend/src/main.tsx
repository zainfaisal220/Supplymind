import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ReducedMotionProvider } from "@/contexts/ReducedMotionContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ReducedMotionProvider>
    <App />
  </ReducedMotionProvider>,
)
