# AI-Memory — ローカルAI長期記憶システム

**状況: M1設計ドラフト / 未実装。本番データを投入しないこと。**

Windows 11 + Orca で開発し、GitHub の **Private** リポジトリでソースコード・設計書・合成テストのみを管理するプロジェクトです。
確定した条件定義書は **v8.8 / Q1〜Q86**。原文・原音声・元文書・全原本版・訂正履歴は**原則無期限保存**です。

## このZIPに含まれるもの

- `docs/database/`: 前回作成したM1 DB設計ファイル8点をそのまま収録（設計書、ER図、Drizzle案、SQL、スモークテスト）。
- `docs/requirements/`: v8.8が正式な要件ベースラインであることと、実装時の注意事項。
- `docs/ORCA_SETUP.md`: Windows 11 / GitHub / Orcaセットアップ手順。
- `AGENTS.md`: OrcaのCodex・Claude Code向けリポジトリ共通指示。
- `.github/workflows/ci.yml`: GitHub Actionsの標準Linuxランナーで**合成データのみ**使う無料枠重視CI。
- `.gitignore`: 原本、DB、音声、環境変数、鍵、認証情報をGitへ追加しない保護。
- `scripts/publish-private.ps1`: 新しいPrivateリポジトリの作成とGit push（ユーザーPCで実行）。

## 初回の操作

1. このZIPを `C:\Development\AI-Memory` に展開します。**ZIP中の `AI-Memory-Orca-Starter` フォルダーの中身**がプロジェクト直下になるようにします。
2. `docs/ORCA_SETUP.md` を読み、GitHub CLIで認証してください。
3. PowerShellでプロジェクトフォルダーに移動して `./scripts/publish-private.ps1` を実行します。Private以外で作られた場合は停止します。
4. Orcaで **Add Repo** → `C:\Development\AI-Memory` を開いてください。作業ごとにworktreeを作成します。

## 最初のローカル検証

```powershell
python .\docs\database\sqlite_smoke_test.py
```

**スモークテストが通ってもDrizzleの型チェック、認証、バックアップ、復旧、Windows実機の品質ゲートは未完了です。**

## 秘密を守るための区別

**GitHubに保存する:** ソースコード、Markdown設計書、ER図、マイグレーション案、合成テスト、ワークフロー。

**GitHubに絶対に保存しない:** 実際の会話原本・原音声・文書原本、SQLite本番DB、アップロード、復旧コード、パスキー秘密、APIキー、認証トークン、`.env`、Ollamaローカルモデル、バックアップ、個人・社内機密情報。

`.gitignore`だけでは秘密を完全には守れません。コミット前に `git status` と `git diff --cached --name-only` を確認し、秘密を含むかもしれないファイルを追加しないでください。

## 現時点の注意

- `docs/database/schema.ts` は**検証前のDrizzle設計案**であり、直ちにデータベース生成できると保証していません。
- `docs/database/drizzle.config.ts` は開発用例です。起動時の自動マイグレーションや本番DBでの `drizzle-kit push` を禁止します。
- v8.8条件定義書の詳細全文は**このチャットで確定済みの文書が正本**です。本ZIPには概要・参照を含み、全文の機械的な書き出しを保証していません。正式な全文ファイルを取得したら `docs/requirements/` に版を固定して保存してください。
