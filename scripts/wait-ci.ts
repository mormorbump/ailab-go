/* @script */
/**
 * GitHub Actions の CI 実行結果を待機するスクリプト
 *
 * このスクリプトは最新の実行中の CI を監視し、完了するまで待機します。
 * 完了したら結果を表示します。
 *
 * 使用方法:
 * ```bash
 * deno run -A scripts/wait-ci.ts
 * ```
 */

import $ from "jsr:@david/dax";

type RunListItem = {
  databaseId: number;
  status: string;
  conclusion: string | null;
};

/**
 * 最新のCI実行を取得
 */
async function getLatestRun(): Promise<RunListItem | null> {
  try {
    const runs =
      await $`gh run list --json databaseId,status,conclusion --limit 1`.json<
        RunListItem[]
      >();
    return runs[0] || null;
  } catch (error) {
    console.error("Error getting latest run:", error);
    return null;
  }
}

/**
 * CIの完了を待機して結果を表示
 */
async function waitForCI() {
  try {
    const run = await getLatestRun();
    if (!run) {
      console.error("❌ No CI runs found");
      return;
    }

    if (run.status !== "in_progress") {
      console.log("ℹ️ Latest CI is not running");
      await $`gh run view ${run.databaseId}`;
      return;
    }

    console.log("⏳ Waiting for CI to complete...");

    while (true) {
      const currentRun = await getLatestRun();
      if (!currentRun) break;

      if (currentRun.status !== "in_progress") {
        console.log("\n✨ CI completed!");
        await $`gh run view ${currentRun.databaseId}`;
        break;
      }

      // プログレス表示を更新
      await Deno.stdout.write(new TextEncoder().encode("."));
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5秒待機
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// スクリプト実行
if (import.meta.main) {
  await waitForCI();
}

// テスト
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("getLatestRun returns run information", async () => {
  const run = await getLatestRun();
  expect(run).toBeDefined();
  if (run) {
    expect(typeof run.databaseId).toBe("number");
    expect(typeof run.status).toBe("string");
  }
});
