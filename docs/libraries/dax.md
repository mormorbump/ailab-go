# dax チートシート

## 概要

Deno および Node.js 向けのクロスプラットフォームシェルツール。コマンド実行、HTTP
リクエスト、ファイル操作、プロンプト機能などを提供。

```ts
// Deno
import $ from "jsr:@david/dax";

// Node.js
// import $ from "dax-sh";
```

## コマンド実行

### 基本実行

```ts
// 基本実行
await $`echo Hello, world`;

// 出力の取得
const text = await $`echo Hello`.text(); // "Hello"
const json = await $`echo '{"key":"value"}'`.json(); // { key: "value" }
const lines = await $`echo 1 && echo 2`.lines(); // ["1", "2"]
const bytes = await $`cat binary.dat`.bytes(); // Uint8Array

// 詳細な結果
const result = await $`deno eval 'console.log("out"); console.error("err");'`
  .stdout("piped")
  .stderr("piped");
console.log(result.code); // 終了コード (0)
console.log(result.stdout); // 標準出力 ("out\n")
console.log(result.stderr); // 標準エラー出力 ("err\n")

// 非同期実行
const child = $`sleep 10 && echo done`.spawn();
// 後で child.kill() でキャンセル可能
```

### パラメータと変数

```ts
// 変数埋め込み（自動エスケープ）
const dir = "My Dir";
await $`mkdir ${dir}`; // mkdir 'My Dir'

// 配列の展開
const dirs = ["dir1", "dir with space"];
await $`mkdir ${dirs}`; // mkdir dir1 'dir with space'

// エスケープなし
await $.raw`echo $HOME`;

// 環境変数の設定
await $`echo $VAR1 $VAR2`
  .env("VAR1", "value1")
  .env({ VAR2: "value2" });
```

### パイプとリダイレクト

```ts
// パイプ（メソッドチェーン）
const result = await $`echo foo && echo bar`
  .pipe($`grep foo`)
  .text(); // "foo"

// パイプ（シェル構文）
await $`echo foo | grep foo`;

// ファイル出力リダイレクト
await $`echo hello > output.txt`;
// または
await $`echo hello`.stdout($.path("output.txt"));

// ファイル入力リダイレクト
await $`cat < input.txt`;
// または
await $`cat`.stdin($.path("input.txt"));
```

### 実行制御

```ts
// 作業ディレクトリ
await $`pwd`.cwd("./someDir");

// タイムアウト
await $`sleep 100`.timeout("5s");

// 終了コードを無視
await $`exit 1`.noThrow();

// 出力を非表示
await $`echo secret`.quiet();
await $`echo visible && echo secret`.quiet("stderr"); // stderrのみ非表示

// コマンド表示
await $`echo ${secret}`.printCommand();
```

## ファイル操作

### パスAPI

```ts
// パスオブジェクト作成
const path = $.path("dir/file.txt");

// ファイル操作
await path.exists(); // ファイル存在確認
await path.isFile();
await path.isDir();
await path.stat(); // ファイル情報取得

// ファイル読み書き
await path.writeText("content");
const content = await path.readText();
await path.writeJson({ key: "value" });
const data = await path.readJson();
await path.writeBytes(new Uint8Array([1, 2, 3]));
const bytes = await path.readBytes();

// ディレクトリ操作
await $.path("newDir").mkdir({ recursive: true });
await $.path("oldDir").remove({ recursive: true });

// パス情報と操作
path.basename; // "file.txt"
path.dirname; // "dir"
path.extname; // ".txt"
path.isAbsolute(); // 絶対パスか
path.resolve(); // 絶対パスに変換
path.join("subdir", "other.txt"); // 'dir/file.txt/subdir/other.txt'
```

### クロスプラットフォームコマンド

```ts
// ファイル操作
await $`cp source.txt target.txt`; // コピー
await $`mv old.txt new.txt`; // 移動
await $`rm file.txt`; // 削除
await $`cat file.txt`; // 内容表示
await $`touch newfile.txt`; // ファイル作成/更新

// ディレクトリ操作
await $`mkdir -p new/sub/dir`; // ディレクトリ作成
await $`cd dir && pwd`; // ディレクトリ移動と表示
await $`rm -rf dir`; // ディレクトリ削除
```

## HTTPリクエスト

```ts
// 基本リクエスト
const text = await $.request("https://example.com").text();
const json = await $.request("https://api.example.com/data").json();

// リクエスト詳細オプション
const response = await $.request("https://api.example.com/data")
  .method("POST")
  .header("Content-Type", "application/json")
  .body(JSON.stringify({ key: "value" }))
  .timeout("10s");

// 結果取得
console.log(response.status); // ステータスコード
console.log(await response.json()); // レスポンスボディ (JSON)

// 進捗表示付きダウンロード
const filePath = await $.request("https://example.com/large-file.zip")
  .showProgress()
  .pipeToPath(); // 一時ファイルに保存

// リクエストをコマンドにパイプ
const request = $.request("https://example.com/data.json");
await $`jq . < ${request}`; // リクエスト結果をjqに渡す
```

## UI関連機能

### ログ出力

```ts
// 基本ログ
$.log("通常のログメッセージ");
$.logLight("薄い色のログ");
$.logStep("処理ステップを強調");
$.logWarn("警告メッセージ");
$.logError("エラーメッセージ");

// インデントグループ
await $.logGroup(async () => {
  $.log("インデントされたログ");
  await $.logGroup(async () => {
    $.log("さらにインデントされたログ");
  });
});

// インデント除去
$.dedent`
  インデントを保持したまま
  複数行テキストを出力
    インデントの差分は維持
`;
```

### プロンプトと選択

```ts
// テキスト入力
const name = await $.prompt("名前を入力:");
const pass = await $.prompt("パスワード:", { mask: true });

// デフォルト値
const value = await $.prompt({
  message: "値を入力:",
  default: "デフォルト値",
});

// Yes/No確認
if (await $.confirm("続行しますか?")) {
  // 処理続行
}

// 単一選択
const selected = await $.select({
  message: "色を選択:",
  options: ["赤", "緑", "青"],
});

// 複数選択
const selections = await $.multiSelect({
  message: "項目を選択:",
  options: [
    "項目1",
    { text: "項目2", selected: true }, // デフォルト選択
    "項目3",
  ],
});
```

### 進捗表示

```ts
// 不確定進捗
const progress = $.progress("処理中...");
await progress.with(async () => {
  // 長時間処理
  await $.sleep("2s");
});

// 確定進捗
const items = [1, 2, 3, 4, 5];
const pb = $.progress("アイテム処理中", {
  length: items.length,
});

await pb.with(async () => {
  for (const item of items) {
    await processItem(item);
    pb.increment(); // 進捗を+1
  }
});

// 進捗位置を直接設定
pb.position(3); // 3/5
```

## ユーティリティ

```ts
// スリープ
await $.sleep(1000); // ミリ秒
await $.sleep("1.5s"); // 文字列表記
await $.sleep("1m30s"); // 複合表記

// 作業ディレクトリ変更
$.cd("subdir");
$.cd(import.meta); // 現在のスクリプトの場所へ移動

// コマンド存在確認
if (await $.commandExists("git")) {
  // gitコマンドを使用
}

// 実行パス解決
const denoPath = await $.which("deno");

// リトライ処理
await $.withRetries({
  count: 3,
  delay: "2s",
  action: async () => {
    await $`curl https://flaky-api.example.com`;
  },
});

// ANSI制御文字除去
const cleanText = $.stripAnsi("\u001B[31mエラー\u001B[0m"); // "エラー"
```

## カスタム設定

```ts
// ビルダーAPIの使用
import { build$, CommandBuilder, RequestBuilder } from "jsr:@david/dax";

// カスタム$の作成
const myEnv = { API_KEY: "secret" };
const custom$ = build$({
  commandBuilder: new CommandBuilder()
    .cwd("./app")
    .env(myEnv)
    .printCommand()
    .timeout("30s"),

  requestBuilder: new RequestBuilder()
    .header("Authorization", `Bearer ${myEnv.API_KEY}`)
    .timeout("10s"),

  extras: {
    // カスタム関数の追加
    greet(name: string) {
      return `Hello, ${name}!`;
    },
  },
});

// 使用例
await custom$`echo "Working in app directory"`;
console.log(custom$.greet("World")); // "Hello, World!"
```

## 主要なライブラリ違い

| 機能             | dax                                       | zx                         |
| ---------------- | ----------------------------------------- | -------------------------- |
| プラットフォーム | クロスプラットフォーム（Windows対応強化） | 主にUNIX系                 |
| シェル           | カスタム実装（deno_task_shell）           | JavaScriptを拡張したシェル |
| グローバル設定   | 最小限（デフォルト$インスタンスのみ）     | グローバルな環境設定       |
| 使用シーン       | シェルスクリプト代替とアプリコード両方    | 主にシェルスクリプト代替   |
| 主な特徴         | パスAPI、プロンプト、進捗表示             | シェルに近い記法           |

## 参考リンク

- [GitHub](https://github.com/dsherret/dax)
- [JSR パッケージ](https://jsr.io/@david/dax)
- [npm パッケージ](https://www.npmjs.com/package/dax-sh)
