"""Run with: python sqlite_smoke_test.py (stdlib only).
Tests only handcrafted minimum core tables + real FTS custom SQL triggers.
Does NOT validate full Drizzle schema, auth, Windows ACL, or production migrations.
"""
from pathlib import Path
import sqlite3

base = Path(__file__).resolve().parent
c = sqlite3.connect(":memory:")
c.executescript("""
PRAGMA foreign_keys=ON;
CREATE TABLE records(id TEXT PRIMARY KEY, status TEXT NOT NULL);
CREATE TABLE original_versions(id TEXT PRIMARY KEY, record_id TEXT, version_no INT, original_file_name TEXT, media_type TEXT, encoding_hint TEXT, storage_rel_path TEXT, sha256 TEXT, byte_length INT);
CREATE TABLE text_revisions(id TEXT PRIMARY KEY, record_id TEXT, source_original_version_id TEXT, parent_revision_id TEXT, revision_no INT, content_rel_path TEXT, sha256 TEXT, editor_user_id TEXT, created_at_ms INT);
CREATE TABLE record_tombstones(record_id TEXT PRIMARY KEY, sequence INT);
CREATE TABLE security_rule_sets(id TEXT PRIMARY KEY,status TEXT NOT NULL);
CREATE TABLE security_scans(id TEXT PRIMARY KEY,record_id TEXT,rule_set_id TEXT,status TEXT,classification TEXT);
CREATE TABLE safe_text_versions(id TEXT PRIMARY KEY,scan_id TEXT,safe_title TEXT,safe_body TEXT,sha256 TEXT,status TEXT);
CREATE TABLE search_documents(id INTEGER PRIMARY KEY,record_id TEXT,safe_text_version_id TEXT,safe_title TEXT,safe_body TEXT,status TEXT,index_generation INT);
""")
c.executescript((base / "fts5_search.sql").read_text(encoding="utf-8"))
c.executescript((base / "integrity_guardrails.sql").read_text(encoding="utf-8"))

def blocked(query):
    try:
        c.execute(query)
    except sqlite3.DatabaseError:
        return
    raise AssertionError("A forbidden statement unexpectedly succeeded: " + query)

c.execute("INSERT INTO records VALUES('r1','ACTIVE')")
c.execute("INSERT INTO original_versions VALUES('o1','r1',1,'input.txt','text/plain','utf8','2026/10/o1','hash1',10)")
c.execute("INSERT INTO security_rule_sets VALUES('rules','ACTIVE')")
c.execute("INSERT INTO security_scans VALUES('scan','r1','rules','COMPLETED','PUBLIC')")
c.execute("INSERT INTO safe_text_versions VALUES('safe','scan','安全なタイトル','日本語の安全な本文','hash-safe','APPROVED')")
c.execute("INSERT INTO search_documents VALUES(1,'r1','safe','安全なタイトル','日本語の安全な本文','READY',1)")
assert c.execute("SELECT COUNT(*) FROM search_documents_fts WHERE search_documents_fts MATCH ?", ('"日本語"',)).fetchone()[0] == 1
blocked("UPDATE original_versions SET sha256='changed' WHERE id='o1'")
blocked("DELETE FROM original_versions WHERE id='o1'")
blocked("UPDATE safe_text_versions SET safe_body='replaced' WHERE id='safe'")
blocked("INSERT INTO search_documents VALUES(2,'r1','safe','原文を漏洩','未検査の本文','READY',1)")
c.execute("UPDATE security_scans SET classification='RESTRICTED' WHERE id='scan'")
assert c.execute("SELECT COUNT(*) FROM search_documents_fts WHERE search_documents_fts MATCH ?", ('"日本語"',)).fetchone()[0] == 0
blocked("INSERT INTO search_documents VALUES(3,'r1','safe','安全なタイトル','日本語の安全な本文','READY',1)")
print("PASS: FTS insertion, revocation, immutable original, immutable safe text, unauthorized publish")
