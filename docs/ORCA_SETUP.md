# Windows 11 / GitHub Public（MIT）/ Orca セットアップ

## 1. 現在のリポジトリ

- GitHub: https://github.com/yamamotonaoki3/AI-Memory-Orca-Starter
- ライセンス: MIT（リポジトリ直下の `LICENSE`）
- 開発ソースはGitHubで管理。実際の会話原本・音声・本番SQLite・秘密情報はWindowsローカルだけで管理する。
- GitHubに既存リポジトリがあるため、`scripts/publish-private.ps1`を**再実行しない**。

## 2. ローカルPCへ保存（まだcloneしていない場合のみ）

```powershell
New-Item -ItemType Directory -Force C:\Development
Set-Location C:\Development
git clone https://github.com/yamamotonaoki3/AI-Memory-Orca-Starter.git AI-Memory
Set-Location C:\Development\AI-Memory
python .\docs\database\sqlite_smoke_test.py
```

すでにOrcaから既存Gitリポジトリを使用している場合は、**再clone不要**。Orcaのworktree上で差分を退避・確認してから同期する。

## 3. リポジトリの公開設定（GitHub管理者が操作）

GitHubリポジトリの `Settings` → `General` → `Danger Zone` → `Change repository visibility` → `Public` に変更する。
変更前に、全追跡ファイル、コミット履歴、PR、Actionsログの機密有無を再確認する。
公開後は誰でも過去のコミットやActionsログを閲覧・複製できる。GitHubとの接続があっても、チャット側から可視性設定を直接変更できるとは限らない。

GitHub CLIを使う場合（`gh auth login`が済んでいるPC）：

```powershell
gh repo edit yamamotonaoki3/AI-Memory-Orca-Starter --visibility public --accept-visibility-change-consequences
gh repo view yamamotonaoki3/AI-Memory-Orca-Starter --json visibility --jq .visibility
```

**注意:** これは取り消し不能な公開コピーを作られ得る操作。原本や秘密情報が過去のコミットに含まれていないことを必ず確認する。

## 4. Orcaでの作業

1. Orcaで既存の `C:\Development\AI-Memory`（または実際の保存先）を開く。
2. ベースブランチは `origin/main`。
3. 作業ごとに `feature/*` のworktreeを使用する。
4. コードをGitHubへpushしてPRを作り、CI結果と差分を確認してからmainへマージする。
5. CIが実行不可ならWindowsローカルで実行できたテストと未実行テストを明示する。

## 5. GitHub Actionsと料金

- 公開リポジトリの標準GitHub-hostedランナー（`ubuntu-latest`等）は利用無料。
- larger runnerや他の有料サービスは別途料金があり得る。
- アカウントの**支払い失敗・請求ロック**が原因なら、公開してもActionsが起動しない可能性がある。Billingを確認する。
- CIは合成データのみ。個人情報・実原本・本番DB・認証秘密をアップロードしない。
- 公開PRは第三者から送られる可能性があるので、外部PRのコードを実行するジョブへ秘密情報や書き込み権限を与えない。

## 6. 開発時の秘密情報保護

- `.gitignore`は誤登録防止の補助で、過去のコミットから秘密情報を消す機能はない。
- `git status` と `git diff --cached --name-only` をpush前に確認する。
- Windowsの原本保存用ディレクトリとGitリポジトリを分離する。
- モデル改善の設定オフとGitHub Public/MITは別問題。公開コードの第三者利用をMITで制限しない。

## 7. 最初のテスト

```powershell
python .\docs\database\sqlite_smoke_test.py
```

このスモークテストだけでDrizzle・WebAuthn・バックアップ・Windows実機の完成を証明できない。
