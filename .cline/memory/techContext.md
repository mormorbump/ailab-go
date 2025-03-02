# 技術コンテキスト

## 使用されている技術

### コア技術

1. **Go**
   - バージョン: 1.24.0
   - 静的型付け
   - 並行処理（goroutine、channel）
   - インターフェースによる抽象化
   - 標準ライブラリの活用

2. **Deno** (移行前)
   - バージョン: 最新安定版
   - TypeScript のネイティブサポート
   - 組み込みのセキュリティ機能
   - 標準ライブラリの活用

3. **TypeScript** (移行前)
   - 静的型付け
   - 型推論と型チェック
   - インターフェースと型定義
   - ジェネリクスの活用

4. **Zod** (移行前)
   - スキーマ検証
   - ランタイム型チェック
   - 型推論との連携

5. **Neverthrow** (移行前)
   - Result 型によるエラー処理
   - 型安全なエラーハンドリング
   - モナディックな操作

### テスト技術

1. **Go テストフレームワーク**
   - 標準の `testing` パッケージ
   - `testify` パッケージ（アサーション、モック）
   - テーブル駆動テスト
   - サブテスト

2. **Deno 標準テストライブラリ** (移行前)
   - `@std/expect`: アサーションライブラリ
   - `@std/testing/bdd`: BDD スタイルのテスト
   - テストカバレッジ計測

### ビルドとツール

1. **Go ツール**
   - `go build`: コンパイル
   - `go test`: テスト実行
   - `go vet`: 静的解析
   - `golangci-lint`: リンター

2. **Makefile**
   - ビルド、テスト、リント、カバレッジのコマンド定義
   - 依存関係の管理

3. **GitHub Actions**
   - CI/CD パイプライン
   - 自動テストと検証
   - コード品質チェック

## 開発環境のセットアップ

### 必要なツール

1. **Go のインストール**
   ```bash
   # macOS (Homebrew)
   brew install go

   # Linux
   wget https://go.dev/dl/go1.24.0.linux-amd64.tar.gz
   sudo tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz
   export PATH=$PATH:/usr/local/go/bin

   # Windows
   # https://go.dev/dl/ からインストーラーをダウンロード
   ```

2. **エディタ設定**
   - VSCode + Go 拡張機能
   - 設定例:
     ```json
     {
       "go.useLanguageServer": true,
       "go.lintTool": "golangci-lint",
       "go.formatTool": "goimports",
       "editor.formatOnSave": true
     }
     ```

3. **プロジェクトのセットアップ**
   ```bash
   # リポジトリのクローン
   git clone <repository-url>
   cd <repository-directory>

   # 依存関係のインストール
   go mod download

   # ルールとモードの生成
   go run .cline/build.go
   ```

### 開発ワークフロー

1. **新しいモジュールの作成**
   ```bash
   # 新しいパッケージの作成
   mkdir -p internal/newpackage
   touch internal/newpackage/newpackage.go
   touch internal/newpackage/newpackage_test.go
   ```

2. **テストの実行**
   ```bash
   # 単一パッケージのテスト
   go test ./internal/newpackage

   # すべてのテストの実行
   go test ./...

   # カバレッジの計測
   make coverage
   # または
   go test -coverprofile=coverage.out ./...
   go tool cover -html=coverage.out -o coverage.html
   ```

3. **リントとフォーマット**
   ```bash
   # リント
   make lint
   # または
   golangci-lint run

   # フォーマット
   go fmt ./...
   ```

4. **依存関係の検証**
   ```bash
   # 依存関係の確認
   go mod verify

   # 未使用の依存関係の削除
   go mod tidy
   ```

## 技術的制約

1. **Go の制約**
   - ジェネリクスの制限（Go 1.18以降で導入されたが、TypeScriptほど柔軟ではない）
   - エラー処理の冗長性（Result型のような高レベルな抽象化がない）
   - 継承のサポートがない（代わりにコンポジションを使用）

2. **パフォーマンスの制約**
   - 大規模な JSON データ処理時のメモリ使用量
   - 型予測の計算コスト
   - 循環参照の検出と処理

3. **テストの制約**
   - モックとスタブの作成の複雑さ
   - 外部 API のテスト
   - 並行処理のテスト

## 依存関係

### 主要な依存関係

1. **標準ライブラリ**
   - `testing`: テストフレームワーク
   - `encoding/json`: JSON処理
   - `io/fs`: ファイルシステム操作
   - `regexp`: 正規表現

2. **外部ライブラリ**
   - `github.com/stretchr/testify`: テストアサーションとモック
   - `gopkg.in/yaml.v3`: YAML処理
   - `github.com/spf13/cobra`: コマンドラインインターフェース（予定）
   - `github.com/pkg/errors`: エラーラッピング（予定）

### 依存関係管理

1. **Go Modules**
   - `go.mod`: モジュール定義と依存関係
   - `go.sum`: 依存関係のチェックサム
   - バージョン管理と再現性の確保

2. **バージョン管理**
   - 明示的なバージョン指定
   - 定期的な依存関係の更新
   - セマンティックバージョニングの遵守

## 技術的な意思決定

1. **Goへの移行理由**
   - パフォーマンスの向上
   - 静的型付けによる安全性
   - 並行処理の簡素化（goroutine、channel）
   - デプロイの簡素化（単一バイナリ）
   - 標準ライブラリの充実

2. **段階的な移行戦略の採用理由**
   - リスクの最小化
   - 継続的な機能提供
   - テストによる品質保証
   - フィードバックの早期取得

3. **アダプターパターンの採用理由**
   - 外部依存の抽象化
   - テスト容易性の向上
   - 実装の詳細の隠蔽
   - 移行時の互換性確保

4. **テストファーストアプローチの採用理由**
   - 設計の明確化
   - バグの早期発見
   - リファクタリングの安全性
   - 移行の正確性確保

5. **ディレクトリ構造の決定理由**
   - Go標準のレイアウト（cmd/、internal/、pkg/）
   - 関心の分離
   - 依存関係の明確化
   - 拡張性の確保
