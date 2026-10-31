# AI-Memory — ローカルAI長期記憶システム

**状況: M1設計ドラフト / 未実装。本番データを投入しないこと。**

Windows 11 + Orca で開発し、GitHub の **Public** リポジトリ（**MIT License**）でソースコード・設計書・合成テストのみを管理するプロジェクトです。
確定した条件定義書は **v8.8 / Q1〜Q86**。原文・原音声・元文書・全原本版・訂正履歴は**原則無期限保存**です。

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

**スモークテストが通ってもDrizzleの型チェック、認証、バックアップ、復旧、Windows実機の品質ゲートは未完了です。**

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
