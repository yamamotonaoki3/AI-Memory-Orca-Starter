# Windows 11 / GitHub Private / Orca セットアップ

## 1. PC内にファイルを永続保存

ZIPをダウンロードして展開後、**ZIP内 `AI-Memory-Orca-Starter` の中身**を `C:\Development\AI-Memory` に配置してください。

```powershell
New-Item -ItemType Directory -Force C:\Development\AI-Memory
# 展開したAI-Memory-Orca-Starter配下のファイルをこのフォルダに移動/コピー
Set-Location C:\Development\AI-Memory
Get-ChildItem -Force
python .\docs\database\sqlite_smoke_test.py
```

このチャットからPCのCドライブへ直接書き込んだわけではありません。PCで展開する操作が必要です。

## 2. GitHub CLIを用意

Gitが入っているか: `git --version`。GitHub CLIは `gh --version` で確認します。
未導入ならWindowsのwinget等で `GitHub.cli` をインストールし、新しいPowerShellを開いてください。

```powershell
winget install --id GitHub.cli --exact
# すでにある場合はインストール不要
gh auth login
# GitHub.com / HTTPS / ブラウザ認証などを選択
gh auth status
```

**GitHubのトークン・パスワードをChatGPTやリポジトリ内に貼り付けないでください。**

## 3. Privateリポジトリを作成して初回push

プロジェクト直下で、用意したスクリプトを内容確認後に実行してください。

```powershell
Set-Location C:\Development\AI-Memory
.\scripts\publish-private.ps1
```

スクリプトは**新規の `AI-Memory` リポジトリ**をGitHub上へPrivateで作成し、初期コミットをpushします。既存の `.git` や `origin` がある場合は誤上書き防止のため停止します。

Windows PowerShellの実行ポリシーで拒否される場合は、ファイルを確認した上で、そのプロセスだけで実行する方法を利用できます。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-private.ps1
```

`gh repo create` が未提供・権限不足などで失敗した場合は https://github.com/new で同名の **Private** リポジトリを空で作成し、以下を実行してください（`OWNER`は自分のGitHubログイン名へ変更）。

```powershell
git remote add origin https://github.com/OWNER/AI-Memory.git
git push -u origin main
```

**GitHubの画面でPrivateを必ず確認してください。**

## 4. Orcaで開発

1. Orcaを起動。
2. `Add Repo` から `C:\Development\AI-Memory` を選択。
3. 既定のbase refを `origin/main` にする。
4. `+` でworktreeを作成（例: `feature/m1-original-storage`）。
5. CodexまたはClaude Codeを選び、`AGENTS.md`・`docs/database/DESIGN.md`を読ませた上で作業を開始。
6. 差分・テストを確認し、ブランチをコミット・pushしてPRを作成。
7. PRのGitHub Actionsが通ってからmainへマージ。main上で直接大きなAI変更を進めない。

OrcaはGitのworktreeを利用します。複数のAIセッションで同一の作業ファイルを同時に上書きさせないでください。

## 5. GitHubの費用・情報保護

- Privateリポジトリにする。
- CIは `.github/workflows/ci.yml` の合成テスト・標準Linuxランナーのみから開始。
- GitHubのBilling予算と利用状況を確認。
- ローカルの本物の記憶・原音声・SQLite本番DB・秘密値をGitHubへpushしない。
- `.gitignore`に加えてpush前に `git status` と `git diff --cached --name-only` を確認する。
- OrcaやAIエージェントの自動コミット・pushにも同じルールを適用する。

## 6. 今後の通常作業

```powershell
# 作業ブランチの作成・選択はOrcaのworktree操作を優先
# 変更の確認
git status
git diff
# 合成データによる簡易チェック
python .\docs\database\sqlite_smoke_test.py
```

ローカルの保存はPC側のディスクによるもので、GitHub pushは別操作です。**原本の無期限保存には後続M1/M3のバックアップ実装が必要**です。
