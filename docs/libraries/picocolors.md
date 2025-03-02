# picocolors チートシート

## 概要

最小かつ最速の端末出力フォーマッティングライブラリ。ANSI
カラーを使用してターミナル出力に色と書式を追加。

```ts
// インストール
// npm install picocolors

// Deno
import pc from "npm:picocolors";

// Node.js
// import pc from "picocolors";
```

## 特徴

- **超軽量**: 依存関係なし、chalk より 14 倍小さく 2 倍高速（~7KB）
- **広い互換性**: Node.js v6+ およびブラウザをサポート（CJS/ESM 両対応）
- **TypeScript 対応**: 型定義ファイル同梱
- **[NO_COLOR](https://no-color.org/) 対応**: 環境に応じて自動的に色出力を調整
- PostCSS、SVGO、Stylelint、Next.js など多数のプロジェクトで採用

## 基本的な使い方

```ts
import pc from "picocolors";

// 単一の色/スタイル
console.log(pc.red("エラーが発生しました"));
console.log(pc.bold("重要なメッセージ"));

// 複数スタイルの組み合わせ
console.log(pc.bold(pc.blue("重要な通知")));
console.log(pc.green(`成功: ${pc.bold("タスク完了")}`));

// 背景色
console.log(pc.bgYellow(pc.black("警告")));
```

## 使用可能な色と書式

### テキスト色

| 関数      | 説明               | 例                       |
| --------- | ------------------ | ------------------------ |
| `black`   | 黒色テキスト       | `pc.black("テキスト")`   |
| `red`     | 赤色テキスト       | `pc.red("テキスト")`     |
| `green`   | 緑色テキスト       | `pc.green("テキスト")`   |
| `yellow`  | 黄色テキスト       | `pc.yellow("テキスト")`  |
| `blue`    | 青色テキスト       | `pc.blue("テキスト")`    |
| `magenta` | マゼンタ色テキスト | `pc.magenta("テキスト")` |
| `cyan`    | シアン色テキスト   | `pc.cyan("テキスト")`    |
| `white`   | 白色テキスト       | `pc.white("テキスト")`   |
| `gray`    | グレー色テキスト   | `pc.gray("テキスト")`    |

### 明るいテキスト色（Bright variants）

| 関数            | 説明                     | 例                             |
| --------------- | ------------------------ | ------------------------------ |
| `blackBright`   | 明るい黒色テキスト       | `pc.blackBright("テキスト")`   |
| `redBright`     | 明るい赤色テキスト       | `pc.redBright("テキスト")`     |
| `greenBright`   | 明るい緑色テキスト       | `pc.greenBright("テキスト")`   |
| `yellowBright`  | 明るい黄色テキスト       | `pc.yellowBright("テキスト")`  |
| `blueBright`    | 明るい青色テキスト       | `pc.blueBright("テキスト")`    |
| `magentaBright` | 明るいマゼンタ色テキスト | `pc.magentaBright("テキスト")` |
| `cyanBright`    | 明るいシアン色テキスト   | `pc.cyanBright("テキスト")`    |
| `whiteBright`   | 明るい白色テキスト       | `pc.whiteBright("テキスト")`   |

### 背景色

| 関数        | 説明           | 例                         |
| ----------- | -------------- | -------------------------- |
| `bgBlack`   | 黒色背景       | `pc.bgBlack("テキスト")`   |
| `bgRed`     | 赤色背景       | `pc.bgRed("テキスト")`     |
| `bgGreen`   | 緑色背景       | `pc.bgGreen("テキスト")`   |
| `bgYellow`  | 黄色背景       | `pc.bgYellow("テキスト")`  |
| `bgBlue`    | 青色背景       | `pc.bgBlue("テキスト")`    |
| `bgMagenta` | マゼンタ色背景 | `pc.bgMagenta("テキスト")` |
| `bgCyan`    | シアン色背景   | `pc.bgCyan("テキスト")`    |
| `bgWhite`   | 白色背景       | `pc.bgWhite("テキスト")`   |

### 明るい背景色（Bright variants）

| 関数              | 説明                 | 例                               |
| ----------------- | -------------------- | -------------------------------- |
| `bgBlackBright`   | 明るい黒色背景       | `pc.bgBlackBright("テキスト")`   |
| `bgRedBright`     | 明るい赤色背景       | `pc.bgRedBright("テキスト")`     |
| `bgGreenBright`   | 明るい緑色背景       | `pc.bgGreenBright("テキスト")`   |
| `bgYellowBright`  | 明るい黄色背景       | `pc.bgYellowBright("テキスト")`  |
| `bgBlueBright`    | 明るい青色背景       | `pc.bgBlueBright("テキスト")`    |
| `bgMagentaBright` | 明るいマゼンタ色背景 | `pc.bgMagentaBright("テキスト")` |
| `bgCyanBright`    | 明るいシアン色背景   | `pc.bgCyanBright("テキスト")`    |
| `bgWhiteBright`   | 明るい白色背景       | `pc.bgWhiteBright("テキスト")`   |

### テキスト書式

| 関数            | 説明                                 | 例                             |
| --------------- | ------------------------------------ | ------------------------------ |
| `bold`          | 太字                                 | `pc.bold("テキスト")`          |
| `dim`           | 薄い文字                             | `pc.dim("テキスト")`           |
| `italic`        | イタリック体                         | `pc.italic("テキスト")`        |
| `underline`     | 下線                                 | `pc.underline("テキスト")`     |
| `inverse`       | 反転（背景色とテキスト色を入れ替え） | `pc.inverse("テキスト")`       |
| `hidden`        | 非表示                               | `pc.hidden("テキスト")`        |
| `strikethrough` | 取り消し線                           | `pc.strikethrough("テキスト")` |
| `reset`         | スタイルをリセット                   | `pc.reset("テキスト")`         |

## ユーティリティ

### 色サポートの確認

```ts
import pc from "picocolors";

if (pc.isColorSupported) {
  console.log(pc.green("カラー出力がサポートされています"));
} else {
  console.log("カラー出力がサポートされていません");
}
```

### カスタム色サポート設定

```ts
import pc from "picocolors";

// 色出力を強制的に無効化
const noColors = pc.createColors(false);
console.log(noColors.red("このテキストは赤くなりません"));

// 環境変数や条件に基づいた色出力設定
const customColors = pc.createColors(process.env.FORCE_COLOR === "1");
console.log(customColors.green("条件付きカラー"));

// 部分的にAPI取得
const { red, blue, bold } = pc.createColors(true);
console.log(red(bold("重要なエラー")));
```

## 実用的な例

### ログレベルの実装

```ts
import pc from "picocolors";

function log(message, level = "info") {
  const timestamp = new Date().toISOString();
  const prefix = pc.dim(`[${timestamp}]`);

  switch (level) {
    case "success":
      console.log(`${prefix} ${pc.green("✓")} ${message}`);
      break;
    case "info":
      console.log(`${prefix} ${pc.blue("ℹ")} ${message}`);
      break;
    case "warn":
      console.log(`${prefix} ${pc.yellow("⚠")} ${pc.yellow(message)}`);
      break;
    case "error":
      console.log(`${prefix} ${pc.red("✗")} ${pc.red(pc.bold(message))}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

log("処理を開始しました");
log("タスクが完了しました", "success");
log("設定が見つかりません", "warn");
log("接続エラーが発生しました", "error");
```

### CLIプログレス表示

```ts
import pc from "picocolors";

function showProgress(percent) {
  const width = 30;
  const completed = Math.floor(width * (percent / 100));
  const remaining = width - completed;

  const bar = pc.green("█".repeat(completed)) +
    pc.dim("░".repeat(remaining));

  const percentText = percent.toFixed(1).padStart(5);

  process.stdout.write(`\r${bar} ${pc.bold(percentText)}%`);

  if (percent >= 100) {
    process.stdout.write("\n");
  }
}

// 使用例
let progress = 0;
const interval = setInterval(() => {
  progress += 5;
  showProgress(progress);

  if (progress >= 100) {
    clearInterval(interval);
    console.log(pc.green(pc.bold("✓") + " 完了しました"));
  }
}, 100);
```

## chalk からの移行

```ts
// chalk
import chalk from "chalk";
console.log(chalk.red.bold("Hello world"));

// picocolors
import pc from "picocolors";
console.log(pc.red(pc.bold("Hello world")));
```

より詳細な移行については
[colorize-template](https://github.com/usmanyunusov/colorize-template)
の使用を検討してください。

## 参考リンク

- [GitHub](https://github.com/alexeyraspopov/picocolors)
- [npm](https://www.npmjs.com/package/picocolors)
