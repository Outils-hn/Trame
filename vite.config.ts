// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Publication sur GitHub Pages : le workflow « Pages » definit PAGES_BASE=/Trame/ (et NITRO_PRESET=static).
// Sans cette variable (dev, Tests, Captures, Lovable), l'appli reste servie a la racine « / ».
const base = process.env.PAGES_BASE ?? "/";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Mode SPA : aucune fonction serveur n'est utilisee (donnees en localStorage uniquement).
    // Le build produit une page « coque » (_shell.html) que l'appli complete dans le navigateur.
    spa: { enabled: true },
  },
  vite: { base },
});
