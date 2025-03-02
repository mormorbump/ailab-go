# TSR (TypeScript Remove)

TypeScript Remove (tsr)
は、TypeScriptプロジェクト内の未使用コード（デッドコード）を検出し、削除するためのユーティリティです。ツリーシェイキングのような機能をソースファイルレベルで提供します。

## インストール

```bash
npm install tsr
```

TypeScriptはピア依存関係です。

## ユースケース

- 大規模なTypeScriptプロジェクトでのデッドコード検出
- PRを作成する前に未使用コードを削除
- CIパイプラインに組み込んで、未使用コードがマージされないようにする
- リファクタリング時に、ロジック更新に集中してコード削除はtsrに任せる

## 基本的な使い方

### CLI

```bash
# src/main.ts をエントリーポイントとして、未使用コードをチェック
npx tsr 'src/main\.ts$'

# 変更を実際に適用する
npx tsr --write 'src/main\.ts$'

# カスタムのtsconfig.jsonを使用
npx tsr --project tsconfig.app.json 'src/main\.ts$'

# 複数のエントリーポイントを指定
npx tsr 'src/pages/.*\.ts$'

# 再帰的に処理して一度で全ての問題を検出
npx tsr --recursive 'src/main\.ts$'

# .d.tsファイルも含める
npx tsr --include-d-ts 'src/main\.ts$'
```

### JavaScript API

```typescript
import { tsr } from "tsr";

// 基本的な使用方法
await tsr({
  entrypoints: [/src\/main\.ts$/],
  mode: "check", // 'check' または 'write'
});

// 詳細なオプションを指定
await tsr({
  entrypoints: [/src\/main\.ts$/],
  mode: "write",
  configFile: "tsconfig.app.json",
  projectRoot: "/path/to/project",
  recursive: true,
  includeDts: true,
});
```

## 設定オプション

```typescript
interface Config {
  // 必須: エントリーポイントのファイルパターン (正規表現の配列)
  entrypoints: RegExp[];

  // 'check'(デフォルト) または 'write'
  // 'check': 変更を表示するだけ
  // 'write': ファイルを実際に修正
  mode?: "check" | "write";

  // プロジェクトのルートパス (デフォルト: 現在の作業ディレクトリ)
  projectRoot?: string;

  // tsconfig.jsonのパス (デフォルト: projectRoot/tsconfig.json)
  configFile?: string;

  // mode: 'write'と同じ
  write?: boolean;

  // 変更後に新たに未使用になったコードを再帰的に検出
  recursive?: boolean;

  // .d.tsファイルも対象に含める
  includeDts?: boolean;
}
```

## スキップタグ

特定の宣言を削除対象から除外するには、コメント `// tsr-skip` を使用します：

```typescript
// tsr-skip
export const keepThisExport = "important";
```

## tsrが行う変更例

### 未使用のエクスポート宣言全体を削除

```diff
 export const usedExport = 'used';
-
-export const unusedExport = 'unused';
```

### 内部で使用されているがエクスポートされていない場合は、exportキーワードのみ削除

```diff
 export const usedExport = 'used';
 
-export const usedInternally = 'internal';
+const usedInternally = 'internal';
 
 export function usesInternal() {
   return usedInternally;
 }
```

### 関連する依存も削除

```diff
-import { someUtil } from './utils';
 
 export const mainFunction = () => {
   return 'main';
 };
-
-export function unusedFunction() {
-  return someUtil();
-}
```

### 使用されなくなったローカル宣言も削除

```diff
 export const mainExport = 'main';
-
-const localVariable = 'local';
-
-export function unusedFunction() {
-  return localVariable;
-}
```

## tsrと他のツールの比較

- **TypeScript** -
  TSの`noUnusedLocals`は、エクスポートされた未使用コードは検出しません
- **ESLint** -
  未使用のインポートは検出できますが、未使用のエクスポートは検出できません
- **Knip** -
  同様のツールですが、tsrは自動編集に特化し、ゼロコンフィグで高速に動作します

## 実際のプロジェクトでの使用例

### モノレポでの使用

Vue.jsのコアリポジトリのような大規模モノレポでの使用例：

```bash
# モノレポのルートで実行
# 複数のパッケージのエントリーポイントを正規表現で指定
npx tsr -p tsconfig.build.json '.+/src/.*(index|runtime|cli)\.ts$'

# 変更を適用
npx tsr -p tsconfig.build.json -w '.+/src/.*(index|runtime|cli)\.ts$'
```

## パフォーマンス

- 大規模プロジェクト（vuejs/core）でも約700ms（Mac mini 2024）で処理可能
- Knipと比較して2.14倍高速（ベンチマーク結果による）
- 最小限の設計と依存関係：インストールサイズは約98kB

## 注意点

- テストファイルは通常エントリーポイントから参照されないため、削除対象になる可能性があります
- TypeScriptの[Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)を使用して、テストとソースコードを分離することを推奨します
- または、テストファイルもエントリーポイントとして指定することで回避できます：
  ```bash
  npx tsr 'src/main\.ts$' '.*\.test\.ts$'
  ```
- tsrはエントリーポイント以外のモジュールに副作用がないと仮定します
- 変更を本番環境にデプロイする前に、コード変更をレビューすることを推奨します
