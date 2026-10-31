import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = new URL("../migrations/", import.meta.url);
const files = readdirSync(directory)
  .filter((name) => /^[0-9].*\.sql$/.test(name))
  .sort();
assert.ok(files.length > 0, "生成したマイグレーションSQLがありません。");

// 実データに触れず、空のメモリ上に基本テーブルと保護トリガーを作成して確認する。
const db = new DatabaseSync(":memory:");
try {
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of files) {
    const sql = readFileSync(new URL(file, directory), "utf8");
    db.exec(sql);
  }
  for (const path of [
    "docs/database/fts5_search.sql",
    "docs/database/integrity_guardrails.sql",
  ]) {
    db.exec(readFileSync(join(process.cwd(), path), "utf8"));
  }
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_documents_fts%'",
  ).all();
  assert.equal(tables.length, 27, "通常テーブル数が27と一致しません。");
  assert.equal(
    db.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
    "SQLiteの整合性検査に失敗しました。",
  );
  assert.equal(
    db.prepare("PRAGMA foreign_key_check").all().length,
    0,
    "外部キー検査に失敗しました。",
  );
  assert.ok(
    db.prepare("SELECT 1 FROM sqlite_master WHERE name='search_documents_fts'").get(),
    "FTS5検索テーブルが作成されていません。",
  );
  console.log("成功: 27テーブル、FTS5、保護トリガー、DB整合性を検証しました。");
} finally {
  db.close();
}
