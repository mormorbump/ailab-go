#!/usr/bin/env -S deno run -A
/**
 * zodcli 新しいインターフェースの使用例
 */
import { createNestedParser, run } from "../mod.ts";
import { z } from "npm:zod";

// サブコマンドパーサーの定義例

const gitAddSchema = {
  name: "git add",
  description: "Add files to git staging",
  args: {
    files: {
      type: z.string().array().describe("files to add"),
      positional: "...",
    },
    all: {
      type: z.boolean().default(false).describe("add all files"),
      short: "a",
    },
  },
} as const;

const gitParser = createNestedParser("git", "Git command line tool", {
  add: gitAddSchema,
  commit: {
    name: "git commit",
    description: "Commit staged changes",
    args: {
      message: {
        type: z.string().describe("commit message"),
        positional: true,
      },
      amend: {
        type: z.boolean().default(false).describe("amend previous commit"),
        short: "a",
      },
    },
  },
});

if (import.meta.main) {
  // サブコマンドパーサーのデモ
  console.log("\n3. サブコマンドパーサーの使用例:");
  try {
    const mockSubArgs = ["add", "file1.txt", "file2.txt", "--all"];
    const { command, data } = gitParser.parse(mockSubArgs);
    // console.log(`  サブコマンド [${command}] パース成功!`);
    if (command === "add") {
      console.log(
        `  ファイル: ${data.files.join(", ")}, 全ファイル追加: ${data.all}`
      );
    } else if (command === "commit") {
      console.log(`  メッセージ: ${data.message}, アメンド: ${data.amend}`);
    }
  } catch (error) {
    console.error(
      "  パースエラー:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // サブコマンドパーサーのsafeParseデモ
  console.log("\n4. サブコマンドパーサーのsafeParse使用例:");
  const mockSubArgs2 = ["unknown-command"];
  const subResult = gitParser.safeParse(mockSubArgs2);

  if (subResult.ok) {
    console.log(`  サブコマンド [${subResult.data.command}] パース成功!`);
    console.log("  データ:", subResult.data.data);
  } else {
    console.error("  パースエラー:", subResult.error.message);
  }

  // 新しいrun関数の使用例
  console.log("\n5. 新しいrun関数の使用例（ショートハンド）:");
  console.log("  シンプルな例:");
}
