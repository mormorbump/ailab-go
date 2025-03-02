# dax - クロスプラットフォームシェルツール for Deno & Node.js

## 基本情報

- **パッケージ名**: `@david/dax` (JSR), `dax-sh` (npm)
- **作者**: David Sherret
- **GitHubリポジトリ**: [dsherret/dax](https://github.com/dsherret/dax)
- **インスピレーション**: [zx](https://github.com/google/zx)
- **特徴**: クロスプラットフォーム（Windows対応を重視）、最小限のグローバル設定、アプリケーションコードでも使用可能

## インストール

```ts
// Deno
deno add jsr:@david/dax

// または直接インポート
import $ from "jsr:@david/dax";

// Node.js
// npm install dax-sh
// import $ from "dax-sh";
```

## 主な機能

### 1. コマンド実行

```ts
// 基本的なコマンド実行
await $`echo 5`; // outputs: 5

// 出力取得
const text = await $`echo 1`.text(); // 1
const json = await $`echo '{ "prop": 5 }'`.json(); // { prop: 5 }
const lines = await $`echo 1 && echo 2`.lines(); // ["1", "2"]
const bytes = await $`gzip < file.txt`.bytes(); // Uint8Array

// stderr取得
const stderrText = await $`deno eval "console.error(1)"`.text("stderr");

// 詳細情報取得
const result = await $`deno eval 'console.log(1); console.error(2);'`
  .stdout("piped")
  .stderr("piped");
console.log(result.code); // 0
console.log(result.stdout); // 1\n
console.log(result.stderr); // 2\n

// 複合出力取得
const combinedText = await $`deno eval 'console.log(1); console.error(2);'`
  .text("combined"); // 1\n2\n
```

### 2. パイプとリダイレクト

```ts
// stdoutのリダイレクト
await $`echo 1`.stdout(Deno.stderr);

// WritableStreamへのリダイレクト
await $`echo 1`.stdout(someWritableStream, { preventClose: true });
// または
await $`echo 1 > ${someWritableStream}`;

// ファイルへのリダイレクト
await $`echo 1`.stdout($.path("data.txt"));
// または
await $`echo 1 > data.txt`;

// コマンド間のパイプ
const output = await $`echo foo && echo bar`
  .pipe($`grep foo`)
  .text();
// または
const output2 = await $`(echo foo && echo bar) | grep foo`.text();
```

### 3. 引数渡し

```ts
// テンプレートリテラルでの引数渡し（自動エスケープ）
const dirName = "Dir with spaces";
await $`mkdir ${dirName}`; // executes as: mkdir 'Dir with spaces'

// 配列での引数渡し
const dirNames = ["some_dir", "other dir"];
await $`mkdir ${dirNames}`; // executes as: mkdir some_dir 'other dir'

// エスケープなしで引数渡し
const args = "arg1   arg2   arg3";
await $.raw`echo ${args}`; // executes as: echo arg1   arg2   arg3
```

### 4. stdinの制御

```ts
// stdinの設定
await $`command`.stdin("inherit"); // デフォルト
await $`command`.stdin("null");
await $`command`.stdin(new Uint8Array([1, 2, 3, 4]));
await $`command`.stdinText("some value");

// リダイレクト
await $`command < ${$.path("data.json")}`;
```

### 5. 環境変数設定

```ts
// 環境変数の設定
await $`echo $var1 $var2 $var3 $var4`
  .env("var1", "1")
  .env("var2", "2")
  .env({
    var3: "3",
    var4: "4",
  });
```

### 6. 作業ディレクトリ設定

```ts
// コマンド実行時の作業ディレクトリ設定
await $`deno eval 'console.log(Deno.cwd());'`.cwd("./someDir");
```

### 7. コマンド出力の制御

```ts
// コマンド出力の抑制
await $`echo 5`.quiet();
await $`echo 5`.quiet("stdout"); // stdoutのみ抑制
await $`echo 5`.quiet("stderr"); // stderrのみ抑制

// コマンド実行前に表示
await $`echo ${text}`.printCommand();

// グローバル設定
$.setPrintCommand(true);
```

### 8. タイムアウト設定とアボート

```ts
// タイムアウト設定
await $`echo 1 && sleep 100 && echo 2`.timeout("1s");

// コマンドのアボート
const child = $`echo 1 && sleep 100 && echo 2`.spawn();
// 後で
child.kill(); // デフォルトは"SIGTERM"
```

### 9. シェル環境のエクスポート

```ts
// シェル環境を現在のプロセスにエクスポート
await $`cd src && export MY_VALUE=5`.exportEnv();
```

## ログ関連機能

```ts
// 通常ログ
$.log("Hello!");

// 強調ログ
$.logStep("Fetching data from server...");
$.logStep("Setting up", "local directory..."); // 複数の単語をハイライト

// エラーログ（赤色）
$.logError("Error Some error message.");

// 警告ログ（黄色）
$.logWarn("Warning Some warning message.");

// 重要度低いログ（グレー）
$.logLight("Some unimportant message.");

// インデントグループ
await $.logGroup(async () => {
  $.log("This will be indented.");
  await $.logGroup(async () => {
    $.log("This will indented even more.");
  });
});

// ロガーの変更
$.setInfoLogger(console.log);
$.setWarnLogger(console.log);
$.setErrorLogger(console.log);
```

## プロンプトと選択

```ts
// テキスト入力
const name = await $.prompt("What's your name?");

// オプション付き
const nameWithDefault = await $.prompt({
  message: "What's your name?",
  default: "Dax",
  noClear: true, // 結果表示後にテキストを消去しない
});

// マスク付き入力（パスワードなど）
const password = await $.prompt("What's your password?", {
  mask: true,
});

// Yes/No確認
const result = await $.confirm("Would you like to continue?");

// 単一選択
const index = await $.select({
  message: "What's your favourite colour?",
  options: ["Red", "Green", "Blue"],
});

// 複数選択
const indexes = await $.multiSelect({
  message: "Which of the following are days of the week?",
  options: [
    "Monday",
    {
      text: "Wednesday",
      selected: true, // デフォルトで選択
    },
    "Blue",
  ],
});
```

## 進捗表示

```ts
// 不確定進捗
const pb = $.progress("Updating Database");
await pb.with(async () => {
  // 処理
});

// 確定進捗
const items = [/* ... */];
const pb = $.progress("Processing Items", {
  length: items.length,
});
await pb.with(async () => {
  for (const item of items) {
    await doWork(item);
    pb.increment(); // または pb.position(val)
  }
});

// 同期処理での強制更新
pb.with(() => {
  for (const item of items) {
    doWork(item);
    pb.increment();
    pb.forceRender(); // 強制的に進捗バーを更新
  }
});
```

## パスAPI

```ts
// Pathオブジェクト作成
let srcDir = $.path("src");

// パス情報取得
srcDir.isDirSync(); // false

// アクション実行
await srcDir.mkdir();
srcDir.isDirSync(); // true

// パス解決
srcDir.isRelative(); // true
srcDir = srcDir.resolve(); // 絶対パスに解決
srcDir.isAbsolute(); // true

// パスの結合と操作
const textFile = srcDir.join("subDir").join("file.txt");
textFile.writeTextSync("some text");
console.log(textFile.readTextSync()); // "some text"

// JSON操作
const jsonFile = srcDir.join("otherDir", "file.json");
jsonFile.writeJsonSync({
  someValue: 5,
});
console.log(jsonFile.readJsonSync().someValue); // 5
```

## その他のヘルパー機能

```ts
// 作業ディレクトリ変更
$.cd("someDir");
$.cd(import.meta); // 現在のスクリプトディレクトリへ

// スリープ
await $.sleep(100); // ms
await $.sleep("1.5s");
await $.sleep("1m30s");

// 実行可能ファイルのパス取得
console.log(await $.which("deno"));

// コマンド存在確認
console.log(await $.commandExists("deno"));
console.log($.commandExistsSync("deno"));

// リトライ機能
await $.withRetries({
  count: 5,
  delay: "5s",
  action: async () => {
    await $`cargo publish`;
  },
});

// インデント除去
console.log($.dedent`
    This line will appear without any indentation.
      * This list will appear with 2 spaces more than previous line.
`);

// ANSI制御文字除去
$.stripAnsi("\u001B[4mHello World\u001B[0m"); // 'Hello World'
```

## HTTPリクエスト

```ts
// JSONファイルのダウンロード
const data = await $.request("https://plugins.dprint.dev/info.json").json();

// テキストファイルのダウンロード
const text = await $.request("https://example.com").text();

// 詳細レスポンス
const response = await $.request("https://plugins.dprint.dev/info.json");
console.log(response.code);
console.log(await response.json());

// リクエストをコマンドにパイプ
const request = $.request("https://plugins.dprint.dev/info.json");
await $`deno run main.ts`.stdin(request);

// リダイレクト構文
await $`sleep 5 && deno run main.ts < ${request}`;

// 進捗表示付きダウンロード
const url = "https://dl.deno.land/release/v1.29.1/deno-x86_64-unknown-linux-gnu.zip";
const downloadPath = await $.request(url)
  .showProgress()
  .pipeToPath();
```

## シェル機能

```ts
// 連続コマンド実行（;）
const result = await $`cd someDir ; deno eval 'console.log(Deno.cwd())'`;

// 論理リスト（&& と ||）
await $`echo 1 && echo 2`; // 1\n2\n
await $`echo 1 || echo 2`; // 1\n

// パイプ
await $`echo 1 | deno run main.ts`;

// リダイレクト
await $`echo 1 > output.txt`;
const gzippedBytes = await $`gzip < input.txt`.bytes();

// サブシェル
await $`(echo 1 && echo 2) > output.txt`;

// シェル変数（エクスポートされない）
await $`test=123 && deno eval 'console.log(Deno.env.get("test"))' && echo $test`;

// 環境変数（エクスポートされる）
await $`export test=123 && deno eval 'console.log(Deno.env.get("test"))' && echo $test`;
```

## カスタムクロスプラットフォームシェルコマンド

daxには以下のクロスプラットフォームコマンドが実装されています：

- `cd` - ディレクトリ変更
- `echo` - テキスト出力
- `exit` - 終了
- `cp` - ファイルコピー
- `mv` - ファイル移動
- `rm` - ファイル/ディレクトリ削除
- `mkdir` - ディレクトリ作成
- `pwd` - 現在のディレクトリ表示
- `sleep` - 一時停止
- `test` - テスト
- `touch` - ファイル作成
- `unset` - 環境変数削除
- `cat` - ファイル内容表示
- `printenv` - 環境変数表示
- `which` - 実行可能ファイルのパス解決

## ビルダーAPI

daxはイミュータブルなビルダーAPIを提供します。これらは内部的に使用されるものですが、特定の設定を再利用するのに便利です。

### CommandBuilder

```ts
import { CommandBuilder } from "@david/dax";

const commandBuilder = new CommandBuilder()
  .cwd("./subDir")
  .stdout("inheritPiped")
  .noThrow();

const result = await commandBuilder
  .command("deno run my_script.ts")
  .spawn();
```

### RequestBuilder

```ts
import { RequestBuilder } from "@david/dax";

const requestBuilder = new RequestBuilder()
  .header("SOME_VALUE", "some value to send in a header");

const result = await requestBuilder
  .url("https://example.com")
  .timeout("10s")
  .text();
```

### カスタム$

```ts
import { build$, CommandBuilder, RequestBuilder } from "@david/dax";

// カスタム$の作成
const $ = build$({
  commandBuilder: new CommandBuilder()
    .cwd("./subDir")
    .env("HTTPS_PROXY", "some_value"),
  requestBuilder: new RequestBuilder()
    .header("SOME_NAME", "some value"),
  extras: {
    add(a: number, b: number) {
      return a + b;
    },
  },
});

// カスタム関数の使用
console.log($.add(1, 2)); // 3
```

## zxとの違い

1. クロスプラットフォームシェル
   - Windowsでより多くのコードが動作
   - シェル環境を現在のプロセスにエクスポート可能
   - deno_task_shellのパーサーを使用
   - 共通コマンドが組み込みでWindowsサポートが向上

2. グローバル設定の最小化
   - デフォルトの$インスタンスのみ（使用は任意）

3. 独自CLIなし

4. シェルスクリプトの代替だけでなくアプリケーションコードにも適している

5. 作者の猫にちなんで命名