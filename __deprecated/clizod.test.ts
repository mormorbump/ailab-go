/* @script */
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import {
  type CommandDef,
  createCliCommand,
  createSubCommandMap,
  parseArgsToValues,
  type QueryBase,
  type SubCommandMap,
  zodToJsonSchema,
} from "./clizod.ts";
import { z } from "npm:zod";

// サンプルの引数定義
const testQueryDef = {
  input: {
    type: z.string().describe("input file path"),
    positional: true,
  },
  output: {
    type: z.string().optional().describe("output file path"),
    short: "o",
  },
  verbose: {
    type: z.boolean().default(false).describe("enable verbose output"),
    short: "v",
  },
  mode: {
    type: z
      .enum(["sync", "async", "stream"])
      .default("sync")
      .describe("processing mode"),
    short: "m",
  },
  count: {
    type: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("number of items to process"),
    short: "c",
  },
} as const satisfies Record<string, QueryBase<any>>;

// 複数の位置引数を持つ引数定義
const multiPositionalQueryDef = {
  source: {
    type: z.string().describe("source file path"),
    positional: true,
  },
  destination: {
    type: z.string().describe("destination file path"),
    positional: true,
  },
  options: {
    type: z.string().optional().describe("additional options"),
    positional: true,
  },
  force: {
    type: z.boolean().default(false).describe("force overwrite"),
    short: "f",
  },
} as const satisfies Record<string, QueryBase<any>>;

// サンプルのコマンド定義
const processCommand: CommandDef<typeof testQueryDef> = {
  name: "process",
  description: "Process files with various options",
  args: testQueryDef,
};

// サンプルのサブコマンド定義
const gitCommands: SubCommandMap = {
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
};

// CLI コマンドの作成
const command = createCliCommand(processCommand);

// サブコマンドの作成
const subCommands = createSubCommandMap(gitCommands);

// JSONスキーマのテスト
test("JSONスキーマの生成", () => {
  const jsonSchema = command.jsonSchema;

  // 型が正しいか確認
  expect(jsonSchema.type).toBe("object");

  // プロパティが正しいか確認
  expect(jsonSchema.properties?.input).toEqual(
    expect.objectContaining({
      type: "string",
      description: "input file path",
    }),
  );

  // required が正しいか確認（オプショナルな項目は含まれない）
  expect(jsonSchema.required).toEqual(["input"]);

  // デフォルト値が正しいか確認
  expect(jsonSchema.properties?.mode).toEqual(
    expect.objectContaining({
      default: "sync",
      enum: ["sync", "async", "stream"],
    }),
  );
});

// 単純なzodスキーマのJSONスキーマ変換テスト
test("基本的なzodスキーマのJSONスキーマ変換", () => {
  const stringSchema = zodToJsonSchema(z.string().describe("テスト"));
  expect(stringSchema.type).toBe("string");
  expect(stringSchema.description).toBe("テスト");

  const numberSchema = zodToJsonSchema(z.number().min(5));
  expect(numberSchema.type).toBe("number");

  const boolSchema = zodToJsonSchema(z.boolean());
  expect(boolSchema.type).toBe("boolean");

  const enumSchema = zodToJsonSchema(z.enum(["a", "b", "c"]));
  expect(enumSchema.type).toBe("string");
  expect(enumSchema.enum).toEqual(["a", "b", "c"]);

  const arraySchema = zodToJsonSchema(z.array(z.string()));
  expect(arraySchema.type).toBe("array");
  expect((arraySchema.items as any).type).toBe("string");
});

// ヘルプテキストのテスト
test("ヘルプテキストの生成", () => {
  const helpText = command.helpText;

  // ヘルプテキストに重要な情報が含まれているか確認
  [
    "process",
    "Process files with various options",
    "ARGUMENTS:",
    "<input:str>",
    "OPTIONS:",
    "--output",
    "--verbose",
    "--mode",
    "--count",
    "FLAGS:",
    "--help",
  ].forEach((text) => {
    expect(helpText).toContain(text);
  });
});

// コマンドパースのテスト
test("コマンド引数のパース", () => {
  // 引数を指定してパース
  const result = command.parse([
    "input.txt",
    "--output",
    "output.txt",
    "--mode",
    "async",
  ]);

  // 成功結果であることを確認
  expect(result.type).toBe("success");

  if (result.type === "success") {
    // パース結果が正しいか確認
    expect(result.data.input).toBe("input.txt");
    expect(result.data.output).toBe("output.txt");
    expect(result.data.mode).toBe("async");
    expect(result.data.verbose).toBe(false); // デフォルト値
    expect(result.data.count).toBe(10); // デフォルト値
  }
});

// ヘルプフラグのテスト
test("ヘルプフラグの処理", () => {
  // ヘルプフラグでパース
  const result = command.parse(["--help"]);

  // ヘルプ結果であることを確認
  expect(result.type).toBe("help");

  if (result.type === "help") {
    // helpTextが存在することを確認
    expect(result.helpText).toBeDefined();
  }
});

// バリデーションエラーのテスト
test("バリデーションエラーの処理", () => {
  // 無効な値でパース（countが許容範囲外）
  const result = command.parse(["input.txt", "--count", "0"]);

  // エラー結果であることを確認
  expect(result.type).toBe("error");

  if (result.type === "error") {
    // ZodErrorであることを確認
    expect(result.error instanceof z.ZodError).toBe(true);
  }
});

// 複数の位置引数のテスト
test("複数の位置引数が正しくマッピングされるか", () => {
  // 位置引数を模擬
  const parseResult = {
    values: { force: true },
    positionals: ["source.txt", "dest.txt", "compress"],
  };

  const args = parseArgsToValues(parseResult, multiPositionalQueryDef);

  // 各位置引数が正しい順序でマッピングされているか確認
  expect(args.source).toBe("source.txt");
  expect(args.destination).toBe("dest.txt");
  expect(args.options).toBe("compress");
  expect(args.force).toBe(true);
});

// 位置引数が足りない場合のテスト
test("位置引数が足りない場合は undefined または デフォルト値になる", () => {
  // 一部の位置引数のみ提供
  const parseResult = {
    values: {},
    positionals: ["source.txt"],
  };

  const args = parseArgsToValues(parseResult, multiPositionalQueryDef);

  // 提供された位置引数はマッピングされ、残りはundefinedになる
  expect(args.source).toBe("source.txt");
  expect(args.destination).toBeUndefined();
  expect(args.options).toBeUndefined();
  // force はデフォルト値を持つので false になる
  expect(args.force).toBe(false);
});

// サブコマンドのテスト
test("サブコマンドのパース", () => {
  // サブコマンドを指定してパース
  const result = subCommands.parse(["add", "file1.txt", "file2.txt", "--all"]);

  // サブコマンド結果であることを確認
  expect(result.type).toBe("subcommand");

  if (result.type === "subcommand") {
    // サブコマンド名が正しいか確認
    expect(result.name).toBe("add");

    // サブコマンドの結果が成功であることを確認
    expect(result.result.type).toBe("success");

    if (result.result.type === "success") {
      // サブコマンドのパース結果が正しいか確認
      expect(Array.isArray(result.result.data.files)).toBe(true);
      expect(result.result.data.files).toEqual(["file1.txt", "file2.txt"]);
      expect(result.result.data.all).toBe(true);
    }
  }
});

// 不明なサブコマンドのテスト
test("不明なサブコマンドのエラー処理", () => {
  // 不明なサブコマンドでパース
  const result = subCommands.parse(["unknown"]);

  // エラー結果であることを確認
  expect(result.type).toBe("error");
});

// サブコマンドのヘルプテキスト
test("サブコマンドのヘルプテキスト", () => {
  const helpText = subCommands.rootHelpText("git", "Git command line tool");

  // ヘルプテキストに重要な情報が含まれているか確認
  expect(helpText).toContain("git");
  expect(helpText).toContain("Git command line tool");
  expect(helpText).toContain("SUBCOMMANDS:");
  expect(helpText).toContain("add");
  expect(helpText).toContain("commit");
});
