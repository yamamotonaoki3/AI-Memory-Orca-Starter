# MVP 1 — 開発基盤（初期段階）

このPRはMVP全体の完成ではありません。Windows 11上でアプリを開発・検証するための基盤です。

## 構成

- `apps/api/`：Hono + TypeScriptのローカルAPI（現在はヘルスチェックのみ）。
- `apps/web/`：Vite + Reactの開発用画面（状態表示のみ）。
- `apps/worker/`：独立Workerの起動口（ジョブ処理は未実装）。
- `packages/db/`：Drizzle ORMスキーマの参照口。
- `docs/database/schema.ts`：27テーブルの検証前スキーマ案。
- `scripts/verify-migrations.mjs`：生成SQLを空のメモリDBに適用して整合性を検証。

## Windowsでの確認

Node.js 24を使用してください。既存のOrcaローカルリポジトリに未コミットの変更があれば、先に保存してから最新のmainを取得してください。

```powershell
git switch main
git pull --ff-only origin main
npm install
npm run typecheck
npm test
npm run build:web
npm run db:generate
npm run db:verify
python .\docs\database\sqlite_smoke_test.py
```

PowerShellを2つ開いてAPIと画面を起動します。

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

ブラウザで`http://127.0.0.1:5173/`を開いてAPIの接続状態を確認します。
APIは`http://127.0.0.1:8787/api/health`で応答します。

## DBマイグレーションの制限

`npm run db:generate`はマイグレーションSQLを生成するだけで、実際のデータベースへ適用しません。
`npm run db:verify`は空の**メモリDB**でSQLとFTS5・保護トリガーの整合性を検証します。
本番DBへの自動適用や`drizzle-kit push`は禁止します。生成したSQLとスナップショットはレビュー後にGitへ登録してください。

## 未実装と残課題

- WebAuthn認証、原本保存、API認可、機密検査、検索、バックアップは未実装です。
- Web画面は開発用の接続確認だけであり、会話本文を受け付けません。
- 本番SQLite、会話原本、音声、秘密情報はGitHubへ登録しません。
- 今回のPRは依存関係のロックファイルをまだ含んでいません。CIで依存解決を検証した後、`package-lock.json`をコミットし、`npm ci`に切り替える必要があります。
- 合成データだけでテストしてください。
