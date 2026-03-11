// VIRTUAL MARK - A virtual assistant for Microsoft 365

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

//import Offline from "./Offline";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
