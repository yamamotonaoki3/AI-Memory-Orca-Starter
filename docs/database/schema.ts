/**
 * AI-Memory M1：Drizzle ORMによるSQLiteスキーマ設計案 v0.1。
 * 本番利用前に、バージョンを固定したdrizzle-ormとdrizzle-kitで型チェックを行う。
 * UUID形式の主キーはSQLiteではなく、アプリ側のcrypto.randomUUID()で生成する。
 * 日時はすべてUTCのUnixエポックミリ秒をINTEGERで記録する。
 * 原本と人間の訂正文は、DBのテキスト列ではなく保護された変更不可のファイルに保存する。
 * 本番サーバーの起動時にマイグレーションを自動実行しない。
 */
import { sql } from "drizzle-orm";
import {
  check, index, integer, primaryKey, sqliteTable, text, uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["ACTIVE", "DISABLED", "RECOVERY_REQUIRED"] }).notNull().default("ACTIVE"),
  createdAtMs: integer("created_at_ms").notNull(),
});

export const webauthnCredentials = sqliteTable("webauthn_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  credentialId: text("credential_id").notNull(), // base64url形式。一意制約で重複登録を防ぐ。
  publicKey: text("public_key").notNull(), // 認証器の公開鍵を符号化して保存する。秘密鍵は保存しない。
  rpId: text("rp_id").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  createdAtMs: integer("created_at_ms").notNull(),
  revokedAtMs: integer("revoked_at_ms"),
}, (t) => [uniqueIndex("webauthn_credential_id_uq").on(t.credentialId), index("webauthn_user_idx").on(t.userId)]);

export const recoveryCodes = sqliteTable("recovery_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  codeHash: text("code_hash").notNull(), // ソルト付きの検証用ハッシュを保存する。復旧コードの平文は保持しない。
  salt: text("salt").notNull(),
  issuedAtMs: integer("issued_at_ms").notNull(),
  consumedAtMs: integer("consumed_at_ms"),
  revokedAtMs: integer("revoked_at_ms"),
}, (t) => [uniqueIndex("recovery_code_hash_uq").on(t.codeHash), index("recovery_user_idx").on(t.userId)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  tokenHash: text("token_hash").notNull(),
  scope: text("scope").notNull().default("NORMAL"),
  createdAtMs: integer("created_at_ms").notNull(),
  lastSeenAtMs: integer("last_seen_at_ms").notNull(),
  expiresAtMs: integer("expires_at_ms").notNull(),
  revokedAtMs: integer("revoked_at_ms"),
}, (t) => [uniqueIndex("sessions_token_hash_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // 保護対象のメタデータ。権限確認前に公開しない。
  status: text("status").notNull().default("ACTIVE"),
  createdAtMs: integer("created_at_ms").notNull(),
});

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  sourceType: text("source_type", { enum: ["DIRECT_TEXT", "TXT_UPLOAD", "MD_UPLOAD"] }).notNull(),
  status: text("status", { enum: ["PENDING", "ACTIVE", "ARCHIVED", "RESTRICTED", "DELETED"] }).notNull().default("PENDING"),
  occurredAtMs: integer("occurred_at_ms"),
  ingestedAtMs: integer("ingested_at_ms").notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [index("records_owner_status_created_idx").on(t.ownerUserId, t.status, t.createdAtMs)]);

export const originalVersions = sqliteTable("original_versions", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  versionNo: integer("version_no").notNull(),
  originalFileName: text("original_file_name"), // 元ファイル名には機密情報が含まれる可能性がある。
  mediaType: text("media_type").notNull(),
  encodingHint: text("encoding_hint"),
  storageRelPath: text("storage_rel_path").notNull(), // 固定ルートとの結合は専用の安全なパス解決処理だけに許可する。
  sha256: text("sha256").notNull(),
  byteLength: integer("byte_length").notNull(),
  status: text("status", { enum: ["STAGED", "COMMITTED", "QUARANTINED"] }).notNull().default("STAGED"),
  createdAtMs: integer("created_at_ms").notNull(),
  committedAtMs: integer("committed_at_ms"),
}, (t) => [
  uniqueIndex("original_versions_record_seq_uq").on(t.recordId, t.versionNo),
  uniqueIndex("original_versions_storage_path_uq").on(t.storageRelPath),
  index("original_versions_record_idx").on(t.recordId),
  check("original_versions_version_positive", sql`${t.versionNo} > 0`),
  check("original_versions_byte_length_positive", sql`${t.byteLength} > 0`),
]);

export const textRevisions = sqliteTable("text_revisions", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  sourceOriginalVersionId: text("source_original_version_id").notNull().references(() => originalVersions.id, { onDelete: "restrict" }),
  parentRevisionId: text("parent_revision_id"), // 親の訂正履歴が同じ記録に属するかはService層でも検証する。
  revisionNo: integer("revision_no").notNull(),
  contentRelPath: text("content_rel_path").notNull(),
  sha256: text("sha256").notNull(),
  editorUserId: text("editor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewStatus: text("review_status", { enum: ["DRAFT", "HUMAN_CONFIRMED", "SUPERSEDED"] }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [
  uniqueIndex("text_revisions_record_seq_uq").on(t.recordId, t.revisionNo),
  uniqueIndex("text_revisions_path_uq").on(t.contentRelPath),
  check("text_revisions_seq_positive", sql`${t.revisionNo} > 0`),
]);

export const taxonomyNodes = sqliteTable("taxonomy_nodes", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["CATEGORY", "TOPIC", "TAG"] }).notNull(),
  label: text("label").notNull(),
  approvalStatus: text("approval_status", { enum: ["PROPOSED", "APPROVED", "REJECTED"] }).notNull().default("PROPOSED"),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [index("taxonomy_kind_status_idx").on(t.kind, t.approvalStatus)]);

export const recordTaxonomyLinks = sqliteTable("record_taxonomy_links", {
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  taxonomyNodeId: text("taxonomy_node_id").notNull().references(() => taxonomyNodes.id, { onDelete: "restrict" }),
  assignedBy: text("assigned_by", { enum: ["HUMAN", "AI"] }).notNull(),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [primaryKey({ columns: [t.recordId, t.taxonomyNodeId] })]);

export const recordProjectLinks = sqliteTable("record_project_links", {
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [primaryKey({ columns: [t.recordId, t.projectId] }), index("rpl_project_idx").on(t.projectId)]);

export const securityRuleSets = sqliteTable("security_rule_sets", {
  id: text("id").primaryKey(),
  policyVersion: text("policy_version").notNull(),
  rulesSha256: text("rules_sha256").notNull(),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "RETIRED"] }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [uniqueIndex("security_rule_sets_version_uq").on(t.policyVersion)]);

export const securityScans = sqliteTable("security_scans", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  originalVersionId: text("original_version_id").references(() => originalVersions.id, { onDelete: "restrict" }),
  textRevisionId: text("text_revision_id").references(() => textRevisions.id, { onDelete: "restrict" }),
  ruleSetId: text("rule_set_id").notNull().references(() => securityRuleSets.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["PENDING", "SCANNING", "MASKING", "VERIFYING", "REVIEW_REQUIRED", "COMPLETED", "FAILED", "SUPERSEDED"] }).notNull().default("PENDING"),
  classification: text("classification", { enum: ["UNKNOWN", "PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] }).notNull().default("UNKNOWN"),
  scannedAtMs: integer("scanned_at_ms"),
}, (t) => [
  index("security_scans_record_status_idx").on(t.recordId, t.status),
  check("security_scans_exactly_one_source", sql`(${t.originalVersionId} IS NOT NULL AND ${t.textRevisionId} IS NULL) OR (${t.originalVersionId} IS NULL AND ${t.textRevisionId} IS NOT NULL)`),
]);

export const safeTextVersions = sqliteTable("safe_text_versions", {
  id: text("id").primaryKey(),
  scanId: text("scan_id").notNull().references(() => securityScans.id, { onDelete: "restrict" }),
  safeTitle: text("safe_title").notNull(),
  safeBody: text("safe_body").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status", { enum: ["DRAFT", "REVIEW_REQUIRED", "APPROVED", "REVOKED"] }).notNull().default("DRAFT"),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [index("safe_text_scan_idx").on(t.scanId)]);

export const searchIndexVersions = sqliteTable("search_index_versions", {
  id: text("id").primaryKey(),
  generation: integer("generation").notNull(),
  tokenizerVersion: text("tokenizer_version").notNull(),
  securityPolicyVersion: text("security_policy_version").notNull(),
  status: text("status", { enum: ["BUILDING", "ACTIVE", "RETIRED", "FAILED"] }).notNull(),
  activatedAtMs: integer("activated_at_ms"),
}, (t) => [uniqueIndex("search_index_gen_uq").on(t.generation)]);

// FTS5の外部コンテンツ方式で参照する実体テーブル。仮想テーブルと同期トリガーは別SQLで作成する。
// 現在公開可能な承認済み安全化データだけを登録し、Service層でも検証する。
export const searchDocuments = sqliteTable("search_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "restrict" }),
  safeTextVersionId: text("safe_text_version_id").notNull().references(() => safeTextVersions.id, { onDelete: "restrict" }),
  safeTitle: text("safe_title").notNull(),
  safeBody: text("safe_body").notNull(),
  status: text("status", { enum: ["READY", "DISABLED"] }).notNull(),
  indexGeneration: integer("index_generation").notNull(),
  indexedAtMs: integer("indexed_at_ms").notNull(),
}, (t) => [
  uniqueIndex("search_documents_safe_version_uq").on(t.safeTextVersionId),
  index("search_documents_record_status_idx").on(t.recordId, t.status),
]);

export const reviewItems = sqliteTable("review_items", {
  id: text("id").primaryKey(),
  recordId: text("record_id").references(() => records.id, { onDelete: "restrict" }),
  securityScanId: text("security_scan_id").references(() => securityScans.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  status: text("status", { enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"] }).notNull().default("OPEN"),
  priority: integer("priority").notNull().default(50),
  reasonCode: text("reason_code").notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
  resolvedAtMs: integer("resolved_at_ms"),
}, (t) => [index("review_items_status_priority_idx").on(t.status, t.priority)]);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  recordId: text("record_id").references(() => records.id, { onDelete: "restrict" }),
  payloadRelPath: text("payload_rel_path"), // 保護対象のジョブデータ。内容をログに出力しない。
  status: text("status", { enum: ["PENDING", "RUNNING", "RETRY_WAIT", "REVIEW_REQUIRED", "DONE", "FAILED", "CANCELLED"] }).notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  availableAtMs: integer("available_at_ms").notNull(),
  leaseOwner: text("lease_owner"),
  leaseUntilMs: integer("lease_until_ms"),
  createdAtMs: integer("created_at_ms").notNull(),
  finishedAtMs: integer("finished_at_ms"),
}, (t) => [
  index("jobs_status_available_idx").on(t.status, t.availableAtMs),
  check("jobs_attempts_nonnegative", sql`${t.attempts} >= 0 AND ${t.maxAttempts} > 0`),
]);

export const idempotencyRequests = sqliteTable("idempotency_requests", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  operation: text("operation").notNull(),
  keyHash: text("key_hash").notNull(),
  requestSha256: text("request_sha256").notNull(),
  responseRecordId: text("response_record_id").references(() => records.id, { onDelete: "restrict" }),
  createdAtMs: integer("created_at_ms").notNull(),
  expiresAtMs: integer("expires_at_ms").notNull(),
}, (t) => [uniqueIndex("idempotency_owner_op_key_uq").on(t.ownerUserId, t.operation, t.keyHash)]);

export const storageOperations = sqliteTable("storage_operations", {
  id: text("id").primaryKey(),
  originalVersionId: text("original_version_id").references(() => originalVersions.id, { onDelete: "restrict" }),
  operationType: text("operation_type").notNull(),
  stagingRelPath: text("staging_rel_path").notNull(),
  finalRelPath: text("final_rel_path").notNull(),
  expectedSha256: text("expected_sha256").notNull(),
  status: text("status", { enum: ["PREPARED", "FILE_READY", "DB_COMMITTED", "VERIFIED", "RECOVERY_REQUIRED"] }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull(),
}, (t) => [index("storage_operations_status_idx").on(t.status)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  result: text("result").notNull(),
  reasonCode: text("reason_code"),
  prevEventDigest: text("prev_event_digest"),
  eventDigest: text("event_digest"),
  occurredAtMs: integer("occurred_at_ms").notNull(),
}, (t) => [index("audit_events_occurred_idx").on(t.occurredAtMs)]);

export const recordTombstones = sqliteTable("record_tombstones", {
  recordId: text("record_id").primaryKey().references(() => records.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  approvedByUserId: text("approved_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  approvedAtMs: integer("approved_at_ms").notNull(),
  deletionStatus: text("deletion_status", { enum: ["REQUESTED", "IN_PROGRESS", "COMPLETED", "VERIFICATION_REQUIRED"] }).notNull(),
}, (t) => [uniqueIndex("tombstone_sequence_uq").on(t.sequence)]);

export const ledgerAnchors = sqliteTable("ledger_anchors", {
  sequence: integer("sequence").primaryKey(),
  ledgerDigest: text("ledger_digest").notNull(),
  externalAnchorReference: text("external_anchor_reference"),
  createdAtMs: integer("created_at_ms").notNull(),
});

export const backupGenerations = sqliteTable("backup_generations", {
  id: text("id").primaryKey(),
  generation: integer("generation").notNull(),
  snapshotRelPath: text("snapshot_rel_path").notNull(),
  manifestSha256: text("manifest_sha256"),
  dbSnapshotSha256: text("db_snapshot_sha256"),
  ledgerSequence: integer("ledger_sequence"),
  status: text("status", { enum: ["CREATING", "VERIFYING", "VERIFIED", "RESTORE_TESTED", "FAILED"] }).notNull().default("CREATING"),
  createdAtMs: integer("created_at_ms").notNull(),
  verifiedAtMs: integer("verified_at_ms"),
}, (t) => [uniqueIndex("backup_generation_uq").on(t.generation)]);

export const configVersions = sqliteTable("config_versions", {
  id: text("id").primaryKey(),
  configVersion: integer("config_version").notNull(),
  configSha256: text("config_sha256").notNull(),
  status: text("status", { enum: ["DRAFT", "VALIDATED", "ACTIVE", "RETIRED"] }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
  activatedAtMs: integer("activated_at_ms"),
}, (t) => [uniqueIndex("config_versions_num_uq").on(t.configVersion)]);

export const modelProfiles = sqliteTable("model_profiles", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("OLLAMA"),
  modelName: text("model_name").notNull(),
  modelDigest: text("model_digest").notNull(),
  configSha256: text("config_sha256").notNull(),
  status: text("status", { enum: ["CANDIDATE", "APPROVED", "RETIRED"] }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
}, (t) => [uniqueIndex("model_profile_digest_config_uq").on(t.modelDigest, t.configSha256)]);

export const modelEvaluations = sqliteTable("model_evaluations", {
  id: text("id").primaryKey(),
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfiles.id, { onDelete: "restrict" }),
  datasetVersion: text("dataset_version").notNull(),
  reportRelPath: text("report_rel_path").notNull(),
  criticalFailures: integer("critical_failures").notNull(),
  approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  evaluatedAtMs: integer("evaluated_at_ms").notNull(),
}, (t) => [index("model_evaluation_profile_idx").on(t.modelProfileId)]);
