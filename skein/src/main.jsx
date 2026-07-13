import React from "react";
import { createRoot } from "react-dom/client";
import SkeinApp from "./SkeinApp.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SkeinApp />
  </React.StrictMode>
);
