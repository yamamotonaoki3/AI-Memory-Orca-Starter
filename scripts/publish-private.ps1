# 初回の新規プライベートリポジトリ作成専用。
# 本ファイルを読み、実行者が明示的にPowerShellから起動してください。
param(
    [string] $RepositoryName = 'AI-Memory'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

if (Test-Path '.git') {
    throw '既存Gitリポジトリを検出しました。既存の履歴/remoteを変更しないため停止します。'
}
foreach ($cmd in @('git', 'gh')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "必要なコマンドがありません: $cmd。docs/ORCA_SETUP.mdを参照してください。"
    }
}
& gh auth status
if ($LASTEXITCODE -ne 0) { throw 'gh auth loginでGitHub認証してください。' }

$account = (& gh api user --jq .login)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($account)) {
    throw 'GitHubのログイン名を確認できませんでした。'
}
Write-Host "GitHubアカウント: $account"
Write-Host "作成予定: $account/$RepositoryName (PRIVATE)"
Write-Host "ローカル: $root"
Write-Host '既存のGitHubリポジトリは上書きしません。'
$answer = Read-Host '上記のPrivateリポジトリを新規作成し、ファイルをpushしますか？ yes/no'
if ($answer -cne 'yes') { throw 'ユーザーが作成を取り消しました。' }

# 想定外のファイルを一括追加しない。初回ZIPに含めた許可済み構成だけをステージ。
& git init -b main
if ($LASTEXITCODE -ne 0) { throw 'git init失敗' }
$paths = @('.github', '.editorconfig', '.gitattributes', '.gitignore', 'AGENTS.md', 'README.md', 'docs', 'scripts')
foreach ($p in $paths) { & git add -- $p; if ($LASTEXITCODE -ne 0) { throw "git add失敗: $p" } }
$staged = @(& git diff --cached --name-only)
Write-Host '=== Gitへ追加するファイル ==='
$staged | ForEach-Object { Write-Host $_ }
# ファイルが想定外に編集されても危険な拡張子が混入しないことを検証
$deny = @('(?i)(^|/)\.env(\.|$)', '(?i)(^|/)auth\.json$', '(?i)(^|/)\.claude/', '(?i)(^|/)\.codex/', '(?i)\.(sqlite|sqlite3|db|kdbx|pem|key|p12|pfx|m4a|mp3|wav|aac|caf)$')
foreach ($file in $staged) {
    foreach ($pattern in $deny) {
        if ($file -match $pattern) { throw "安全のため中止しました: $file" }
    }
}
if ($staged.Count -eq 0) { throw 'コミット対象がありません。' }
$answer2 = Read-Host '一覧に秘密情報・実データがなく、すべてソース/設計書であることを確認しましたか？ yes/no'
if ($answer2 -cne 'yes') { throw '確認が取れず停止しました。' }
& git commit -m 'chore: initialize private AI-Memory Orca starter and M1 DB design'
if ($LASTEXITCODE -ne 0) { throw 'git commit失敗。Gitのuser.name/user.email設定を確認してください。' }

# 既存同名リポジトリが存在すれば gh が失敗する。--publicは使わない。
& gh repo create $RepositoryName --private --source . --remote origin --push --description 'Private local AI memory project; source and synthetic tests only'
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub側のPrivate作成またはpushに失敗しました。作成済みかどうかGitHubで確認してください。勝手に公開設定へ切り替えないでください。'
}
$visibility = (& gh repo view --json visibility --jq .visibility)
if ($LASTEXITCODE -ne 0 -or $visibility -ne 'PRIVATE') {
    throw '非公開状態を確認できませんでした。GitHubの画面で必ずPrivateを確認してください。'
}
Write-Host "SUCCESS: $account/$RepositoryName はPrivateです。OrcaのAdd Repoから $root を開いてください。"
