import { serve } from "@hono/node-server";
import { createApp } from "./app";

// 既定では127.0.0.1だけで待ち受け、外部ネットワークに公開しない。
const port = Number(process.env.AI_MEMORY_API_PORT ?? "8787");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("APIポートは1024〜65535の整数にしてください。");
}
serve({ fetch: createApp().fetch, hostname: "127.0.0.1", port });
console.log("AI-Memory APIがローカルで起動しました。ポート: " + port);
