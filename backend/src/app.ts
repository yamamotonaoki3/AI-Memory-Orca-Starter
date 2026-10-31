import { Hono } from "hono";

// 認証が完成するまで、機密情報を扱うエンドポイントを公開しない。
export function createApp() {
  const app = new Hono();
  app.get("/api/health", (c) =>
    c.json({ status: "ok", service: "ai-memory-api" }),
  );
  app.notFound((c) => c.json({ error: "Not Found" }, 404));
  return app;
}
