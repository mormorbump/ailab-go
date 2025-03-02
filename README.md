# AI + Go コード生成の実験場

このプロジェクトは、[mizchi氏](https://github.com/mizchi)の[ailab](https://github.com/mizchi/ailab/)を元に作成された、AI（特にコーディングエージェント）とGoを組み合わせたコード生成の実験場です。Goプロジェクトにおけるコーディングルールとモードを定義するための設定ファイルを管理し、AIによるコード生成の品質と効率を向上させることを目的としています。

`.clinerules` と `.roomodes` が主な生成物です。

## プロジェクト概要

### 主要な目標

1. AI コーディングエージェント（CLINE/Rooなど）のための明確なルールとモードを定義する
2. Go プロジェクトにおけるベストプラクティスを確立する
3. 型安全なコード生成と検証の仕組みを提供する
4. テスト駆動開発（TDD）のワークフローを AI コーディングに適用する
5. アダプターパターンなどの設計パターンを活用した実装例を提供する

### コアコンポーネント

1. **コーディングルール定義**
   - 基本ルール（型と関数インターフェース設計、コードコメント、実装パターン選択）
   - Go 固有のルール（テスト、モジュール依存関係、コード品質監視）
   - Git ワークフロー（コミット、プルリクエスト作成）
   - Go ベストプラクティス（型使用方針、エラー処理、実装パターン）

2. **実装モード**
   - スクリプトモード: 一つのファイルに完結した実装
   - テストファーストモード: インターフェース定義とテストを先に書く実装
   - モジュールモード: 複数のファイルで構成される実装
   - リファクターモード: 既存コードの改善に特化したモード

3. **ユーティリティモジュール**
   - go-pkg-summary: Goパッケージの型定義やファイル構造を表示するツール
   - アダプターパターン実装例: 外部 API との通信を抽象化する実装

## 技術スタック

### コア技術

- **Go**: 静的型付け、並行処理、標準ライブラリ
- **testify**: テストアサーション、モック
- **generics**: Go 1.18以降のジェネリクス機能

### テスト技術

- **Go標準テストライブラリ**: `testing`パッケージ
- **testify/assert**: テストアサーション
- **testify/require**: 厳格なアサーション
- テストカバレッジ計測

### ビルドとツール

- **Makefile**: タスク定義
- **GitHub Actions**: CI/CD パイプライン
- **golangci-lint**: 静的解析ツール

## 主要モジュール

### go-pkg-summary

Goパッケージの型定義やファイル構造を表示するコマンドラインツール。

特徴:

- パッケージの型定義を表示
- パッケージ内のファイル一覧を表示
- 特定のファイルの内容を表示
- バージョン指定によるパッケージの検索

使用例:

```bash
# パッケージの型定義を表示
go-pkg-summary github.com/stretchr/testify/assert

# パッケージ内のファイル一覧を表示
go-pkg-summary ls github.com/stretchr/testify/assert

# 特定のファイルの内容を表示
go-pkg-summary read github.com/stretchr/testify/assert/assertions.go
```

### アダプターパターン実装例

Goでのアダプターパターンは、外部依存を抽象化し、テスト可能なコードを実現するためのパターンです。

実装パターン:

1. **関数ベース**: 内部状態を持たない単純な操作の場合
2. **構造体ベース**: 設定やキャッシュなどの内部状態を管理する必要がある場合
3. **依存性注入**: 外部APIとの通信など、モックが必要な場合

ベストプラクティス:

- インターフェースはシンプルに保つ
- 基本的には関数ベースを優先する
- 内部状態が必要な場合のみ構造体を使用する
- エラー処理はResult型で表現し、パニックを使わない

## 現在の状況

| コンポーネント       | ステータス | 進捗率 | 優先度 |
| -------------------- | ---------- | ------ | ------ |
| ルールとモード定義   | 安定       | 90%    | 低     |
| go-pkg-summary       | 安定       | 80%    | 中     |
| アダプターパターン例 | 安定       | 80%    | 中     |
| テストインフラ       | 安定       | 70%    | 中     |
| CI/CD パイプライン   | 開発中     | 50%    | 中     |
| メモリバンク         | 初期段階   | 30%    | 高     |
| ドキュメント         | 初期段階   | 40%    | 高     |

### 次のマイルストーン

1. **go-pkg-summary の機能拡張（現在）**
   - パッケージ依存関係の可視化
   - インターフェース実装の検索
   - 基本的なテストケース

2. **実装例の充実（次のフェーズ）**
   - 新しい設計パターンの実装例
   - モジュールモードの詳細な実装例
   - ユースケースの例の追加

3. **完全なドキュメントとテスト（最終フェーズ）**
   - API ドキュメントの完成
   - テストカバレッジ目標の達成
   - チュートリアルとガイドラインの完成
   - CI/CD パイプラインの完全自動化

## .cline ディレクトリの説明

このリポジトリの `.cline` ディレクトリは、Goプロジェクトにおけるコーディングルールとモードを定義するための設定ファイルを管理しています。

### ディレクトリ構造

```
.cline/
├── build.go        - プロンプトファイルを結合して .clinerules と .roomodes を生成するスクリプト
├── rules/          - コーディングルールを定義するマークダウンファイル
│   ├── 01_basic.md       - 基本的なルールと AI Coding with Go の概要
│   ├── go_rules.md       - Go に関するルール（テスト、モジュール依存関係など）
│   ├── git_workflow.md   - Git ワークフローに関するルール
│   └── go_bestpractice.md - Go のコーディングベストプラクティス
└── roomodes/       - 実装モードを定義するマークダウンファイル
    ├── go-script.md      - スクリプトモードの定義
    ├── go-module.md      - モジュールモードの定義
    ├── go-tdd.md         - テストファーストモードの定義
    └── go-refactor.md    - リファクターモードの定義
```

### 生成されるファイル

`.cline/build.go` スクリプトを実行すると、以下のファイルが生成されます：

1. `.clinerules` - `rules` ディレクトリ内のマークダウンファイルを結合したファイル
2. `.roomodes` - `roomodes` ディレクトリ内のマークダウンファイルから生成された JSON ファイル

### 使用方法

1. `.cline/rules` ディレクトリにコーディングルールを定義するマークダウンファイルを追加または編集します。
2. `.cline/roomodes` ディレクトリに実装モードを定義するマークダウンファイルを追加または編集します。
3. `.cline/build.go` スクリプトを実行して、`.clinerules` と `.roomodes` ファイルを生成します。

```bash
go run .cline/build.go
```

4. 生成された `.clinerules` と `.roomodes` ファイルは、AI コーディングアシスタント（CLINE/Roo など）によって読み込まれ、プロジェクトのルールとモードが適用されます。

### モードの切り替え方法

プロジェクトで定義されているモードは以下の通りです：

- `go-script` (Go:ScriptMode) - スクリプトモード
- `go-module` (Go:Module) - モジュールモード
- `go-tdd` (Go:TestFirstMode) - テストファーストモード
- `go-refactor` (Go:RefactorMode) - リファクターモード

モードを切り替えるには、AI コーディングアシスタントに対して以下のように指示します：

```
モードを go-script に切り替えてください。
```

または、ファイルの冒頭に特定のマーカーを含めることでモードを指定することもできます：

- スクリプトモード: `// @script`
- テストファーストモード: `// @tdd`

例：

```go
// @script @tdd
// このファイルはスクリプトモードとテストファーストモードの両方で実装されます
```

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

## go.work を用いたプロジェクトの立ち上げ方

このプロジェクトは Go のワークスペース機能（go.work）を使用したマルチモジュール構成になっています。これにより、複数の Go モジュールを一つのワークスペースで管理できます。

### go.work の概要

go.work ファイルは、複数の Go モジュールを一つのワークスペースとして扱うための設定ファイルです。主な利点は以下の通りです：

- 複数のモジュールを一度に開発できる
- モジュール間の依存関係を簡単に解決できる
- 各モジュールが独自の go.mod ファイルを持ちながら連携できる

### 新しいプロジェクトでの go.work の設定方法

1. **ワークスペースの初期化**
   ```bash
   # プロジェクトのルートディレクトリで実行
   go work init
   ```

2. **モジュールの追加**
   ```bash
   # 既存のモジュールを追加
   go work use ./path/to/module1
   go work use ./path/to/module2
   
   # または直接 go.work ファイルを編集
   # go.work
   # go 1.24.0
   #
   # use (
   #   ./path/to/module1
   #   ./path/to/module2
   # )
   ```

3. **新しいモジュールの作成と追加**
   ```bash
   # 新しいディレクトリを作成
   mkdir -p scripts/cmd/new-tool
   cd scripts/cmd/new-tool
   
   # モジュールを初期化
   go mod init github.com/yourusername/project/scripts/cmd/new-tool
   
   # ワークスペースに追加（プロジェクトルートに戻って）
   cd ../../../
   go work use ./scripts/cmd/new-tool
   ```

### 既存のプロジェクトでの go.work の利用方法

このプロジェクトでは、以下のモジュールが go.work で管理されています：

```
go 1.24.0

use (
	./go-pkg-summary
	./scripts/cmd/check-ci
	./scripts/cmd/duckdb-vss
	./scripts/cmd/gh-search
	./scripts/cmd/git-push-with-ci
	./scripts/cmd/lsp-client
	./scripts/cmd/search-files
	./scripts/cmd/search-gopkg
)
```

プロジェクトをクローンした後、以下の手順で開発を始めることができます：

1. **依存関係のダウンロード**
   ```bash
   # 全モジュールの依存関係をダウンロード
   go work sync
   ```

2. **全モジュールのビルド**
   ```bash
   # ワークスペース内の全モジュールをビルド
   go build ./...
   ```

3. **特定のモジュールの実行**
   ```bash
   # 例: go-pkg-summary モジュールを実行
   go run ./go-pkg-summary
   
   # または特定のコマンドを実行
   go run ./scripts/cmd/search-gopkg
   ```

### go.work の管理

1. **依存関係の同期**
   ```bash
   # 全モジュールの依存関係を同期
   go work sync
   ```

2. **ワークスペースの情報表示**
   ```bash
   # ワークスペースの情報を表示
   go work edit -json
   ```

3. **モジュールの削除**
   ```bash
   # モジュールをワークスペースから削除
   go work edit -dropuse=./path/to/module
   ```

### 開発ワークフロー

1. **新しいスクリプトの作成**
   ```bash
   # スクリプトモードでの開発
   touch scripts/cmd/new-script/main.go
   # ファイル冒頭に `// @script` を追加
   ```

2. **テストの実行**
   ```bash
   # 単一パッケージのテスト
   go test ./scripts/cmd/new-script

   # すべてのテストの実行
   go test ./...

   # カバレッジの計測
   go test -coverprofile=coverage.out ./...
   go tool cover -html=coverage.out -o coverage.html
   ```

3. **リントとフォーマット**
   ```bash
   # リント
   golangci-lint run

   # フォーマット
   gofmt -w .
   ```

4. **依存関係の検証**
   ```bash
   go mod tidy
   go mod verify
   ```

## ライセンス

MIT
