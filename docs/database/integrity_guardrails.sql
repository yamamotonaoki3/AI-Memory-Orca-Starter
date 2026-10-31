-- 手動レビューが必要なマイグレーション。schema.tsの基本テーブル作成後に適用する。
-- 原本と人間による訂正履歴は、内容とメタデータを原則として変更・削除しない。
-- 例外的な削除には、削除記録を保持する別の承認済み手順を使用する。
CREATE TRIGGER original_versions_no_update_identity
BEFORE UPDATE OF record_id, version_no, original_file_name, media_type, encoding_hint,
                 storage_rel_path, sha256, byte_length ON original_versions
BEGIN SELECT RAISE(ABORT, 'original version content metadata is immutable'); END;

-- 原本のバイト列は変更しない。状態変更は審査済みの保存・復旧処理だけで行う。
-- 保存が確定していない原本を検索できる状態に残さない。
CREATE TRIGGER original_source_retract_on_status_change
AFTER UPDATE OF status ON original_versions
WHEN NEW.status <> 'COMMITTED'
BEGIN
  DELETE FROM search_documents WHERE safe_text_version_id IN (
    SELECT st.id FROM safe_text_versions AS st
    JOIN security_scans AS sc ON sc.id = st.scan_id
    WHERE sc.original_version_id = NEW.id
  );
END;

CREATE TRIGGER original_versions_no_delete
BEFORE DELETE ON original_versions
BEGIN SELECT RAISE(ABORT, 'original version metadata must be retained'); END;

CREATE TRIGGER text_revisions_no_update_content
BEFORE UPDATE OF record_id, source_original_version_id, parent_revision_id,
                 revision_no, content_rel_path, sha256, editor_user_id,
                 created_at_ms ON text_revisions
BEGIN SELECT RAISE(ABORT, 'text revisions are immutable'); END;

CREATE TRIGGER revision_source_retract_on_review_change
AFTER UPDATE OF review_status ON text_revisions
WHEN NEW.review_status <> 'HUMAN_CONFIRMED'
BEGIN
  DELETE FROM search_documents WHERE safe_text_version_id IN (
    SELECT st.id FROM safe_text_versions AS st
    JOIN security_scans AS sc ON sc.id = st.scan_id
    WHERE sc.text_revision_id = NEW.id
  );
END;

CREATE TRIGGER text_revisions_no_delete
BEFORE DELETE ON text_revisions
BEGIN SELECT RAISE(ABORT, 'text revision metadata must be retained'); END;

CREATE TRIGGER tombstones_no_delete
BEFORE DELETE ON record_tombstones
BEGIN SELECT RAISE(ABORT, 'tombstones must not be deleted'); END;

-- 機密検査の対象は、同じ記録に属する原本または訂正履歴に限定する。
-- 参照先が必ず一方だけになることは、Drizzleで定義したCHECK制約でも検証する。
CREATE TRIGGER security_scan_source_record_insert
BEFORE INSERT ON security_scans
WHEN (NEW.original_version_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM original_versions WHERE id = NEW.original_version_id AND record_id = NEW.record_id
)) OR (NEW.text_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM text_revisions WHERE id = NEW.text_revision_id AND record_id = NEW.record_id
))
BEGIN SELECT RAISE(ABORT, 'scan source must belong to the same record'); END;

-- 実行済みの機密検査を別の原本・訂正履歴・ルールセットへ付け替えない。
-- 対象や検査ルールが変わる場合は、新しい機密検査を作成する。
CREATE TRIGGER security_scans_no_rebind
BEFORE UPDATE OF record_id, original_version_id, text_revision_id, rule_set_id ON security_scans
 BEGIN SELECT RAISE(ABORT, 'scan provenance is immutable'); END;

-- 多層防御として、検索用データは検査・承認済みの安全化テキストからのみ作成する。
-- M1の通常検索ではPUBLICとINTERNALだけを索引化する。
-- CONFIDENTIALは別途認可と分離された検索設計が必要。RESTRICTEDとUNKNOWNは対象外とする。
-- 公開済みの安全化テキストは上書きせず、失効させて新しい版を作成する。
CREATE TRIGGER safe_text_versions_no_update_content
BEFORE UPDATE OF scan_id, safe_title, safe_body, sha256 ON safe_text_versions
BEGIN SELECT RAISE(ABORT, 'safe text content version is immutable'); END;

CREATE TRIGGER search_documents_publish_guard
BEFORE INSERT ON search_documents
WHEN NEW.status <> 'READY' OR NOT EXISTS (
 SELECT 1 FROM safe_text_versions AS st
 JOIN security_scans AS sc ON sc.id = st.scan_id
 JOIN security_rule_sets AS rs ON rs.id = sc.rule_set_id
 JOIN records AS r ON r.id = sc.record_id
 WHERE st.id = NEW.safe_text_version_id
   AND st.status = 'APPROVED'
   AND st.safe_title = NEW.safe_title
   AND st.safe_body = NEW.safe_body
   AND sc.status = 'COMPLETED'
   AND (
     (sc.original_version_id IS NOT NULL AND sc.text_revision_id IS NULL
       AND EXISTS (SELECT 1 FROM original_versions AS ov
                  WHERE ov.id=sc.original_version_id AND ov.record_id=r.id
                    AND ov.status='COMMITTED'))
     OR
     (sc.text_revision_id IS NOT NULL AND sc.original_version_id IS NULL
       AND EXISTS (SELECT 1 FROM text_revisions AS tr
                  WHERE tr.id=sc.text_revision_id AND tr.record_id=r.id
                    AND tr.review_status='HUMAN_CONFIRMED'))
   )
   AND sc.classification IN ('PUBLIC','INTERNAL')
   AND rs.status = 'ACTIVE'
   AND r.id = NEW.record_id
   AND r.status IN ('ACTIVE','ARCHIVED')
   AND NOT EXISTS (SELECT 1 FROM record_tombstones AS ts WHERE ts.record_id=r.id)
)
BEGIN SELECT RAISE(ABORT, 'search publication requires current approved safe text'); END;

CREATE TRIGGER search_documents_no_mutation
BEFORE UPDATE OF record_id, safe_text_version_id, safe_title, safe_body,
                 status, index_generation ON search_documents
BEGIN SELECT RAISE(ABORT, 'retract then publish, never mutate an indexed document'); END;

-- 承認や公開根拠が失効した際は、対応する検索索引を自動的に撤回する。
CREATE TRIGGER safe_text_retract_on_status_change
AFTER UPDATE OF status ON safe_text_versions
WHEN NEW.status <> 'APPROVED'
BEGIN DELETE FROM search_documents WHERE safe_text_version_id = NEW.id; END;

CREATE TRIGGER scan_retract_on_status_or_class_change
AFTER UPDATE OF status, classification ON security_scans
WHEN NEW.status <> 'COMPLETED' OR NEW.classification NOT IN ('PUBLIC','INTERNAL')
BEGIN DELETE FROM search_documents
 WHERE safe_text_version_id IN (SELECT id FROM safe_text_versions WHERE scan_id=NEW.id); END;

CREATE TRIGGER ruleset_retract_on_deactivation
AFTER UPDATE OF status ON security_rule_sets
WHEN NEW.status <> 'ACTIVE'
BEGIN DELETE FROM search_documents WHERE safe_text_version_id IN (
 SELECT st.id FROM safe_text_versions st
 JOIN security_scans sc ON sc.id=st.scan_id
 WHERE sc.rule_set_id = NEW.id
); END;

CREATE TRIGGER record_retract_on_status_change
AFTER UPDATE OF status ON records
WHEN NEW.status NOT IN ('ACTIVE','ARCHIVED')
BEGIN DELETE FROM search_documents WHERE record_id = NEW.id; END;

CREATE TRIGGER record_retract_on_tombstone
AFTER INSERT ON record_tombstones
BEGIN DELETE FROM search_documents WHERE record_id = NEW.record_id; END;

-- 重要：機密保護ルールを切り替える前に、旧ルールに基づく検索公開を
-- レビュー済みの保守トランザクションで撤回する。
-- 新ルールの有効化は、旧公開の失効と必要な再検査の手順を確認してから行う。
