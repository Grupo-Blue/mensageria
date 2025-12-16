import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

// Compatibilidade com Node.js 18 (import.meta.dirname só está disponível no Node.js 20.11.0+)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname),
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
