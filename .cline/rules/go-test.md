# Go Practice

## モジュールを追加する

モジュールを追加するとき、 go.mod にすでに require されていないか確認する。

一般によく知られているモジュール以外をコードに追加するときは、ハルシネーションをしていないか確認する。

モジュールが見つかった場合、 `go get -tool <name>` で go.mod に追加し、各ファイルでimport して使う。

## テストの書き方

`testify`パッケージを使用

```go
package calculator

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestAddition(t *testing.T) {
	// テスト対象の関数を実行
	result := Add(2, 3)
	
	// 期待値の検証 (testifyを使用)
	assert.Equal(t, 5, result, "数値の合計が期待値と一致すること")
}
```

### テストの基本原則

- テストファイルは `_test.go` のサフィックスをつける
- `testify/assert` または `testify/require` パッケージを利用する
- テスト関数は必ず `Test` から始まる名前にする
- テスト関数は `t *testing.T` パラメータを受け取る
- 複雑な入れ子構造は避け、`t.Run()` を使用して平坦な構造にする

### アサーションの書き方

```go
// 等値比較
assert.Equal(t, expected, actual, "期待値と一致すること")

// 真偽値の検証
assert.True(t, condition, "条件が真であること")

// nilチェック
assert.Nil(t, object, "オブジェクトがnilであること")
assert.NotNil(t, object, "オブジェクトがnilでないこと")
```

必ず失敗時のメッセージを含めて、何をテストしているかを明確にする

### サブテストを使った例

```go
func TestCalculator(t *testing.T) {
	t.Run("Addition", func(t *testing.T) {
		result := Add(2, 3)
		assert.Equal(t, 5, result, "2+3の計算結果が5になること")
	})
	
	t.Run("Subtraction", func(t *testing.T) {
		result := Subtract(5, 2)
		assert.Equal(t, 3, result, "5-2の計算結果が3になること")
	})
}
```

### テーブル駆動テストの基本

```go
package calculator

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestAdd(t *testing.T) {
	// テストケースのテーブル定義 - データの部分
	tests := []struct {
		name     string
		a        int
		b        int
		expected int
	}{
		{name: "正の数同士", a: 2, b: 3, expected: 5},
		{name: "正と負の数", a: 2, b: -3, expected: -1},
		{name: "負の数同士", a: -2, b: -3, expected: -5},
		{name: "ゼロを含む", a: 0, b: 5, expected: 5},
	}

	// テストロジックの部分 - 各テストケースを実行
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Add(tt.a, tt.b)
			assert.Equal(t, tt.expected, result, "計算結果が期待値と一致すること")
		})
	}
}
```

### データとロジックの分離

テーブル駆動テストの核心は「**データとロジックの分離**」：

1. **テーブル部分（データ）**: 
   - 入力パラメータと期待される出力のみに集中
   - 実装の詳細ではなく、外部から見た振る舞いをテスト

2. **テスト部分（ロジック）**: 
   - テストの実行方法は一箇所にまとめる
   - 全てのテストケースに対して同じロジックを適用

### テーブルの設計ポイント

効果的なテーブル設計のために重要な2つの観点：

1. **適切なテストケース数**:
   - 少なすぎると網羅性に欠ける
   - 多すぎると可読性が低下
   - 境界値、エッジケース、通常ケースを含める
   - 目安として5〜10ケース程度が読みやすい

2. **入出力への集中**:
   - テーブルには入力と期待される出力のみを含める
   - テスト中の中間状態や内部実装の詳細は含めない
   - 「何を入れたら何が出るか」という観点でテストケースを設計

### 実践例

```go
func TestCalculate(t *testing.T) {
	// データとしてのテストケース - 入力と出力のみに集中
	tests := []struct {
		name        string  // テストケースの名前
		expression  string  // 入力
		expected    float64 // 期待される出力
		expectError bool    // エラーが予想されるか
	}{
		{name: "基本的な加算", expression: "2+3", expected: 5, expectError: false},
		{name: "複雑な式", expression: "2*3+4", expected: 10, expectError: false},
		{name: "ゼロ除算", expression: "5/0", expected: 0, expectError: true},
		{name: "空の式", expression: "", expected: 0, expectError: true},
		{name: "不正な文字", expression: "2+a", expected: 0, expectError: true},
	}

	// ロジックとしてのテスト実行部分
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := Calculate(tt.expression)
			
			// エラー期待値のチェック
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
```

#### テーブル駆動テストの利点

- コードの重複を減らす
- テストケースの追加が容易
- 異なるインプットでの挙動を一目で確認できる
- メンテナンス性が高い
- データとロジックが分離されているため、テストの意図が明確

適切なテーブル設計と入出力への集中を意識することで、読みやすく保守性の高いテストを実現できます。これはGoの標準的なテスト手法として広く採用されています。


## Goパッケージ構造のベストプラクティス


### 依存関係の管理

1. **パッケージ設計**:
   - より小さく、集中したパッケージに分割
   - 依存方向を上位レベル（アプリケーション）から下位レベル（ユーティリティ）に向ける
   - 依存性逆転の原則を使用して、インターフェースを介した疎結合を実現

3. **依存関係可視化ツール**:
   - `go mod graph` - モジュール依存関係の表示
   - `go mod why` - なぜ特定の依存関係が必要なのかを表示
   - サードパーティツール：
     ```bash
     go get -tool github.com/loov/goda@latest
     goda graph ./...
     ```

## Go特有のベストプラクティス

2. **依存関係の検証ツール**:
   - `go vet` - 潜在的な問題をチェック
   - `golangci-lint` - 複数のリンターを統合
   ```bash
   golangci-lint run --enable=depguard,gomoddirectives
   ```

3. **インターフェース設計**:
   - インターフェースは実装側ではなく使用側のパッケージで定義
   - これにより依存方向を制御し循環参照を防ぐ

4. **依存性注入**:
   - コードの依存関係をより明示的に、テスト可能に
   - `wire`や`fx`などのDIフレームワークを活用


## Goにおけるコード品質の監視

### カバレッジ

Goでのテストカバレッジの取得は次のように行う：

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

上記コマンドで、HTML形式のカバレッジレポートが生成され、ブラウザで詳細を確認できる。

カバレッジの目標値：
- 新規実装時は80%以上のカバレッジを目標とする
- 重要なビジネスロジックは90%以上を目指す

## デッドコード解析

Goでのデッドコード検出には以下のツールが利用する：

```bash
# deadcode検出
go get -tool golang.org/x/tools/cmd/deadcode@latest
deadcode ./...

# 未使用の依存関係検出
go mod tidy

# より高度な静的解析
go get -tool honnef.co/go/tools/cmd/staticcheck@latest
staticcheck ./...
```

継続的インテグレーションで以下のようなコマンドを実行するよう設定：

```bash
# CIでのデッドコード検出
go vet ./...
staticcheck ./...
```

これまでのコマンドは、全てMakefileで実行可能