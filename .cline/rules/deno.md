## Deno の使い方について

### npm 互換モード

私は Deno の Node 互換APIが使えます。

npm のライブラリを参照できる。`npm:zod` のように npm
からライブラリを参照します。

### 外部ライブラリの使用方法

deno 用のライブラリは多くないので、ユーザーから指定されない限りは node
互換APIを優先します。

例外的に、以下のURLは node より Deno 互換を優先して使用します。

- `jsr:@david/dax`: コマンドランナー
- `jsr:@std/expect`: アサーション
- `jsr:@std/testing`: テストフレームワーク

コードを書き始めるにあたって `docs/libraries/*`
の下に該当するドキュメントがある場合、ライブラリを使用する前に、これを読み込みます。

docs/librarise にドキュメントが存在しないとき

- `jsr:` の場合、 `deno doc jsr:@scope/pkgName`
  で、ライブラリ基本的なAPIをを確認します。
- `npm:` の場合、`npm-summary pkgName`
  でライブラリの要約を確認することができます。

ライブラリを追加するとき、 deno.json にすでに import
されていないか確認します。存在しない場合、 `deno add ...` で追加してください

### ソースコード内のモジュールの参照方法

自分のディレクトリ以外のソースコードを確認する時は、 `deno doc ../foo/mod.ts`
のように型定義だけを確認する。

### テストの書き方

`@std/expect` と `@std/testing/bdd` を使う。 とくに実装上の理由がない限り、
`describe` による入れ子はしない。

```ts
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("2+3=5", () => {
  expect(add(2, 3), "sum of numbers").toBe(5);
});
```

アサーションの書き方

- `expect(result, "<expected behavior>").toBe("result")`
  で可能な限り期待する動作を書く

### モジュール間の依存関係

### import ルール

- モジュール間の参照は必ず mod.ts を経由する
- 他のモジュールのファイルを直接参照してはいけない
- 同一モジュール内のファイルは相対パスで参照する
- モジュール内の実装は deps.ts からの re-export を参照する

### 依存関係の検証

依存関係の検証には2つの方法がある

1. コマンドラインでの検証

```bash
deno task check:deps
```

このコマンドは以下をチェックする

- モジュール間の import が mod.ts を経由しているか
- 他のモジュールのファイルを直接参照していないか

2. リントプラグインによる検証

```bash
deno lint
```

mod-import リントルールが以下をチェックする：

- モジュール間の import が mod.ts を経由しているか
- 違反している場合、修正のヒントを提示

リントプラグインは IDE
と統合することで、コーディング時にリアルタイムでフィードバックを得ることができる。

### コード品質の監視

### カバレッジ

カバレッジの取得には `deno task test:cov`
を使用する。これは以下のコマンドのエイリアス：

```bash
deno test --coverage=coverage && deno coverage coverage
```

実行コードと純粋な関数を分離することで、高いカバレッジを維持する：

- 実装（lib.ts）: ロジックを純粋な関数として実装
- エクスポート（mod.ts）: 外部向けインターフェースの定義
- 実行（cli.ts）: エントリーポイントとデバッグコード

### デッドコード解析

- TSR (TypeScript Runtime) を使用してデッドコードを検出
- 未使用のエクスポートや関数を定期的に確認し削除

### 型定義による仕様抽出

- dts を使用して型定義から自動的にドキュメントを生成
- 型シグネチャに仕様を記述し、dts として抽出する
