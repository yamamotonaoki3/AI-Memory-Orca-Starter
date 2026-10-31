import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("APIの基本動作", () => {
  const app = createApp();

  it("ヘルスチェックで200と定型JSONを返す", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "ai-memory-api",
    });
  });

  it("未実装のAPIを公開せず404を返す", async () => {
    const response = await app.request("/api/records");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });
});
