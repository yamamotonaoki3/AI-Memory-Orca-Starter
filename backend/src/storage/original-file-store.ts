import { createHash } from "node:crypto";
import { lstat, link, mkdir, open, readFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";

// M1の直接テキスト用の暫定上限。サイズ上限の変更は要件レビュー後に行う。
export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface OriginalReceipt {
  recordId: string;
  originalVersionId: string;
  createdAtMs: number;
  storageRelPath: string;
  sha256: string;
  byteLength: number;
}

export type OriginalInspection = "FILE_READY" | "STAGED" | "RECOVERY_REQUIRED";

export interface NewOriginal {
  recordId: string;
  originalVersionId: string;
  bytes: Uint8Array;
  createdAtMs: number;
}

function assertUuid(id: string): void {
  if (!UUID_PATTERN.test(id)) {
    throw new Error("原本IDにはUUIDを指定してください。");
  }
}

function assertBytes(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_ORIGINAL_BYTES) {
    throw new Error("原本のサイズが許容範囲外です。");
  }
}

function relPath(originalVersionId: string, createdAtMs: number): string {
  const date = new Date(createdAtMs);
  if (!Number.isSafeInteger(createdAtMs) || Number.isNaN(date.getTime())) {
    throw new Error("原本の日時が不正です。");
  }
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return "originals/" + year + "/" + month + "/" + originalVersionId;
}

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateReceipt(value: unknown, expectedId: string): OriginalReceipt {
  if (typeof value !== "object" || value === null) {
    throw new Error("保存ジャーナルが破損しています。");
  }
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.recordId !== "string" || !UUID_PATTERN.test(entry.recordId) ||
    entry.originalVersionId !== expectedId ||
    typeof entry.createdAtMs !== "number" ||
    typeof entry.storageRelPath !== "string" ||
    typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256) ||
    typeof entry.byteLength !== "number" || !Number.isInteger(entry.byteLength) ||
    entry.byteLength < 1 || entry.byteLength > MAX_ORIGINAL_BYTES ||
    entry.storageRelPath !== relPath(expectedId, entry.createdAtMs)
  ) {
    throw new Error("保存ジャーナルの内容を検証できませんでした。");
  }
  return {
    recordId: entry.recordId,
    originalVersionId: expectedId,
    createdAtMs: entry.createdAtMs,
    storageRelPath: entry.storageRelPath,
    sha256: entry.sha256,
    byteLength: entry.byteLength,
  };
}

async function isFileMissing(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

/**
 * DBと組み合わせる前の、原本ファイル保存専用の低レベル部品。
 * ジャーナルには原本文を含めない。APIから直接呼び出さないこと。
 */
export class OriginalFileStore {
  private readonly root: string;

  constructor(root: string) {
    if (!path.isAbsolute(root) || path.resolve(root) === path.parse(path.resolve(root)).root) {
      throw new Error("保存先は専用の絶対ディレクトリを指定してください。");
    }
    this.root = path.resolve(root);
  }

  private journalFile(id: string): string {
    return path.join(this.root, "runtime", "journal", id + ".json");
  }

  private stagingFile(id: string): string {
    return path.join(this.root, "runtime", "staging", id + ".part");
  }

  private originalFile(receipt: OriginalReceipt): string {
    // 外部からの相対パスを直接結合せず、検証済みの日付・IDから再構築する。
    return path.join(this.root, ...relPath(receipt.originalVersionId, receipt.createdAtMs).split("/"));
  }

  private async ensureDirectory(directory: string): Promise<void> {
    const absolute = path.resolve(directory);
    const relative = path.relative(path.parse(absolute).root, absolute);
    let current = path.parse(absolute).root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try {
        await mkdir(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("保存経路にシンボリックリンクまたは不正な領域があります。");
      }
      const resolved = await realpath(current);
      const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
      if (normalize(path.resolve(resolved)) !== normalize(path.resolve(current))) {
        throw new Error("保存経路でジャンクションまたは別の場所への参照を検出しました。");
      }
    }
  }

  private async validateFile(filePath: string, receipt: OriginalReceipt): Promise<boolean> {
    if (await isFileMissing(filePath)) return false;
    await this.ensureDirectory(path.dirname(filePath));
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== receipt.byteLength) {
      throw new Error("原本ファイルの種類またはサイズが不正です。");
    }
    const bytes = await readFile(filePath);
    if (bytes.byteLength !== receipt.byteLength || checksum(bytes) !== receipt.sha256) {
      throw new Error("原本のハッシュが一致しません。復旧作業が必要です。");
    }
    return true;
  }

  private async loadReceipt(originalVersionId: string): Promise<OriginalReceipt> {
    assertUuid(originalVersionId);
    const filePath = this.journalFile(originalVersionId);
    await this.ensureDirectory(path.dirname(filePath));
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) {
      throw new Error("保存ジャーナルの形式が不正です。");
    }
    const body: unknown = JSON.parse(await readFile(filePath, "utf8"));
    return validateReceipt(body, originalVersionId);
  }

  async stage(input: NewOriginal): Promise<OriginalReceipt> {
    assertUuid(input.recordId);
    assertUuid(input.originalVersionId);
    assertBytes(input.bytes);
    const receipt: OriginalReceipt = {
      recordId: input.recordId,
      originalVersionId: input.originalVersionId,
      createdAtMs: input.createdAtMs,
      storageRelPath: relPath(input.originalVersionId, input.createdAtMs),
      sha256: checksum(input.bytes),
      byteLength: input.bytes.byteLength,
    };
    const journal = this.journalFile(input.originalVersionId);
    const stage = this.stagingFile(input.originalVersionId);
    await this.ensureDirectory(path.dirname(journal));
    await this.ensureDirectory(path.dirname(stage));
    // ジャーナルを先に不変ファイルとして確定。途中停止時は後続の検査で不足を検知する。
    const j = await open(journal, "wx", 0o600);
    try {
      await j.writeFile(JSON.stringify(receipt));
      await j.sync();
    } finally {
      await j.close();
    }
    const file = await open(stage, "wx", 0o600);
    try {
      await file.writeFile(input.bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    return receipt;
  }

  async promote(originalVersionId: string): Promise<OriginalReceipt> {
    const receipt = await this.loadReceipt(originalVersionId);
    const destination = this.originalFile(receipt);
    const stage = this.stagingFile(originalVersionId);
    await this.ensureDirectory(path.dirname(destination));
    const hasDestination = await this.validateFile(destination, receipt);
    if (!hasDestination) {
      if (!await this.validateFile(stage, receipt)) {
        throw new Error("ステージング中の原本がありません。復旧作業が必要です。");
      }
      // 同一ボリュームのハードリンクで新規作成する。既存の原本を上書きしない。
      try {
        await link(stage, destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      await this.validateFile(destination, receipt);
    }
    // ファイルは検証済み。DBとの確定連携が完了するまではステージングを保持する。
    return receipt;
  }

  async inspect(originalVersionId: string): Promise<OriginalInspection> {
    const receipt = await this.loadReceipt(originalVersionId);
    try {
      if (await this.validateFile(this.originalFile(receipt), receipt)) return "FILE_READY";
      if (await this.validateFile(this.stagingFile(originalVersionId), receipt)) return "STAGED";
      return "RECOVERY_REQUIRED";
    } catch {
      // ここでは安全側に倒して復旧確認を要求する。原本ファイルは書き換えない。
      return "RECOVERY_REQUIRED";
    }
  }

  async listJournalIds(): Promise<string[]> {
    const directory = path.join(this.root, "runtime", "journal");
    await this.ensureDirectory(directory);
    const entries = await readdir(directory);
    // 不正な名前は除外せず、運用上の確認エラーとする。
    for (const entry of entries) {
      if (!entry.endsWith(".json") || !UUID_PATTERN.test(entry.slice(0, -5))) {
        throw new Error("保存ジャーナルに不明なファイルが存在します。復旧確認が必要です。");
      }
    }
    return entries.map((entry) => entry.slice(0, -5)).sort();
  }

  async verifyCommitted(originalVersionId: string): Promise<void> {
    const receipt = await this.loadReceipt(originalVersionId);
    const found = await this.validateFile(this.originalFile(receipt), receipt);
    if (!found) throw new Error("確定済み原本が見つかりません。復旧確認が必要です。");
  }
}
