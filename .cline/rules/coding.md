# コーディングプラクティス

## 原則

### 関数型アプローチ (FP)
- 純粋関数を優先
- 不変データ構造を使用
- 副作用を分離
- 型安全性を確保

### ドメイン駆動設計 (DDD)
- 値オブジェクトとエンティティを区別
- 集約で整合性を保証
- リポジトリでデータアクセスを抽象化
- 境界付けられたコンテキストを意識

### テスト駆動開発 (TDD)
- Red-Green-Refactorサイクル
- テストを仕様として扱う
- 小さな単位で反復
- 継続的なリファクタリング

## 実装パターン

### 型定義

```go
// カスタム型で型安全性を確保
type Money float64
type Email string

// バリデーション用メソッド
func (m Money) IsValid() bool {
    return m >= 0
}

func (e Email) IsValid() bool {
    // メールアドレスの検証ロジック
    return strings.Contains(string(e), "@")
}
```

### 値オブジェクト

- 不変
- 値に基づく同一性
- 自己検証
- ドメイン操作を持つ

```go
// 作成関数はバリデーション付き
func NewMoney(amount float64) (Money, error) {
    if amount < 0 {
        return 0, errors.New("負の金額不可")
    }
    return Money(amount), nil
}
```

### エンティティ

- IDに基づく同一性
- 制御された更新
- 整合性ルールを持つ

### Result型

```go
// Result型の実装
type Result[T any, E any] struct {
    value T
    err   E
    isOk  bool
}

// 成功の結果を作成
func Ok[T any, E any](value T) Result[T, E] {
    return Result[T, E]{
        value: value,
        isOk:  true,
    }
}

// エラーの結果を作成
func Err[T any, E any](err E) Result[T, E] {
    return Result[T, E]{
        err:  err,
        isOk: false,
    }
}

// 結果値の取得
func (r Result[T, E]) Value() (T, bool) {
    return r.value, r.isOk
}

// エラー値の取得
func (r Result[T, E]) Error() (E, bool) {
    return r.err, !r.isOk
}
```

- 成功/失敗を明示
- 早期リターンパターンを使用
- エラー型を定義

### リポジトリ

- ドメインモデルのみを扱う
- 永続化の詳細を隠蔽
- テスト用のインメモリ実装を提供

### アダプターパターン

- 外部依存を抽象化
- インターフェースは呼び出し側で定義
- テスト時は容易に差し替え可能

## 実装手順

1. **型設計**
   - まず型を定義
   - ドメインの言語を型で表現

2. **純粋関数から実装**
   - 外部依存のない関数を先に
   - テストを先に書く

3. **副作用を分離**
   - IO操作は関数の境界に押し出す
   - 副作用を持つ処理をインターフェースで抽象化

4. **アダプター実装**
   - 外部サービスやDBへのアクセスを抽象化
   - テスト用モックを用意

## プラクティス

- 小さく始めて段階的に拡張
- 過度な抽象化を避ける
- コードよりも型を重視
- 複雑さに応じてアプローチを調整

## コードスタイル

- 関数優先（構造体は必要な場合のみ）
- 不変更新パターンの活用
- 早期リターンで条件分岐をフラット化
- エラーとユースケースの列挙型定義

## テスト戦略

- 純粋関数の単体テストを優先
- インメモリ実装によるリポジトリテスト
- テスト可能性を設計に組み込む
- アサートファースト：期待結果から逆算