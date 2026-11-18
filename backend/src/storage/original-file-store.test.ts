import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_ORIGINAL_BYTES, OriginalFileStore } from "./original-file-store";

const RECORD_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const NOW = Date.UTC(2026, 9, 31, 8, 0, 0);
const SAMPLE_TEXT = "架空のテスト用会話です。実際の秘密情報は含みません。";

describe("不変原本の保存基盤", () => {
  let root: string;
  let store: OriginalFileStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ai-memory-storage-test-"));
    store = new OriginalFileStore(root);
  });

  afterEach(async () => {
    // テスト自身が生成した一時フォルダだけを削除する。本番保存先には触れない。
    await rm(root, { recursive: true, force: true });
  });

  it("日本語原本をステージングし、再起動後に無上書きで確定できる", async () => {
    const bytes = Buffer.from(SAMPLE_TEXT, "utf8");
    const receipt = await store.stage({
      recordId: RECORD_ID,
      originalVersionId: VERSION_ID,
      bytes,
      createdAtMs: NOW,
    });
    expect(receipt.byteLength).toBe(bytes.length);
    expect(receipt.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.storageRelPath).toBe("originals/2026/10/" + VERSION_ID);
    expect(await store.inspect(VERSION_ID)).toBe("STAGED");
    expect(await store.listJournalIds()).toEqual([VERSION_ID]);

    // アプリの再起動を想定し、永続ジャーナルから原本の配置を復旧する。
    store = new OriginalFileStore(root);
    await expect(store.promote(VERSION_ID)).resolves.toEqual(receipt);
    expect(await store.inspect(VERSION_ID)).toBe("FILE_READY");
    await expect(store.verifyFinal(VERSION_ID)).resolves.toBeUndefined();
    const result = await readFile(path.join(root, ...receipt.storageRelPath.split("/")));
    expect(result).toEqual(bytes);
    await expect(store.promote(VERSION_ID)).resolves.toEqual(receipt);
  });

  it("同じ原本IDの二重保存による上書きを拒否する", async () => {
    await store.stage({
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from("初回"), createdAtMs: NOW,
    });
    await expect(store.stage({
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from("二重登録"), createdAtMs: NOW,
    })).rejects.toMatchObject({ code: "EEXIST" });
    await expect(store.promote(VERSION_ID)).resolves.toBeDefined();
    const destination = path.join(root, "originals", "2026", "10", VERSION_ID);
    expect(await readFile(destination, "utf8")).toBe("初回");
  });

  it("破損したステージングの昇格を拒否し、ジャーナルを残す", async () => {
    await store.stage({
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from("検証用原本"), createdAtMs: NOW,
    });
    await writeFile(path.join(root, "runtime", "staging", VERSION_ID + ".part"), "不正な改変");
    await expect(store.promote(VERSION_ID)).rejects.toThrow();
    expect(await store.inspect(VERSION_ID)).toBe("RECOVERY_REQUIRED");
    expect(await store.listJournalIds()).toContain(VERSION_ID);
    await expect(store.verifyFinal(VERSION_ID)).rejects.toThrow("見つかりません");
  });

  it("確定後に原本が改変された場合も検出する", async () => {
    await store.stage({
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from("未改変の原本"), createdAtMs: NOW,
    });
    const receipt = await store.promote(VERSION_ID);
    await writeFile(path.join(root, ...receipt.storageRelPath.split("/")), "原本が改変された");
    await expect(store.verifyFinal(VERSION_ID)).rejects.toThrow();
    expect(await store.inspect(VERSION_ID)).toBe("RECOVERY_REQUIRED");
  });

  it("原本のサイズ上限・不正ID・相対保存先を拒否する", async () => {
    expect(() => new OriginalFileStore("./relative-data")).toThrow("絶対");
    await expect(store.stage({
      recordId: "../../etc", originalVersionId: VERSION_ID,
      bytes: Buffer.from("入力"), createdAtMs: NOW,
    })).rejects.toThrow("UUID");
    await expect(store.stage({
      recordId: RECORD_ID, originalVersionId: randomUUID(),
      bytes: new Uint8Array(MAX_ORIGINAL_BYTES + 1), createdAtMs: NOW,
    })).rejects.toThrow("サイズ");
    expect(await store.listJournalIds()).toEqual([]);
  });

  it("保存ジャーナルが改変された場合は安全側に失敗する", async () => {
    await store.stage({
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from("安全なテスト原本"), createdAtMs: NOW,
    });
    const journal = path.join(root, "runtime", "journal", VERSION_ID + ".json");
    const data = JSON.parse(await readFile(journal, "utf8"));
    data.storageRelPath = "../../outside.txt";
    await writeFile(journal, JSON.stringify(data));
    await expect(store.promote(VERSION_ID)).rejects.toThrow("ジャーナル");
  });

  it.each(["Buffer", "Uint8Array"] as const)(
    "%sの呼出元が保存中に領域を再利用しても受付時の原本を保持する",
    async (kind) => {
      const bytes = kind === "Buffer"
        ? Buffer.from(SAMPLE_TEXT, "utf8")
        : new Uint8Array(Buffer.from(SAMPLE_TEXT, "utf8"));
      const pending = store.stage({
        recordId: RECORD_ID, originalVersionId: VERSION_ID,
        bytes, createdAtMs: NOW,
      });
      // 呼出元の領域は保存処理とは独立して再利用できる。
      bytes.fill(0);
      const receipt = await pending;
      expect(await readFile(path.join(root, "runtime", "staging", VERSION_ID + ".part"), "utf8"))
        .toBe(SAMPLE_TEXT);
      await expect(store.promote(VERSION_ID)).resolves.toEqual(receipt);
      await expect(store.verifyFinal(VERSION_ID)).resolves.toBeUndefined();
    },
  );

  it("呼出元が入力オブジェクトを再利用しても受付時の本文と識別情報を保存する", async () => {
    const input = {
      recordId: RECORD_ID, originalVersionId: VERSION_ID,
      bytes: Buffer.from(SAMPLE_TEXT, "utf8"), createdAtMs: NOW,
    };
    const pending = store.stage(input);
    input.bytes = Buffer.from("別の合成入力", "utf8");
    input.recordId = randomUUID();
    input.originalVersionId = randomUUID();
    input.createdAtMs = NOW + 86400000;
    const receipt = await pending;
    expect(receipt).toMatchObject({
      recordId: RECORD_ID, originalVersionId: VERSION_ID, createdAtMs: NOW,
    });
    expect(await readFile(path.join(root, "runtime", "staging", VERSION_ID + ".part"), "utf8"))
      .toBe(SAMPLE_TEXT);
    await expect(store.promote(VERSION_ID)).resolves.toEqual(receipt);
    await expect(store.verifyFinal(VERSION_ID)).resolves.toBeUndefined();
    expect(await store.listJournalIds()).toEqual([VERSION_ID]);
  });

});

