import { useHealthStatus } from "./useHealthStatus";

// 通信の進行状態はHookへ分離し、このコンポーネントは表示だけを担当する。
export function HealthStatus() {
  const health = useHealthStatus();
  return (
    <div className="status" role="status" aria-live="polite">
      <span>APIへの接続：</span>
      <strong>{health}</strong>
    </div>
  );
}
