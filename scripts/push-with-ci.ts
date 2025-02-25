/* @script */
/**
 * 現在のブランチをpushしてCIの完了を待つスクリプト
 *
 * このスクリプトは現在のブランチをpushし、CIが完了するまで待機します。
 *
 * 使用方法:
 * ```bash
 * deno run -A scripts/push-with-ci.ts
 * ```
 */

import $ from "jsr:@david/dax";
import { waitForCI } from "./wait-ci.ts";

/**
 * 現在のブランチ名を取得
 */
async function getCurrentBranch(): Promise<string> {
  const result = await $`git branch --show-current`.text();
  return result.trim();
}

/**
 * 指定されたブランチをpushしてCIの完了を待つ
 */
async function pushAndWaitCI() {
  try {
    // 現在のブランチを取得
    const branch = await getCurrentBranch();
    console.log(`🚀 Pushing branch: ${branch}`);

    // pushを実行
    await $`git push origin ${branch}`;
    console.log("✅ Push completed");

    // CIの完了を待機
    await waitForCI();
  } catch (error) {
    console.error("Error:", error);
    Deno.exit(1);
  }
}

// スクリプト実行
if (import.meta.main) {
  await pushAndWaitCI();
}

// テスト
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("getCurrentBranch returns a string", async () => {
  const branch = await getCurrentBranch();
  expect(typeof branch).toBe("string");
  expect(branch.length).toBeGreaterThan(0);
});
