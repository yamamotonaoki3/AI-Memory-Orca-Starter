import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./dev-memory.sqlite" },
});
// 開発環境専用の設定例。本番DBの変更には利用者の承認が必要。
// 変更前にオフラインバックアップを取得し、隔離環境で復元を検証する。
// 本番環境でのdrizzle-kit pushや、サーバー起動時の自動マイグレーションは禁止する。
