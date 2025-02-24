# Deno + AI Experimental Code Generation

このプロジェクトは、Denoとコーディングエージェント（AI）を組み合わせた実験的なコード生成プロジェクトです。

## 概要

このプロジェクトでは、以下のような実験的な取り組みを行っています：

- TypeScriptコードの型推論と構造解析
- AIによるコード生成とリファクタリング
- スクリプトモードからモジュールモードへの段階的な開発手法

## 開発モード

### 1. スクリプトモード

単一ファイルで完結する実験的な実装モードです。

特徴：
- `@script` タグによるモード指定
- 外部依存を最小限に抑える
- テストコードを同一ファイル内に記述
- 即座に実行可能な形式

例（`scripts/math.ts`）:
```ts
/* @script */
/**
 * 数値計算を行うモジュール
 */
function add(a: number, b: number): number {
  return a + b;
}

// エントリーポイント
if (import.meta.main) {
  console.log(add(1, 2));
}

// テストコード
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("add(1, 2) = 3", () => {
  expect(add(1, 2), "sum 1 + 2").toBe(3);
});
```

実行方法：
```bash
# 実行
deno run scripts/math.ts

# テスト
deno test scripts/math.ts
```

### 2. テストファーストモード（TDD）

型シグネチャとテストを先に書き、実装を後から行うモードです。

特徴：
- `@tdd` タグによるモード指定
- 型シグネチャを先に定義
- テストケースを事前に記述
- 実装の方向性を事前に確認

例（`scripts/tdd-mode.ts`）:
```ts
// @script @tdd
/**
 * 数値の配列から最大値を求める関数
 */
declare function findMax(numbers: number[]): number;

import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("findMax", () => {
  expect(findMax([1, 2, 3])).toBe(3);
  expect(findMax([-1, -2, -3])).toBe(-1);
});
```

### 3. モジュールモード

複数のファイルで構成される本番向けの実装モードです。

特徴：
- 明確なモジュール境界
- 依存関係の一元管理
- テストの分離
- 型定義の集約

例（`type-predictor/`）:
```
type-predictor/
  ├── mod.ts           # Public API
  ├── deps.ts          # Dependencies
  ├── predict.ts       # Core implementation
  ├── schema.ts        # Type definitions
  ├── types.ts         # Common types
  └── predict.test.ts  # Tests
```

モジュールの実装例：
```ts
// mod.ts - Public API
export { predict } from "./predict.ts";
export type { PredictResult } from "./types.ts";

// deps.ts - Dependencies
export { z } from "npm:zod";

// predict.ts - Implementation
import { z } from "./deps.ts";
import type { PredictResult } from "./types.ts";

export function predict(input: unknown): PredictResult {
  // 実装
}
```

テスト実行：
```bash
# モジュール全体のテスト
deno test type-predictor/

# 特定のテストファイル
deno test type-predictor/predict.test.ts
```

## プロジェクト構造

```
.
├── scripts/          # 実験的なスクリプト
│   ├── math.ts
│   ├── tdd-mode.ts
│   └── ...
├── type-predictor/   # 型推論モジュール
│   ├── mod.ts
│   ├── deps.ts
│   └── ...
├── docs/            # ドキュメント
└── prompts/         # AIプロンプトルール
```

## 開発フロー

1. スクリプトモードでプロトタイプ開発
   - アイデアの素早い検証
   - 単一ファイルでの実装
   - インラインテストによる動作確認

2. テストファーストモードでの設計
   - 型シグネチャの定義
   - テストケースの作成
   - 実装方針の確認

3. モジュールへのリファクタリング
   - 責務の分割
   - テストの分離
   - 型定義の整理
   - 依存関係の管理

## ライセンス

MIT