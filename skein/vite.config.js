import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app runs at any subpath of the Pages site
// (…/ClusterApplet/skein/), matching the sibling bps/ applet.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
