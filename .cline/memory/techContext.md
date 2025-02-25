# 技術コンテキスト

## 使用されている技術

### コア技術

1. **Deno**
   - バージョン: 最新安定版
   - TypeScript のネイティブサポート
   - 組み込みのセキュリティ機能
   - 標準ライブラリの活用

2. **TypeScript**
   - 静的型付け
   - 型推論と型チェック
   - インターフェースと型定義
   - ジェネリクスの活用

3. **Zod**
   - スキーマ検証
   - ランタイム型チェック
   - 型推論との連携

4. **Neverthrow**
   - Result 型によるエラー処理
   - 型安全なエラーハンドリング
   - モナディックな操作

### テスト技術

1. **Deno 標準テストライブラリ**
   - `@std/expect`: アサーションライブラリ
   - `@std/testing/bdd`: BDD スタイルのテスト
   - テストカバレッジ計測

### ビルドとツール

1. **Deno タスクランナー**
   - `deno.json` での定義
   - スクリプト実行の自動化

2. **GitHub Actions**
   - CI/CD パイプライン
   - 自動テストと検証
   - コード品質チェック

## 開発環境のセットアップ

### 必要なツール

1. **Deno のインストール**
   ```bash
   # Unix (macOS, Linux)
   curl -fsSL https://deno.land/x/install/install.sh | sh

   # Windows (PowerShell)
   iwr https://deno.land/x/install/install.ps1 -useb | iex
   ```

2. **エディタ設定**
   - VSCode + Deno 拡張機能
   - 設定例:
     ```json
     {
       "deno.enable": true,
       "deno.lint": true,
       "deno.unstable": false,
       "editor.formatOnSave": true,
       "editor.defaultFormatter": "denoland.vscode-deno"
     }
     ```

3. **プロジェクトのセットアップ**
   ```bash
   # リポジトリのクローン
   git clone <repository-url>
   cd <repository-directory>

   # 依存関係のキャッシュ
   deno cache --reload deps.ts

   # ルールとモードの生成
   deno run --allow-read --allow-write .cline/build.ts
   ```

### 開発ワークフロー

1. **新しいスクリプトの作成**
   ```bash
   # スクリプトモードでの開発
   touch scripts/new-script.ts
   # ファイル冒頭に `@script` を追加
   ```

2. **テストの実行**
   ```bash
   # 単一ファイルのテスト
   deno test scripts/new-script.ts

   # すべてのテストの実行
   deno test

   # カバレッジの計測
   deno test --coverage=coverage && deno coverage coverage
   ```

3. **リントとフォーマット**
   ```bash
   # リント
   deno lint

   # フォーマット
   deno fmt
   ```

4. **依存関係の検証**
   ```bash
   deno task check:deps
   ```

## 技術的制約

1. **Deno の制約**
   - パーミッションモデル（明示的な権限付与が必要）
   - Node.js モジュールとの互換性の問題
   - 一部のブラウザ API の制限

2. **パフォーマンスの制約**
   - 大規模な JSON データ処理時のメモリ使用量
   - 型予測の計算コスト
   - 循環参照の検出と処理

3. **テストの制約**
   - モックとスタブの作成の複雑さ
   - 外部 API のテスト
   - 非同期処理のテスト

## 依存関係

### 主要な依存関係

1. **標準ライブラリ**
   - `@std/expect`: テストアサーション
   - `@std/testing/bdd`: BDD スタイルのテスト
   - `@std/fs`: ファイルシステム操作

2. **外部ライブラリ**
   - `npm:neverthrow`: Result 型によるエラー処理
   - `npm:zod`: スキーマ検証
   - `jsr:@david/dax`: シェルコマンド実行

### 依存関係管理

1. **deps.ts パターン**
   ```typescript
   // deps.ts の例
   export { expect } from "@std/expect";
   export { test } from "@std/testing/bdd";
   export { Result, ok, err } from "npm:neverthrow";
   export { z } from "npm:zod";
   ```

2. **バージョン管理**
   - 明示的なバージョン指定
   - `deno.lock` ファイルによるロック
   - 定期的な依存関係の更新

3. **依存関係の優先順位**
   - `jsr:` のバージョン固定
   - `jsr:` (バージョン指定なし)
   - `npm:`
   - `https://deno.land/x/*` (代替がない場合のみ)

## 技術的な意思決定

1. **Deno の採用理由**
   - TypeScript のネイティブサポート
   - セキュリティ機能の組み込み
   - 依存関係の明示的な管理
   - 標準ライブラリの充実

2. **Result 型の採用理由**
   - 例外に頼らない型安全なエラー処理
   - エラーケースの明示的な処理
   - コンパイル時のエラーチェック

3. **アダプターパターンの採用理由**
   - 外部依存の抽象化
   - テスト容易性の向上
   - 実装の詳細の隠蔽

4. **テストファーストアプローチの採用理由**
   - 設計の明確化
   - バグの早期発見
   - リファクタリングの安全性