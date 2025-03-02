# zodcli; Deno 用の 型安全なCLIパーサー

`zodcli`は[Zod](https://github.com/colinhacks/zod)の型定義とバリデーション機能を活用した、型安全なコマンドラインパーサーです。

https://jsr.io/@mizchi/zodcli

Deno でAI生成用のコマンドを作りまくっており、そのための CLI
引数パーサが必要で、大部分は AIに書かせて、自分でリファクタしました。

## モチベーション

- `node:util` の parseArgs はどこでも使えて便利だが、 Optional
  の推論に弱く、デフォルトがない
- `cmd-ts`
  の自動ヘルプ生成とサブコマンドの生成は便利だが、独自DSLがあんまりうれしくない

内部実装は `parseArgs`のまま、 zod
の推論が効くインターフェースを当てました。気が向いたら node
用に作ります。入力はただの `string[]` なので。。。

## 基本的な使い方

```bash
# インストール
deno add jsr:@mizchi/zodcli
```

```typescript
// 基本的な使い方
// パーサーの定義
const searchParser = createParser({
  name: "search",
  description: "Search files in directory",
  args: {
    // 名前付き位置引数
    query: {
      type: z.string().describe("search pattern"),
      positional: 0, // 0番目の引数
    },
    // 残り全部
    restAll: {
      type: z.array(z.string()),
      positional: "...", //rest parameter
    },
    // オプション引数（デフォルト値あり）
    path: {
      type: z.string().default("./").describe("target directory"),
      short: "p", // shortname
      default: ".",
    },
    recursive: {
      type: z.boolean().default(false).describe("search recursively"),
      short: "r", // --recursive または -r で有効化
    },
  },
});

// help の表示
console.log(searchParser.help());
/**
 * $ deno run -A zodcli/examples/usage.ts
search
> Search files in directory

ARGUMENTS:
  <query:str> - search pattern

  ...<restAll:str[][]> - rest arguments

OPTIONS:
  --query <str> - search pattern
  --path, -p <str> - target directory (default: "./")
  --recursive, -r <bool> - search recursively (default: false)

FLAGS:
  --help, -h - show help
 */

const result = searchParser.safeParse(Deno.args);
if (result.ok) {
  console.log("Parsed:", result.data, result.data.restAll, result.data.query);
}
```

`$ deno run cli.ts xxx bar -q 1` みたいにポジショナルな引数をバリデートします。

default 引数
