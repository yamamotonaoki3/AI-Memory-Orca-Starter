# npm auditで報告された中程度の脆弱性への対応

## 背景

2026年10月31日のWindows 11ローカル環境で`npm audit`を実行した際、次の2系統（合計5件の依存ツリー上の報告）が検出されました。

| 対象 | アドバイザリ | 修正版 | 今回の対策 |
| --- | --- | --- | --- |
| Honoの`serveStatic` | [GHSA-5r4p-p66f-jhc7](https://github.com/advisories/GHSA-5r4p-p66f-jhc7) | 4.13.11以降 | `hono`を`4.13.14`へ更新 |
| `esbuild`の開発サーバー | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | 0.25.0以降 | `@esbuild-kit/core-utils`が参照する`esbuild`を`0.25.12`で上書き |

`drizzle-kit@0.31.11`の依存チェーンから古い`@esbuild-kit/esm-loader`と`@esbuild-kit/core-utils`が入り、その先の`esbuild@0.18.x`が報告されていました。この間接依存については[Drizzle側の報告](https://github.com/drizzle-team/drizzle-orm/issues/5198)も参照します。

## 実施した対策

- **`npm audit fix --force`を実行しません**。従来のDrizzle Kitへ大幅にダウングレードする自動変更を避けます。
- Honoを修正済みの`4.13.14`へ固定します。
- `overrides`でDrizzle Kitの間接依存`esbuild`だけを修正済みの版へ固定します。
- GitHub Actionsで`npm audit --omit=dev --audit-level=moderate`と`npm audit --audit-level=moderate`を実行し、警告を黙認しません。
- API・画面・TypeScript・Drizzleのマイグレーション・SQLiteテストで、依存変更後の動作を確認します。

## 検証結果と制約

- CIの結果は対象PRのChecksを正本として参照します。
- 実際の会話データや本番SQLiteは使いません。
- 今回の変更は、依存ライブラリの間接的な置き換えです。`@esbuild-kit`が公式に`esbuild@0.25.12`での動作を保証していることを意味しません。CIのビルド・テストと実行時検証によってリスクを評価します。
- `package-lock.json`をGitに登録し、CIは`npm ci`で依存関係を再現します。依存更新時はパッケージ変更とロックファイル差分を一緒にレビューします。
- 本番で動く依存関係と開発依存関係の両方を確認します。新たな脆弱性が検出されたら別途評価・対処します。

## Windows 11での検証手順

PRをマージした後、既存の作業内容を保護して`main`を更新します。

```powershell
git status
git switch main
git pull --ff-only origin main
npm ci
npm run audit:prod
npm run audit:all
npm run typecheck
npm test
npm run build:web
npm run db:generate
npm run db:verify
```

`npm ci`はロックファイルの内容を前提として依存関係を再構成します。既存の未コミット変更や秘密情報をGitHubへ登録しないでください。

**注意:** `npm audit`は依存関係データベースに載っている既知の問題を調べるもので、アプリ全体の安全性を保証するものではありません。
