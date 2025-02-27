#!/usr/bin/env -S deno run -A
/**
 * zodcli モジュールの使用例
 */
import { createCommand, createSubCommands, run } from "../mod.ts";
import { z } from "npm:zod";

// 基本的なコマンド定義
const searchCommand = createCommand({
  name: "search",
  description: "Search with custom parameters",
  args: {
    query: {
      type: z.string().describe("search query"),
      positional: true,
    },
    count: {
      type: z
        .number()
        .optional()
        .default(5)
        .describe("number of results to return"),
      short: "c",
    },
    format: {
      type: z
        .enum(["json", "text", "table"])
        .default("text")
        .describe("output format"),
      short: "f",
    },
  },
});

// サブコマンドの定義例
const gitSubCommands = createSubCommands({
  add: {
    name: "git add",
    description: "Add files to git staging",
    args: {
      files: {
        type: z.string().array().describe("files to add"),
        positional: true,
      },
      all: {
        type: z.boolean().default(false).describe("add all files"),
        short: "a",
      },
    },
  },
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

// メイン処理
if (import.meta.main) {
  console.log("zodcli モジュールの使用例\n");

  // コマンドラインから実行（基本コマンド）
  console.log("基本コマンドのデモ:");
  if (Deno.args.length > 0) {
    const result = searchCommand.parse(Deno.args);
    run(result, (data) => {
      console.log(
        `Search query: ${data.query}, count: ${data.count}, format: ${data.format}`
      );
    });
  } else {
    // デモンストレーション
    console.log("Generated Help:");
    console.log(searchCommand.helpText);

    console.log("\nSample parse result:");
    const sampleResult = searchCommand.parse([
      "test",
      "--count",
      "10",
      "--format",
      "json",
    ]);
    run(sampleResult);

    // サブコマンドデモ
    console.log("\nサブコマンドデモ:");
    console.log(gitSubCommands.rootHelpText("git", "Git command line tool"));

    const addResult = gitSubCommands.parse(
      ["add", "file1.txt", "file2.txt", "--all"],
      "git",
      "Git command line tool"
    );

    // 新しいrun関数でサブコマンドも処理
    run(addResult, (data, subCommandName) => {
      console.log(`\nサブコマンド [${subCommandName}] 実行中:`);
      if (subCommandName === "add") {
        console.log(
          `ファイル: ${data.files.join(", ")}, 全ファイル追加: ${data.all}`
        );
      } else if (subCommandName === "commit") {
        console.log(`メッセージ: ${data.message}, アメンド: ${data.amend}`);
      }
    });
  }
}
