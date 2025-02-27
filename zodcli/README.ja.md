# @mizchi/zodcli

Zod を使用した型安全なコマンドラインパーサーモジュール

## 概要

ZodCLI は、[Zod](https://github.com/colinhacks/zod) スキーマを使用して型安全なコマンドラインインターフェースを簡単に構築するためのDenoモジュールです。このモジュールを使用することで、コマンドライン引数のパース、バリデーション、ヘルプメッセージの生成を型安全に行うことができます。

## 特徴

- **型安全**: Zodスキーマに基づいた型安全なCLIパーサー
- **自動ヘルプ生成**: コマンド構造から自動的にヘルプテキストを生成
- **位置引数とオプションのサポート**: 位置引数と名前付き引数の両方をサポート
- **サブコマンドのサポート**: gitのようなサブコマンド構造をサポート
- **デフォルト値**: Zodの機能を活用したデフォルト値の設定
- **バリデーション**: Zodスキーマによる強力な入力検証
- **JSONスキーマ変換**: ZodスキーマからJSONスキーマへの変換機能

## インストール

`deno add jsr:@mizchi/zodcli`

```typescript
// deno.json
{
  "imports": {
    "zodcli": "./zodcli/mod.ts"
  }
}
```

または直接インポート:

```typescript
import { createCommand } from "jsr:@mizchi/zodcli";
```

## 基本的な使い方

```typescript
import { createCommand, run } from "./zodcli/mod.ts";
import { z } from "npm:zod";

// コマンドの定義
const searchCommand = createCommand({
  name: "search",
  description: "Search with custom parameters",
  args: {
    query: {
      type: z.string().describe("search query"),
      positional: true,
    },
    count: {
      type: z.number().optional().default(5).describe("number of results"),
      short: "c",
    },
    format: {
      type: z.enum(["json", "text", "table"]).default("text"),
      short: "f",
    },
  },
});

// 引数のパース
const result = searchCommand.parse(Deno.args);

// 結果の処理
run(result, (data) => {
  console.log(`Searching for: ${data.query}, count: ${data.count}, format: ${data.format}`);
  // 実際の処理...
});
```

## サブコマンドの使い方

```typescript
import { createSubCommandMap } from "./zodcli/mod.ts";
import { z } from "npm:zod";

// サブコマンドの定義
const gitCommands = createSubCommandMap({
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

// サブコマンドのパース
const result = gitCommands.parse(Deno.args, "git", "Git command line tool");

// run関数でサブコマンドを含めて一括処理
run(result, (data, subCommandName) => {
  if (subCommandName) {
    console.log(`Running git ${subCommandName}`);
    // サブコマンドごとの処理...
    if (subCommandName === "add") {
      console.log(`Adding files: ${data.files.join(", ")}`);
    } else if (subCommandName === "commit") {
      console.log(`Committing with message: ${data.message}`);
    }
  }
});
```

## サポートされている型

- `z.string()` - 文字列
- `z.number()` - 数値（文字列から自動的に変換）
- `z.boolean()` - 真偽値
- `z.enum()` - 列挙型
- `z.array()` - 配列（位置引数または複数のオプション値）
- `z.optional()` - オプショナル値
- `z.default()` - デフォルト値を持つフィールド

## テスト

```bash
deno test .
```

## 使用例

```bash
# ヘルプの表示
deno run -A zodcli/examples/cli.ts --help

# 検索コマンドの実行
deno run -A zodcli/examples/cli.ts "search query" --count 10 --format json

# サブコマンドの実行
deno run -A zodcli/examples/cli.ts add file1.txt file2.txt --all
```

## ライセンス

MIT