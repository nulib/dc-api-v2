import { defineConfig } from "vitest/config";

export default defineConfig(() => {
  return {
    define: {
      "process.env": process.env
    },
    test: {
      globals: true,
      environment: "node",
      include: ["test/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      setupFiles: ["./test/support/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["apps/mcp/**/*.ts"],
        exclude: [
          "test/**",
          "apps/mcp/**/*.d.ts",
          "apps/mcp/handlers/*.ts",
          "apps/mcp/vite.config.ts"
        ]
      },
      // Increase timeout for integration tests that may hit real APIs in record mode
      testTimeout: 10000
    }
  };
});
