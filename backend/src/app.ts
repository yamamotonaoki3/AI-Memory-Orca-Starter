import { Hono } from "hono";
import { healthRoutes } from "./routes/health";

// 業務処理やデータアクセスをルートに直接書かない。
export function createApp() {
  const app = new Hono();

  // 認証が完成するまで、機密情報を扱うエンドポイントを公開しない。
  app.route("/api", healthRoutes);
  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  return app;
}
