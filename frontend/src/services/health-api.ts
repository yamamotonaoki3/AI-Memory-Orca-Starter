interface HealthResponse {
  status: "ok";
  service: "ai-memory-api";
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  return (
    "status" in value &&
    value.status === "ok" &&
    "service" in value &&
    value.service === "ai-memory-api"
  );
}

// サーバーの応答はTypeScriptの型だけで信用せず、実際の値を検証する。
export async function checkHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch("/api/health", {
    signal,
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("APIの応答ステータスが正常ではありません。");
  }
  const body: unknown = await response.json();
  if (!isHealthResponse(body)) {
    throw new Error("APIの応答形式が期待と異なります。");
  }
}
