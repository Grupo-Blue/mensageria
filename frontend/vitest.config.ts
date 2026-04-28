import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

// Compatibilidade com Node.js 18 (import.meta.dirname só está disponível no Node.js 20.11.0+)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
