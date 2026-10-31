-- Apply as a REVIEWED, manual custom migration AFTER Drizzle created search_documents.
-- Requires a SQLite build supporting FTS5 + trigram.
-- Only safe, approved text is ever inserted into search_documents by SearchPublishService.
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

-- If this custom migration is introduced after content rows exist, after review:
-- INSERT INTO search_documents_fts(search_documents_fts) VALUES('rebuild');
-- Verify in a test copy:
-- INSERT INTO search_documents_fts(search_documents_fts, rank) VALUES('integrity-check', 1);

-- Query service requirements (not included in this migration):
-- - Literal/escaped MATCH query; 1-2 character Japanese uses bounded safe-text fallback.
-- - Bound query parameters, owner/project authorization, record status, index generation,
--   keyset paging; do not return any source content without authorization.
