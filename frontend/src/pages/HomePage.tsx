import { HealthStatus } from "../features/health/HealthStatus";

// ページは画面構成を担当する。API通信や状態の管理は機能側に任せる。
export function HomePage() {
  return (
    <main className="page">
      <div className="panel">
        <p className="eyebrow">AI-MEMORY / M1</p>
        <h1>ローカルAI長期記憶システム</h1>
        <p>現在は開発基盤の動作確認画面です。会話データの登録や閲覧はできません。</p>
        <HealthStatus />
        <p className="warning">
          認証と機密検査が完成するまで、個人情報や実際の会話記録を登録しないでください。
        </p>
      </div>
    </main>
  );
}
