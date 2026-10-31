# AI-Memoryのディレクトリ構成

フロントエンドとバックエンドを物理的に分け、スタイルも専用フォルダで管理します。

```text
AI-Memory-Orca-Starter/
├─ frontend/                 React / Vite
│  ├─ index.html
│  ├─ vite.config.ts
│  └─ src/
│     ├─ App.tsx
│     ├─ main.tsx
│     ├─ pages/HomePage.tsx
│     ├─ features/health/       機能・状態管理
│     ├─ services/health-api.ts API通信と応答検証
│     └─ styles/
│        ├─ global.css       共通の初期設定・ベーススタイル
│        └─ app.css          開発用画面に固有のスタイル
├─ backend/                  Hono API
│  └─ src/
│     ├─ app.ts
│     ├─ app.test.ts
│     ├─ routes/health.ts
│     └─ server.ts
├─ worker/                   非同期処理（現段階は起動口だけ）
│  └─ src/index.ts
├─ packages/db/              Drizzleの共有スキーマ参照
├─ docs/                     設計書・運用手順
├─ scripts/                  開発・検証スクリプト
├─ package.json              依存関係・コマンドの一元管理
└─ tsconfig.json             TypeScript設定
```

## 配置規則

- **frontend**：`pages/`はページ構成、`features/`は機能固有の状態とUI、`services/`はHTTP通信に分離する。SQLite・機密原本には直接アクセスしません。
- **backend**：`routes/`はHTTP受付のみ。業務処理が増えたら`services/`、DB操作が必要になったら`repositories/`を追加します。将来の認証・入力検証・認可処理もここで実施します。
- **worker**：将来の非同期ジョブ処理用です。実データ処理は現時点ではありません。
- **styles/global.css**：フォント、背景色、ボックスサイズなど全体共通の設定。
- **styles/app.css**：画面レイアウト・カード・ステータス表示など、その画面のスタイル。
- **packages/db**：共有スキーマの入口であり、マイグレーションや本番DBの自動変更は行いません。

CSSは用途で分け、コンポーネントが増えたら必要に応じてファイルを追加します。インラインCSSを全面禁止するなど、未確認の社内ルールは導入していません。

## Windows 11での実行

```powershell
npm install
npm run typecheck
npm test
npm run build:web
```

2つのPowerShellでそれぞれ起動します。

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

従来と同じコマンドで`http://127.0.0.1:5173/`から開けます。

## 共通仕様の取り込み状況

「harness-public」という別プロジェクトのルールは、このリポジトリや接続済みの共有ソースからは確認できていません。現時点でその規約に準拠したとは主張しません。

共通規約の文書（例：AGENTS.md、CONTRIBUTING.md、Lint/Formatter設定、アーキテクチャ規約）を入手した後、既存のAI-Memoryのセキュリティ・保存要件と衝突しないことを検証して、別PRで反映します。個人情報や認証秘密を含む設定の共有は不要です。

## 参照したハーネス共通仕様

- [フロントエンド C-06](https://github.com/ysteam0117/harness/blob/main/docs/requirements/common/frontend.md#c-06)：ページ・機能・API通信の責務を分割
- [バックエンド C-03](https://github.com/ysteam0117/harness/blob/main/docs/requirements/common/backend.md#c-03)：Controller・Service・Repositoryの責務を分割
- [設計原則 C-38](https://github.com/ysteam0117/harness/blob/main/docs/requirements/common/design-principles.md#c-38)：必要最小限の構成を選択

未対応と例外は`docs/harness-adoption.md`を参照してください。
