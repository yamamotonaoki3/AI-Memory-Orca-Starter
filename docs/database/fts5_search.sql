-- 手動レビューが必要な追加マイグレーション。Drizzleでsearch_documentsを作成した後に適用する。
-- FTS5とtrigram方式を使用できるSQLiteが必要。
-- search_documentsには、SearchPublishServiceが承認済みの安全化テキストだけを登録する。
CREATE VIRTUAL TABLE search_documents_fts USING fts5(
  safe_title,
  safe_body,
  content='search_documents',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER search_documents_ai AFTER INSERT ON search_documents BEGIN
  INSERT INTO search_documents_fts(rowid, safe_title, safe_body)
  VALUES (new.id, new.safe_title, new.safe_body);
END;

CREATE TRIGGER search_documents_ad AFTER DELETE ON search_documents BEGIN
  INSERT INTO search_documents_fts(search_documents_fts, rowid, safe_title, safe_body)
  VALUES ('delete', old.id, old.safe_title, old.safe_body);
END;

CREATE TRIGGER search_documents_au AFTER UPDATE ON search_documents BEGIN
  INSERT INTO search_documents_fts(search_documents_fts, rowid, safe_title, safe_body)
  VALUES ('delete', old.id, old.safe_title, old.safe_body);
  INSERT INTO search_documents_fts(rowid, safe_title, safe_body)
  VALUES (new.id, new.safe_title, new.safe_body);
END;

-- 既存データがある環境へ追加するときは、レビュー後に索引を再構築する。
-- 実行例（必要な場合のみ。実行前にデータとマイグレーションを確認する）:
-- INSERT INTO search_documents_fts(search_documents_fts) VALUES('rebuild');
-- テスト用のDBコピーで整合性を確認する例:
-- INSERT INTO search_documents_fts(search_documents_fts, rank) VALUES('integrity-check', 1);

-- 検索サービスで実装すべき事項（このSQLには含まれない）:
-- - MATCHへの入力は文字列として安全に処理する。日本語1〜2文字は安全化済み本文で件数制限付きの代替検索を使う。
-- - SQLパラメータのバインド、ユーザー・案件ごとの認可、記録状態、索引世代、
--   キーセットページングを実装し、認可せずに本文を返さない。
