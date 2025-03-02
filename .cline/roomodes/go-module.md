---
name: Go:Module
groups:
  - read
  - edit
  - browser
  - command
  - mcp
source: "project"
---

## 実装モード: モジュールモード

モジュールモードはディレクトリの下で複数のファイルで構成される。

例

```
pkg/
  xxx/
    xxx.go       - パッケージのメイン実装
    xxx_test.go  - テスト
    types.go     - 型定義
    errors.go    - エラー定義
    mock.go      - テスト用モック
internal/
  yyy/
    yyy.go       - 内部パッケージの実装
    yyy_test.go  - テスト
    types.go     - 型定義
    errors.go    - エラー定義
cmd/
  app/
    main.go      - エントリーポイント
```

モジュールをテストする時は、 `go test ./...` または `go test ./pkg/xxx` のように実行する。

テストが落ちた時は、次の手順を踏む。

機能追加の場合

1. 機能追加の場合、まず `go test ./...` で全体のテストが通過しているかを確認する
2. 修正後、対象のパッケージをテストする

修正の場合

1. `go test ./pkg/xxx` でパッケージのテストを実行する
2. 落ちたパッケージのテストを確認し、実装を参照する。
   - テストは一つずつ実行する `go test -run TestFunctionName ./pkg/xxx`
3. 落ちた理由をステップバイステップで考える(闇雲に修正しない!)
4. 実装を修正する。必要な場合、実行時の過程を確認するためのプリントデバッグを挿入する。
5. パッケージのテスト実行結果を確認
   - 修正出来た場合、プリントデバッグを削除する
   - 修正できない場合、3 に戻る。
6. パッケージ以外の全体テストを確認

テストが落ちた場合、落ちたテストを修正するまで次のパッケージに進まない。

### モジュール構造とパッケージ設計

Goのモジュール構造は、標準的なレイアウトに従うことが推奨されます：

1. **cmd/**
   - 実行可能なアプリケーションのメインパッケージ
   - 各サブディレクトリは独立した実行可能ファイルに対応
   - 最小限のコードのみを含み、ロジックは他のパッケージに委譲

2. **internal/**
   - 外部からインポートできない非公開パッケージ
   - アプリケーション固有のロジック
   - 再利用を意図していないコード
   - internalディレクトリには直接ファイルを置くことも可能（サブディレクトリを作る必要はない）

3. **pkg/**
   - 外部からインポート可能な公開パッケージ
   - 再利用可能なライブラリコード
   - 安定したAPIを提供

4. **その他のディレクトリ**
   - `api/`: プロトコル定義、OpenAPI/Swagger仕様など
   - `configs/`: 設定ファイルテンプレート
   - `docs/`: ドキュメント
   - `test/`: 追加のテストとテストデータ

### パッケージの役割とコンテキスト境界

各パッケージは明確な責任を持ち、単一の目的を果たすべきです：

1. **パッケージの命名**
   - 短く、明確で、説明的な名前
   - 単数形を使用（`user`、`order`など）
   - 汎用的すぎる名前を避ける（`util`、`common`など）

2. **パッケージの構成**
   - 関連する機能をグループ化
   - 循環依存を避ける
   - 依存方向を上位レベルから下位レベルに向ける

3. **ファイル構成**
   - 機能ごとに適切にファイルを分割
   - `types.go`: 型定義
   - `errors.go`: エラー定義
   - `<package>_test.go`: テスト
   - `mock.go`: テスト用モック

### インターフェースの設計

インターフェースは使用側のパッケージで定義することが推奨されます：

```go
// service/user.go（使用側）
package service

type UserRepository interface {
    GetByID(id string) (*User, error)
    Save(user *User) error
}

type UserService struct {
    repo UserRepository
}

// repository/user.go（実装側）
package repository

type UserRepo struct {
    db *sql.DB
}

// UserServiceのインターフェースを満たすメソッド
func (r *UserRepo) GetByID(id string) (*service.User, error) {
    // 実装
}

func (r *UserRepo) Save(user *service.User) error {
    // 実装
}
```

この方法により：
- 依存方向が明確になる（上位レベルのパッケージは下位レベルのパッケージに依存しない）
- モックの作成が容易になる
- 循環依存を避けられる

### 依存関係の管理

1. **go.mod と go.sum**
   - `go.mod`: モジュール定義と依存関係
   - `go.sum`: 依存関係のチェックサム
   - バージョン管理と再現性の確保

2. **依存関係の追加**
   ```bash
   go get --tool github.com/example/package@v1.2.3
   ```

3. **依存関係の更新**
   ```bash
   go get --tool -u github.com/example/package
   ```

4. **未使用の依存関係の削除**
   ```bash
   go mod tidy
   ```

### テスト戦略

1. **テーブル駆動テスト**
   - データとロジックを分離
   - 複数のテストケースを効率的に記述

2. **テストヘルパーとモック**
   - テスト用のヘルパー関数
   - インターフェースを使用したモック
   - `mock.go` ファイルでのモック実装

3. **テストカバレッジ**
   ```bash
   go test -coverprofile=coverage.out ./...
   go tool cover -html=coverage.out
   ```

4. **ベンチマーク**
   ```go
   func BenchmarkFunction(b *testing.B) {
       for i := 0; i < b.N; i++ {
           // テスト対象の関数呼び出し
       }
   }