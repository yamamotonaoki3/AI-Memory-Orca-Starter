import { defineConfig } from "drizzle-kit";

// 設計書のschema.tsを当面の正本として使用する。DBへの適用は別途レビューする。
export default defineConfig({
  dialect: "sqlite",
  schema: "./docs/database/schema.ts",
  out: "./migrations",
  dbCredentials: { url: "./runtime/dev-memory.sqlite" },
});
