# AI-Memory — ローカルAI長期記憶システム

**状況: MVP 1の開発基盤を構築済み。原本保存・認証は未実装のため、実データを投入しないこと。**

Windows 11 + Orca で開発し、GitHub の **Public** リポジトリ（**MIT License**）でソースコード・設計書・合成テストのみを管理するプロジェクトです。
確定した条件定義書は **v8.8 / Q1〜Q86**。原文・原音声・元文書・全原本版・訂正履歴は**原則無期限保存**です。

## アプリケーションのフォルダ構成

- `frontend/`：React + Viteの画面。`src/styles/`でCSSを共通設定と画面固有に分割。
- `backend/`：Hono + TypeScriptのAPIと単体テスト。
- `worker/`：独立した非同期処理の起動口（実処理は未実装）。
- `packages/db/`：Drizzle ORMのスキーマ共有用エントリーポイント。
- `docs/development/PROJECT_STRUCTURE.md`：責務・配置ルール・起動手順。

今回の分割には[ハーネス共通仕様](https://github.com/ysteam0117/harness)の責務分離を参考にしています。対応状況と未対応ルールは[採用一覧](docs/harness-adoption.md)に記録しました。

`package.json`は当面リポジトリ直下で共通管理します。既存の`npm run dev:api`と`npm run dev:web`は変更せず利用できます。

## このリポジトリに含まれるもの

- `docs/database/`: 前回作成したM1 DB設計ファイル8点をそのまま収録（設計書、ER図、Drizzle案、SQL、スモークテスト）。
- `docs/requirements/`: v8.8が正式な要件ベースラインであることと、実装時の注意事項。
- `docs/ORCA_SETUP.md`: Windows 11 / GitHub / Orcaセットアップ手順。
- `AGENTS.md`: OrcaのCodex・Claude Code向けリポジトリ共通指示。
- `.github/workflows/ci.yml`: GitHub Actionsの標準Linuxランナーで**合成データのみ**使う無料枠重視CI。
- `.gitignore`: 原本、DB、音声、環境変数、鍵、認証情報をGitへ追加しない保護。
- `LICENSE`: MITライセンス。
- `scripts/publish-private.ps1`: 初期Private作成用の旧スクリプト。**既存リポジトリでは再実行しないこと。**

## ローカル開発

1. GitHubから既存リポジトリを `C:\Development\AI-Memory` などのローカルフォルダへcloneする（すでに取得済みなら再clone不要）。
2. `docs/ORCA_SETUP.md` を参照し、Orcaの **Add Repo** でローカルリポジトリを登録する。
3. 実装変更は`feature/*`ブランチへコミットし、PRでレビューする。
4. GitHub上の更新をローカルへ反映するには、作業ブランチの差分を保存・確認してから`git fetch` / `git pull`する。

## 最初のローカル検証

```powershell
python .\docs\database\sqlite_smoke_test.py
```

**GitHub ActionsでTypeScript・Drizzleの型チェックと合成テストは確認済みですが、認証、原本保存、バックアップ、復旧の安全性は未確認です。**

## 秘密を守るための区別

**GitHubに保存する:** ソースコード、Markdown設計書、ER図、マイグレーション案、合成テスト、ワークフロー。

**GitHubに絶対に保存しない:** 実際の会話原本・原音声・文書原本、SQLite本番DB、アップロード、復旧コード、パスキー秘密、APIキー、認証トークン、`.env`、Ollamaローカルモデル、バックアップ、個人・社内機密情報。

`.gitignore`だけでは秘密を完全には守れません。コミット前に `git status` と `git diff --cached --name-only` を確認し、秘密を含むかもしれないファイルを追加しないでください。

## 現時点の注意

- `docs/database/schema.ts` は**検証前のDrizzle設計案**であり、直ちにデータベース生成できると保証していません。
- `docs/database/drizzle.config.ts` は開発用例です。起動時の自動マイグレーションや本番DBでの `drizzle-kit push` を禁止します。
- v8.8条件定義書の詳細全文は**このチャットで確定済みの文書が正本**です。現在は概要・参照のみで、全文の機械的な書き出しを保証していません。GitHub公開用に個人情報等を確認した正式全文を`docs/requirements/`に版固定して保存してください。

## ライセンス

ソースコードと同梱するドキュメントは、別途明記がない限り[MIT License](LICENSE)で提供します。著作権表示とライセンス文の保持が必要です。

**公開による注意:** MITは第三者の改変・再配布・商用利用を許可します。学習利用だけを制限する条件はありません。開発用の合成データのみをGitHubへアップロードし、個人の原本・社内データ・機密設定はWindowsローカルに隔離してください。Public化後は過去のコミットとActionsログも第三者から閲覧できます。

GitHub ActionsのPublic標準ランナーは無料ですが、アカウントに決済エラー由来の制限がある場合は実行できないことがあります。CIが起動しない場合はローカルテストを続け、請求状態を確認してください。
