import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./dev-memory.sqlite" },
});
// DEVELOPMENT ONLY. Production migrations require human approval,
// offline backup + isolated restore validation. Do not run push or migrate on server boot.
