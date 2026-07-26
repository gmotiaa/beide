import assert from "node:assert";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GitIgnoreMatcher } from "./paths";
import { CheckpointService } from "./checkpoints";
import { IpcError } from "./ipc-utils";
import type { UsageStateData } from "../../src/lib/usage";
import {
  PLANS,
  applySpend,
  canSpend,
  cloneUsage,
  effectiveLimits,
} from "../../src/lib/usage";

async function runTests() {
  console.log("=== BACKEND EMPIRICAL VERIFICATION HARNESS ===");
  let passed = 0;
  let failed = 0;

  // 1. Dynamic .gitignore parsing
  try {
    console.log("\n[TEST 1] Dynamic .gitignore parsing...");
    const matcher = new GitIgnoreMatcher();
    matcher.addPatterns("node_modules/\n*.log\n!important.log\n/dist\ntemp/*");
    
    assert.strictEqual(matcher.ignores("node_modules", true), true, "node_modules dir ignored");
    assert.strictEqual(matcher.ignores("app.log", false), true, "*.log ignored");
    assert.strictEqual(matcher.ignores("important.log", false), false, "!important.log negated (not ignored)");
    assert.strictEqual(matcher.ignores("dist", true), true, "/dist anchored dir ignored");
    assert.strictEqual(matcher.ignores("src/dist", true), false, "src/dist not matched by /dist");
    assert.strictEqual(matcher.ignores("temp/cache.txt", false), true, "temp/* ignored");
    
    console.log("  PASS: Dynamic .gitignore parsing rules verified successfully.");
    passed++;
  } catch (err) {
    console.error("  FAIL: .gitignore parsing:", err);
    failed++;
  }

  // 2. 150ms debounced event batching logic
  try {
    console.log("\n[TEST 2] 150ms debounced event batching...");
    let callCount = 0;
    const pendingPaths = new Set<string>();
    let watchTimer: NodeJS.Timeout | null = null;
    const firedEvents: string[][] = [];

    function triggerWatch(relPath: string) {
      pendingPaths.add(relPath);
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        const paths = Array.from(pendingPaths);
        pendingPaths.clear();
        firedEvents.push(paths);
        callCount++;
      }, 150);
    }

    // Trigger rapid events at 0ms, 40ms, 80ms
    triggerWatch("src/a.ts");
    await new Promise((r) => setTimeout(r, 40));
    triggerWatch("src/b.ts");
    await new Promise((r) => setTimeout(r, 40));
    triggerWatch("src/c.ts");

    // At t=80ms, callCount should be 0 because 150ms has not passed since last trigger
    assert.strictEqual(callCount, 0, "No event fired during burst");
    assert.strictEqual(firedEvents.length, 0);

    // Wait 180ms more (t=260ms)
    await new Promise((r) => setTimeout(r, 180));
    assert.strictEqual(callCount, 1, "Exactly 1 batched event fired after debounce");
    assert.deepStrictEqual(firedEvents[0], ["src/a.ts", "src/b.ts", "src/c.ts"], "All paths batched together");

    console.log("  PASS: 150ms debounced event batching verified successfully.");
    passed++;
  } catch (err) {
    console.error("  FAIL: Debounced batching:", err);
    failed++;
  }

  // 3. Structured IPC { success, data, error } envelopes
  try {
    console.log("\n[TEST 3] Structured IPC { success, data, error } envelopes...");
    
    function mockRehandle(handler: () => Promise<unknown>) {
      return async () => {
        try {
          const data = await handler();
          return { success: true, data };
        } catch (e) {
          const code = e instanceof IpcError ? e.code : "INTERNAL_ERROR";
          const message = e instanceof Error ? e.message : String(e);
          return { success: false, error: { message, code } };
        }
      };
    }

    // Test success case
    const successHandler = mockRehandle(async () => ({ file: "test.txt", bytes: 42 }));
    const successRes = await successHandler();
    assert.deepStrictEqual(successRes, {
      success: true,
      data: { file: "test.txt", bytes: 42 },
    });

    // Test IpcError case
    const ipcErrHandler = mockRehandle(async () => {
      throw new IpcError("path too long", "TOO_LARGE");
    });
    const ipcErrRes = await ipcErrHandler();
    assert.deepStrictEqual(ipcErrRes, {
      success: false,
      error: { message: "path too long", code: "TOO_LARGE" },
    });

    // Test generic Error case
    const sysErrHandler = mockRehandle(async () => {
      throw new Error("File locked");
    });
    const sysErrRes = await sysErrHandler();
    assert.deepStrictEqual(sysErrRes, {
      success: false,
      error: { message: "File locked", code: "INTERNAL_ERROR" },
    });

    console.log("  PASS: Structured IPC envelopes verified successfully.");
    passed++;
  } catch (err) {
    console.error("  FAIL: Structured IPC envelopes:", err);
    failed++;
  }

  // 4. Base64 binary checkpoint safety & rollback
  try {
    console.log("\n[TEST 4] Base64 binary checkpoint safety & rollback...");
    const testDir = join(tmpdir(), `beide_test_${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    const checkpoints = new CheckpointService();
    checkpoints.setWorkspace(testDir);

    // Create binary file with null bytes
    const binPath = join(testDir, "test.bin");
    const originalBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a, 0x00, 0xff]);
    await writeFile(binPath, originalBuffer);

    // Create checkpoint
    const cpId = await checkpoints.snapshot(["test.bin"], "binary snapshot test");

    // Check saved checkpoint payload for base64 encoding
    // Entries are stored under index-based names (entry_0000.json …) so a
    // workspace file cannot collide with a generated payload name; the real
    // relative path travels inside the payload.
    const cpDir = join(testDir, ".beide", "checkpoints", cpId);
    const cpPayloadRaw = await readFile(join(cpDir, "entry_0000.json"), "utf-8");
    const cpPayload = JSON.parse(cpPayloadRaw);
    assert.strictEqual(cpPayload.encoding, "base64", "Binary file encoded as base64");
    assert.strictEqual(cpPayload.content, originalBuffer.toString("base64"), "Content matches base64 string");

    // Mutate binary file on disk
    const mutatedBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    await writeFile(binPath, mutatedBuffer);

    // Restore checkpoint
    await checkpoints.restore(cpId);

    // Read back restored file
    const restoredBuffer = await readFile(binPath);
    assert.deepStrictEqual(restoredBuffer, originalBuffer, "Restored binary content matches original byte-for-byte");

    // Clean up test dir
    await rm(testDir, { recursive: true, force: true });

    console.log("  PASS: Base64 binary checkpoint safety verified successfully.");
    passed++;
  } catch (err) {
    console.error("  FAIL: Base64 binary checkpoint safety:", err);
    failed++;
  }

  // 5. 30ms token streaming batching
  try {
    console.log("\n[TEST 5] 30ms token streaming batching...");
    let streamBuffer: unknown[] = [];
    let streamTimer: NodeJS.Timeout | null = null;
    const emittedEvents: unknown[] = [];

    function flushStreamBuffer() {
      if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
      }
      if (streamBuffer.length === 0) return;
      const events = streamBuffer;
      streamBuffer = [];

      let combinedDelta = "";
      let sampleEvent: { assistantMessageEvent?: { delta?: string } } | null = null;
      let canCombine = true;

      for (const ev of events as Array<{ type?: string; assistantMessageEvent?: { type?: string; delta?: string } }>) {
        if (ev.type === "message_update" && ev.assistantMessageEvent?.type === "text_delta") {
          combinedDelta += ev.assistantMessageEvent.delta ?? "";
          sampleEvent = ev;
        } else {
          canCombine = false;
          break;
        }
      }

      if (canCombine && sampleEvent && combinedDelta) {
        emittedEvents.push({
          ...sampleEvent,
          assistantMessageEvent: {
            ...sampleEvent.assistantMessageEvent,
            delta: combinedDelta,
          },
        });
      } else {
        emittedEvents.push(...events);
      }
    }

    function emit(event: unknown) {
      const ev = event as { type?: string; assistantMessageEvent?: { type?: string } };
      if (ev?.type === "message_update" && ev?.assistantMessageEvent?.type === "text_delta") {
        streamBuffer.push(event);
        if (!streamTimer) {
          streamTimer = setTimeout(() => flushStreamBuffer(), 30);
        }
      } else {
        flushStreamBuffer();
        emittedEvents.push(event);
      }
    }

    // Push 3 text_delta events rapidly
    emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hello " } });
    emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "world!" } });
    emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: " How are you?" } });

    assert.strictEqual(emittedEvents.length, 0, "No event emitted before 30ms timer");

    // Wait 50ms
    await new Promise((r) => setTimeout(r, 50));

    assert.strictEqual(emittedEvents.length, 1, "Exactly 1 batched token event emitted after 30ms");
    assert.strictEqual(
      (emittedEvents[0] as { assistantMessageEvent: { delta: string } }).assistantMessageEvent.delta,
      "Hello world! How are you?",
      "Deltas combined correctly",
    );

    console.log("  PASS: 30ms token streaming batching verified successfully.");
    passed++;
  } catch (err) {
    console.error("  FAIL: 30ms token streaming batching:", err);
    failed++;
  }

  // 6. Token quota allocation — one rule for both processes
  try {
    console.log("\n[TEST 6] Token quota allocation and gating...");

    const base: UsageStateData = {
      plan: "free",
      h5: { key: "h5_1", endsAt: Date.now() + 3_600_000, used: 0 },
      week: { key: "wk_1", endsAt: Date.now() + 86_400_000, used: 0 },
      credits: 0,
    };

    // Server limits win over the local PLANS mirror — the UI used to read
    // PLANS directly and showed the wrong quota for cloud accounts.
    const withServerLimits: UsageStateData = {
      ...base,
      limits: { label: "Team", tokens5h: 1000, tokensWeek: 5000 },
    };
    assert.strictEqual(
      effectiveLimits(withServerLimits).tokens5h,
      1000,
      "server limits beat the PLANS mirror",
    );
    assert.strictEqual(
      effectiveLimits(base).tokens5h,
      PLANS.free.tokens5h,
      "PLANS mirror used when the server said nothing",
    );

    // Plan window first, bonus credits only for the remainder.
    const mixed = applySpend({ ...withServerLimits, credits: 500 }, 1200);
    assert.strictEqual(mixed.fromPlan, 1000, "plan window drained first");
    assert.strictEqual(mixed.fromCredits, 200, "remainder taken from credits");
    assert.strictEqual(mixed.overshoot, 0, "nothing overshot");
    assert.strictEqual(mixed.data.credits, 300, "credits debited");
    assert.strictEqual(mixed.data.h5.used, 1000, "h5 charged the plan part");
    assert.strictEqual(mixed.data.week.used, 1000, "week charged the plan part");

    // Past every pool the overshoot still lands on the windows — dropping it
    // would let a client-side bypass spend for free.
    const over = applySpend(withServerLimits, 1500);
    assert.strictEqual(over.overshoot, 500, "overshoot reported");
    assert.strictEqual(over.data.h5.used, 1500, "overshoot recorded on h5");
    assert.strictEqual(over.data.week.used, 1500, "overshoot recorded on week");

    // `limits` / `demo` survive a spend — losing them silently falls back to PLANS.
    const carried = applySpend({ ...withServerLimits, demo: true }, 10);
    assert.strictEqual(carried.data.limits?.tokens5h, 1000, "limits carried through");
    assert.strictEqual(carried.data.demo, true, "demo flag carried through");
    assert.strictEqual(
      cloneUsage({ ...withServerLimits, demo: true }).limits?.label,
      "Team",
      "cloneUsage keeps limits",
    );

    // The gate names the window that blocked, in codes rather than prose.
    assert.strictEqual(canSpend(withServerLimits, 100).ok, true, "spend allowed");
    const h5Blocked = canSpend(
      { ...withServerLimits, h5: { ...withServerLimits.h5, used: 1000 } },
      100,
    );
    assert.strictEqual(h5Blocked.ok, false, "5h exhaustion blocks");
    assert.strictEqual(h5Blocked.code, "h5_exhausted", "5h denial code");
    const weekBlocked = canSpend(
      { ...withServerLimits, week: { ...withServerLimits.week, used: 5000 } },
      100,
    );
    assert.strictEqual(weekBlocked.ok, false, "weekly exhaustion blocks");
    assert.strictEqual(weekBlocked.code, "week_exhausted", "weekly denial code");

    // Credits can carry a spend the plan window alone cannot.
    assert.strictEqual(
      canSpend(
        {
          ...withServerLimits,
          h5: { ...withServerLimits.h5, used: 1000 },
          credits: 500,
        },
        100,
      ).ok,
      true,
      "credits cover a drained plan window",
    );

    console.log("  PASS: quota allocation, carry-through and gating verified.");
    passed++;
  } catch (err) {
    console.error("  FAIL: token quota allocation:", err);
    failed++;
  }

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
