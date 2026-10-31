import { Hono } from "hono";

// HTTPルートは受付とレスポンスの生成に限定する。
export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) =>
  c.json({ status: "ok", service: "ai-memory-api" }),
);
