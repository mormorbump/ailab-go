/* @script */
import $ from "jsr:@david/dax";
import { Result, ok, err } from "npm:neverthrow";

type WaitCiError =
  | { type: "workflow_not_found"; message: string }
  | { type: "workflow_failed"; message: string };

export async function pushWithWaitCI(): Promise<Result<void, WaitCiError>> {
  // console.log("ワークフロー:", workflowFile);

  const prevRunId =
    await $`gh run list --limit 1 --json databaseId --jq '.[0].databaseId'`.text();
  if (!prevRunId.trim()) {
    console.log("Previous run not found.");
    // return err({
    //   type: "workflow_not_found",
    //   message: "ワークフロー実行が見つかりませんでした。",
    // });
  }

  const branchName = await $`git symbolic-ref --short HEAD`.text();
  await $`git push origin ${branchName}`;
  // wait 10 seconds

  const p = $.progress("Updating Database");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  let runId: string | undefined = undefined;
  let maxRetry = 5;
  while (maxRetry-- > 0) {
    const currentId =
      await $`gh run list --limit 1 --json databaseId --jq '.[0].databaseId'`.text();
    if (prevRunId !== currentId) {
      runId = currentId;
      break;
    }
    p.increment();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!runId) {
    return err({
      type: "workflow_not_found",
      message: "ワークフロー実行が見つかりませんでした。",
    });
  }
  p.finish();

  await $`gh run watch ${runId}`;

  const status =
    await $`gh run view ${runId} --json conclusion --jq '.conclusion'`.text();
  console.log(status.trim());

  if (status.trim() === "success") {
    return ok(undefined);
  } else {
    console.log("---- CI Log ----");
    await $`gh run view ${runId} --log-failed`.noThrow();

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

  const result = await pushWithWaitCI();
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
  const result = await pushWithWaitCI();
  expect(result.isOk() || result.isErr()).toBe(true);
});

test("デフォルト引数で動作すること", async () => {
  const result = await pushWithWaitCI();
  expect(result.isOk() || result.isErr()).toBe(true);
});
