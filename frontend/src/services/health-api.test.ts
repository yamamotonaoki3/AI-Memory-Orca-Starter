import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health-api";

afterEach(() => vi.unstubAllGlobals());

describe("API接続確認の応答検証", () => {
  const signal = new AbortController().signal;

  it("正常なJSONだけを接続成功として扱う", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      service: "ai-memory-api",
    }), { status: 200 }));
    vi.stubGlobal("fetch", mock);

    await expect(checkHealth(signal)).resolves.toBeUndefined();
    expect(mock).toHaveBeenCalledWith("/api/health", {
      signal,
      credentials: "same-origin",
    });
  });

  it("HTTPエラーを成功扱いしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(checkHealth(signal)).rejects.toThrow("応答ステータス");
  });

  it("想定外のJSONを成功扱いしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      service: "untrusted-service",
    }), { status: 200 })));
    await expect(checkHealth(signal)).rejects.toThrow("応答形式");
  });
});
