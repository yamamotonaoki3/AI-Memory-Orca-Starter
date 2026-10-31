import { useEffect, useState } from "react";
import { checkHealth } from "../../services/health-api";

export type HealthState = "確認中" | "接続成功" | "接続失敗";

// 画面の生存期間に合わせてAPIを確認し、終了時は未完了の通信を中断する。
export function useHealthStatus(): HealthState {
  const [health, setHealth] = useState<HealthState>("確認中");

  useEffect(() => {
    const controller = new AbortController();
    async function verifyConnection() {
      try {
        await checkHealth(controller.signal);
        if (!controller.signal.aborted) setHealth("接続成功");
      } catch {
        // 接続エラーは成功扱いせず、利用者に失敗状態を表示する。
        if (!controller.signal.aborted) setHealth("接続失敗");
      }
    }
    void verifyConnection();
    return () => controller.abort();
  }, []);

  return health;
}
