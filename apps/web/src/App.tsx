import { useEffect, useState } from "react";

type HealthState = "確認中" | "接続成功" | "接続失敗";

export function App() {
  const [health, setHealth] = useState<HealthState>("確認中");

  useEffect(() => {
    const controller = new AbortController();
    async function checkHealth() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("APIの応答が正常ではありません。");
        setHealth("接続成功");
      } catch {
        if (!controller.signal.aborted) setHealth("接続失敗");
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <div className="panel">
        <p className="eyebrow">AI-MEMORY / M1</p>
        <h1>ローカルAI長期記憶システム</h1>
        <p>現在は開発基盤の動作確認画面です。会話データの登録や閲覧はできません。</p>
        <div className="status" role="status" aria-live="polite">
          <span>APIへの接続：</span>
          <strong>{health}</strong>
        </div>
        <p className="warning">認証と機密検査が完成するまで、個人情報や実際の会話記録を登録しないでください。</p>
      </div>
    </main>
  );
}
