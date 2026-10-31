-- REVIEWED MANUAL MIGRATION: must be applied after schema.ts core tables exist.
-- Originals / human revisions are immutable metadata + bytes; intentional deletion
-- uses a separate explicitly approved purge workflow retaining tombstones.
CREATE TRIGGER original_versions_no_update_identity
BEFORE UPDATE OF record_id, version_no, original_file_name, media_type, encoding_hint,
                 storage_rel_path, sha256, byte_length ON original_versions
BEGIN SELECT RAISE(ABORT, 'original version content metadata is immutable'); END;

CREATE TRIGGER original_versions_no_delete
BEFORE DELETE ON original_versions
BEGIN SELECT RAISE(ABORT, 'original version metadata must be retained'); END;

CREATE TRIGGER text_revisions_no_update_content
BEFORE UPDATE OF record_id, source_original_version_id, parent_revision_id,
                 revision_no, content_rel_path, sha256, editor_user_id,
                 created_at_ms ON text_revisions
BEGIN SELECT RAISE(ABORT, 'text revisions are immutable'); END;

CREATE TRIGGER text_revisions_no_delete
BEFORE DELETE ON text_revisions
BEGIN SELECT RAISE(ABORT, 'text revision metadata must be retained'); END;

CREATE TRIGGER tombstones_no_delete
BEFORE DELETE ON record_tombstones
BEGIN SELECT RAISE(ABORT, 'tombstones must not be deleted'); END;

-- Defense-in-depth: search_documents must be a projection of fully reviewed safe text.
-- This M1 policy indexes only PUBLIC/INTERNAL. CONFIDENTIAL may require a separately
-- authorized, segregated search design; RESTRICTED/UNKNOWN are never in normal FTS.
-- A published safe text version must never have its content mutated in place.
-- Revoke and generate a new version instead.
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

-- Invalidate indexed projections automatically before/when their authority is revoked.
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

-- IMPORTANT: security policy rollout must first retract stale safe-text publication
-- in a reviewed maintenance transaction. A new policy can be activated only after
-- the old publication has been invalidated and later rescanned.
