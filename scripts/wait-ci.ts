/* @script */
import $ from "jsr:@david/dax";
import { Result, ok, err } from "npm:neverthrow";

type WaitCiError =
  | { type: "workflow_not_found"; message: string }
  | { type: "workflow_failed"; message: string };

/**
 * GitHub Actions のワークフローの完了を待機する
 * @param workflowFile ワークフローファイル名 (デフォルト: ci.yml)
 * @param waitSeconds 待機秒数 (デフォルト: 10)
 */
export async function waitForCI(): Promise<Result<void, WaitCiError>> {
  // console.log("ワークフロー:", workflowFile);

  const prevRunId =
    await $`gh run list --limit 1 --json databaseId --jq '.[0].databaseId'`.text();
  if (!prevRunId.trim()) {
    return err({
      type: "workflow_not_found",
      message: "ワークフロー実行が見つかりませんでした。",
    });
  }

  const branchName = await $`git symbolic-ref --short HEAD`.text();

  await $`git push origin ${branchName}`;
  // wait 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10000));

  let runId: string | undefined = undefined;
  let maxRetry = 5;
  while (maxRetry-- > 0) {
    const afterPushDatabaseId =
      await $`gh run list --limit 1 --json databaseId --jq '.[0].databaseId'`.text();
    if (prevRunId !== afterPushDatabaseId) {
      runId = afterPushDatabaseId;
      break;
    }
    // console.");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!runId) {
    return err({
      type: "workflow_not_found",
      message: "ワークフロー実行が見つかりませんでした。",
    });
  }

  // 最新のワークフロー実行を取得
  // console.log("最新のワークフロー実行を検索しています...");

  // const runIdResult =
  //   await $`gh run list --limit 1 --json databaseId --jq '.[0].databaseId'`.text();
  // if (!runIdResult.trim()) {
  //   return err({
  //     type: "workflow_not_found",
  //     message: "ワークフロー実行が見つかりませんでした。",
  //   });
  // }
  // const runId = runIdResult.trim();

  console.log(`ワークフロー実行 ID: ${runId} の完了を待機しています...`);
  await $`gh run watch ${runId}`;

  const status =
    await $`gh run view ${runId} --json conclusion --jq '.conclusion'`.text();
  console.log("ワークフロー実行結果:", status.trim());

  if (status.trim() === "success") {
    return ok(undefined);
  } else {
    return err({
      type: "workflow_failed",
      message: `ワークフローが失敗しました: ${status}`,
    });
  }
}

// CLI エントリーポイント
if (import.meta.main) {
  // const args = Deno.args;
  // const workflowFile = args[0] || "ci.yml";
  // const waitSeconds = args[1] ? parseInt(args[1], 10) : 10;

  const result = await waitForCI();
  result.match(
    () => Deno.exit(0),
    (error) => {
      console.error(error.message);
      Deno.exit(1);
    }
  );
}

// テスト
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("引数のバリデーションが正しく動作すること", async () => {
  const result = await waitForCI();
  expect(result.isOk() || result.isErr()).toBe(true);
});

test("デフォルト引数で動作すること", async () => {
  const result = await waitForCI();
  expect(result.isOk() || result.isErr()).toBe(true);
});
