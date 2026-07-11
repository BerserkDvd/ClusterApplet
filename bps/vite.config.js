import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app runs at any subpath of the KAlgebra Pages
// site (e.g. /KAlgebra/bps/) or the ClusterApplet testbed, without a hard
// dependency on a fixed deploy path.  See Plan 39 decisions.md (D2/D8).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
