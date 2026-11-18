CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`result` text NOT NULL,
	`reason_code` text,
	`prev_event_digest` text,
	`event_digest` text,
	`occurred_at_ms` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_events_occurred_idx` ON `audit_events` (`occurred_at_ms`);--> statement-breakpoint
CREATE TABLE `backup_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`generation` integer NOT NULL,
	`snapshot_rel_path` text NOT NULL,
	`manifest_sha256` text,
	`db_snapshot_sha256` text,
	`ledger_sequence` integer,
	`status` text DEFAULT 'CREATING' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`verified_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_generation_uq` ON `backup_generations` (`generation`);--> statement-breakpoint
CREATE TABLE `config_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`config_version` integer NOT NULL,
	`config_sha256` text NOT NULL,
	`status` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`activated_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_versions_num_uq` ON `config_versions` (`config_version`);--> statement-breakpoint
CREATE TABLE `idempotency_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`key_hash` text NOT NULL,
	`request_sha256` text NOT NULL,
	`response_record_id` text,
	`created_at_ms` integer NOT NULL,
	`expires_at_ms` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`response_record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_owner_op_key_uq` ON `idempotency_requests` (`owner_user_id`,`operation`,`key_hash`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`record_id` text,
	`payload_rel_path` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`available_at_ms` integer NOT NULL,
	`lease_owner` text,
	`lease_until_ms` integer,
	`created_at_ms` integer NOT NULL,
	`finished_at_ms` integer,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "jobs_attempts_nonnegative" CHECK("jobs"."attempts" >= 0 AND "jobs"."max_attempts" > 0)
);
--> statement-breakpoint
CREATE INDEX `jobs_status_available_idx` ON `jobs` (`status`,`available_at_ms`);--> statement-breakpoint
CREATE TABLE `ledger_anchors` (
	`sequence` integer PRIMARY KEY NOT NULL,
	`ledger_digest` text NOT NULL,
	`external_anchor_reference` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`model_profile_id` text NOT NULL,
	`dataset_version` text NOT NULL,
	`report_rel_path` text NOT NULL,
	`critical_failures` integer NOT NULL,
	`approved_by_user_id` text,
	`evaluated_at_ms` integer NOT NULL,
	FOREIGN KEY (`model_profile_id`) REFERENCES `model_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `model_evaluation_profile_idx` ON `model_evaluations` (`model_profile_id`);--> statement-breakpoint
CREATE TABLE `model_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'OLLAMA' NOT NULL,
	`model_name` text NOT NULL,
	`model_digest` text NOT NULL,
	`config_sha256` text NOT NULL,
	`status` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_profile_digest_config_uq` ON `model_profiles` (`model_digest`,`config_sha256`);--> statement-breakpoint
CREATE TABLE `original_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`original_file_name` text,
	`media_type` text NOT NULL,
	`encoding_hint` text,
	`storage_rel_path` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`status` text DEFAULT 'STAGED' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`committed_at_ms` integer,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "original_versions_version_positive" CHECK("original_versions"."version_no" > 0),
	CONSTRAINT "original_versions_byte_length_positive" CHECK("original_versions"."byte_length" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `original_versions_record_seq_uq` ON `original_versions` (`record_id`,`version_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `original_versions_storage_path_uq` ON `original_versions` (`storage_rel_path`);--> statement-breakpoint
CREATE INDEX `original_versions_record_idx` ON `original_versions` (`record_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_project_links` (
	`record_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	PRIMARY KEY(`record_id`, `project_id`),
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `rpl_project_idx` ON `record_project_links` (`project_id`);--> statement-breakpoint
CREATE TABLE `record_taxonomy_links` (
	`record_id` text NOT NULL,
	`taxonomy_node_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	PRIMARY KEY(`record_id`, `taxonomy_node_id`),
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`taxonomy_node_id`) REFERENCES `taxonomy_nodes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `record_tombstones` (
	`record_id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`approved_by_user_id` text NOT NULL,
	`approved_at_ms` integer NOT NULL,
	`deletion_status` text NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tombstone_sequence_uq` ON `record_tombstones` (`sequence`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`occurred_at_ms` integer,
	`ingested_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `records_owner_status_created_idx` ON `records` (`owner_user_id`,`status`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`salt` text NOT NULL,
	`issued_at_ms` integer NOT NULL,
	`consumed_at_ms` integer,
	`revoked_at_ms` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_code_hash_uq` ON `recovery_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `recovery_user_idx` ON `recovery_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text,
	`security_scan_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`priority` integer DEFAULT 50 NOT NULL,
	`reason_code` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`security_scan_id`) REFERENCES `security_scans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `review_items_status_priority_idx` ON `review_items` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `safe_text_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`safe_title` text NOT NULL,
	`safe_body` text NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `security_scans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `safe_text_scan_idx` ON `safe_text_versions` (`scan_id`);--> statement-breakpoint
CREATE TABLE `search_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text NOT NULL,
	`safe_text_version_id` text NOT NULL,
	`safe_title` text NOT NULL,
	`safe_body` text NOT NULL,
	`status` text NOT NULL,
	`index_generation` integer NOT NULL,
	`indexed_at_ms` integer NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`safe_text_version_id`) REFERENCES `safe_text_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_documents_safe_version_uq` ON `search_documents` (`safe_text_version_id`);--> statement-breakpoint
CREATE INDEX `search_documents_record_status_idx` ON `search_documents` (`record_id`,`status`);--> statement-breakpoint
CREATE TABLE `search_index_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`generation` integer NOT NULL,
	`tokenizer_version` text NOT NULL,
	`security_policy_version` text NOT NULL,
	`status` text NOT NULL,
	`activated_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_gen_uq` ON `search_index_versions` (`generation`);--> statement-breakpoint
CREATE TABLE `security_rule_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_version` text NOT NULL,
	`rules_sha256` text NOT NULL,
	`status` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_rule_sets_version_uq` ON `security_rule_sets` (`policy_version`);--> statement-breakpoint
CREATE TABLE `security_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`original_version_id` text,
	`text_revision_id` text,
	`rule_set_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`classification` text DEFAULT 'UNKNOWN' NOT NULL,
	`scanned_at_ms` integer,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`original_version_id`) REFERENCES `original_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`text_revision_id`) REFERENCES `text_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rule_set_id`) REFERENCES `security_rule_sets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "security_scans_exactly_one_source" CHECK(("security_scans"."original_version_id" IS NOT NULL AND "security_scans"."text_revision_id" IS NULL) OR ("security_scans"."original_version_id" IS NULL AND "security_scans"."text_revision_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `security_scans_record_status_idx` ON `security_scans` (`record_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text DEFAULT 'NORMAL' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`last_seen_at_ms` integer NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`revoked_at_ms` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_uq` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `storage_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`original_version_id` text,
	`operation_type` text NOT NULL,
	`staging_rel_path` text NOT NULL,
	`final_rel_path` text NOT NULL,
	`expected_sha256` text NOT NULL,
	`status` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`original_version_id`) REFERENCES `original_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `storage_operations_status_idx` ON `storage_operations` (`status`);--> statement-breakpoint
CREATE TABLE `taxonomy_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`approval_status` text DEFAULT 'PROPOSED' NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `taxonomy_kind_status_idx` ON `taxonomy_nodes` (`kind`,`approval_status`);--> statement-breakpoint
CREATE TABLE `text_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`source_original_version_id` text NOT NULL,
	`parent_revision_id` text,
	`revision_no` integer NOT NULL,
	`content_rel_path` text NOT NULL,
	`sha256` text NOT NULL,
	`editor_user_id` text NOT NULL,
	`review_status` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_original_version_id`) REFERENCES `original_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`editor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "text_revisions_seq_positive" CHECK("text_revisions"."revision_no" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text_revisions_record_seq_uq` ON `text_revisions` (`record_id`,`revision_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `text_revisions_path_uq` ON `text_revisions` (`content_rel_path`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webauthn_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`rp_id` text NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`revoked_at_ms` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webauthn_credential_id_uq` ON `webauthn_credentials` (`credential_id`);--> statement-breakpoint
CREATE INDEX `webauthn_user_idx` ON `webauthn_credentials` (`user_id`);