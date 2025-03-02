## Go

Goでのコーディングにおける一般的なベストプラクティスをまとめます。

### 方針

- 最初に型と、それを処理する関数のインターフェースを考える
- コードのコメントとして、そのファイルがどういう仕様化を可能な限り明記する
- 実装が内部状態を持たないとき、 Struct による実装を避けて関数を優先する
- 副作用(DBや外部APIへの書き込み)を抽象するために、アダプタパターンで外部依存を抽象し、テストではインメモリなアダプタで処理する


###  型の使用方針

####  1. 明確な型定義

1. インターフェース型と具体的な型の適切な使用
   - `interface{}`（Goの`any`相当）の使用を避ける
   - 型アサーションやリフレクションを最小限にする
   - 可能な場合はジェネリクスを活用する

```go
// Good - 具体的な型を使用
func ProcessItems(items []string) []string {
    // 処理
    return processedItems
}

// Bad - interface{}を不必要に使用
func ProcessItems(items []interface{}) []interface{} {
    // 処理
    return processedItems
}

// Good - 必要ならジェネリクスを利用
func ProcessItems[T any](items []T) []T {
    // 処理
    return processedItems
}
```

2. 型の明示化
   - 関数の戻り値の型を明示する
   - 変数宣言時に適切な型を指定する

```go
// Good - 戻り値の型を明示
func GetUserCount() int {
    return len(users)
}

// Bad - 暗黙的な型
func GetUserCount() {
    return len(users) // 型情報が不明確
}
```

#### 2. カスタム型の命名と活用

1. 型エイリアスとカスタム型の命名
   - 意味のある名前をつける
   - 型の意図を明確にする
   - 固有の振る舞いが必要な場合は構造体よりも基本型に対するカスタム型を優先する

```go
// Good - 意味のある型名
type UserID string
type Email string

type User struct {
    ID        UserID   `json:"id"`
    Email     Email    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
}

// Bad - 汎用的すぎる型名
type Data interface{}
type Info struct {
    // 様々なフィールド
}
```

2. カスタム型にメソッドを追加して意味を強化

```go
// 型に振る舞いを追加
type UserID string

func (id UserID) Validate() bool {
    return len(id) > 0
}

// 使用例
func ProcessUser(id UserID) error {
    if !id.Validate() {
        return errors.New("invalid user ID")
    }
    // 処理を続行
    return nil
}
```

3. 空の構造体や定数のための型の活用

```go
// イベントタイプの列挙
type EventType string

const (
    EventTypeCreated EventType = "created"
    EventTypeUpdated EventType = "updated"
    EventTypeDeleted EventType = "deleted"
)

// 使用例
func HandleEvent(eventType EventType, data []byte) {
    switch eventType {
    case EventTypeCreated:
        // 作成イベントの処理
    case EventTypeUpdated:
        // 更新イベントの処理
    case EventTypeDeleted:
        // 削除イベントの処理
    default:
        log.Printf("unknown event type: %s", eventType)
    }
}
```

### エラー処理

1. エラーのラッピングとスタック情報
   ```go
    import "github.com/pkg/errors"

    func fetchData() error {
        resp, err := http.Get(url)
        if err != nil {
            return errors.Wrap(err, "failed to fetch data")
        }
        // ...
    }

    // 呼び出し側
    func process() error {
        if err := fetchData(); err != nil {
            return errors.Wrap(err, "processing failed")
        }
        // ...
    }
   ```

2. エラー型の定義
   - 具体的なケースを列挙
   - エラーメッセージを含める
   - 型の網羅性チェックを活用

```go
// エラータイプを定義
type ErrorType string

const (
    ErrorTypeNetwork     ErrorType = "network"
    ErrorTypeNotFound    ErrorType = "notFound"
    ErrorTypeUnauthorized ErrorType = "unauthorized"
)

// カスタムエラー構造体
type APIError struct {
    Type    ErrorType
    Message string
}

// Error メソッドの実装でエラーインターフェースを満たす
func (e APIError) Error() string {
    return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// エラータイプを確認するヘルパー関数
func IsNotFoundError(err error) bool {
    var apiErr APIError
    if errors.As(err, &apiErr) {
        return apiErr.Type == ErrorTypeNotFound
    }
    return false
}
```

### 実装パターン

#### 1. 関数ベース（状態を持たない場合）

```go
// インターフェース
type Logger interface {
    Log(message string)
}

// 実装（関数型を使った実装）
type LoggerFunc func(message string)

// インターフェースを満たすためのメソッド
func (f LoggerFunc) Log(message string) {
    f(message)
}

// ロガーの作成関数
func NewLogger() Logger {
    return LoggerFunc(func(message string) {
        fmt.Printf("[%s] %s\n", time.Now().Format(time.RFC3339), message)
    })
}

// 利用例
func main() {
    logger := NewLogger()
    logger.Log("Hello, world!")
}
```

#### 2. 構造体ベース（状態を持つ場合）

```go
// インターフェース
type Cache[T any] interface {
    Get(key string) (T, bool)
    Set(key string, value T)
}

// 実装（構造体を使用）
type TimeBasedCache[T any] struct {
    items map[string]cacheItem[T]
    ttl   time.Duration
}

type cacheItem[T any] struct {
    value    T
    expireAt time.Time
}

// コンストラクタ
func NewTimeBasedCache[T any](ttl time.Duration) *TimeBasedCache[T] {
    return &TimeBasedCache[T]{
        items: make(map[string]cacheItem[T]),
        ttl:   ttl,
    }
}

// Getメソッドの実装
func (c *TimeBasedCache[T]) Get(key string) (T, bool) {
    item, exists := c.items[key]
    if !exists || time.Now().After(item.expireAt) {
        var zero T
        return zero, false
    }
    return item.value, true
}

// Setメソッドの実装
func (c *TimeBasedCache[T]) Set(key string, value T) {
    c.items[key] = cacheItem[T]{
        value:    value,
        expireAt: time.Now().Add(c.ttl),
    }
}

// 利用例
func main() {
    cache := NewTimeBasedCache[string](5 * time.Minute)
    cache.Set("key1", "value1")
    
    value, found := cache.Get("key1")
    if found {
        fmt.Println("Found:", value)
    }
}
```

## 3. アダプターパターン（外部依存の抽象化）

```go
// 結果を表す型
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

// APIエラー型
type APIError struct {
    Type    string `json:"type"`
    Message string `json:"message"`
}

// Fetcher型。Fetch APIが実装された関数を返却する
type Fetcher func(path string) ([]byte, error)

// API取得関数の作成
func NewFetcher(headers map[string]string) Fetcher {
    client := &http.Client{Timeout: 10 * time.Second}
    
    return func(path string) ([]byte, error) {
        req, err := http.NewRequest("GET", path, nil)
        if err != nil {
            return nil, &APIError{
                Type:    "network",
                Message: err.Error(),
            }
        }
        
        // ヘッダーの設定
        for key, value := range headers {
            req.Header.Set(key, value)
        }
        
        resp, err := client.Do(req)
        if err != nil {
            return nil, &APIError{
                Type:    "network",
                Message: err.Error(),
            }
        }
        defer resp.Body.Close()
        
        if resp.StatusCode != http.StatusOK {
            return nil, &APIError{
                Type:    "network",
                Message: fmt.Sprintf("HTTP error: %d", resp.StatusCode),
            }
        }
        
        return io.ReadAll(resp.Body)
    }
}

// User型
type User struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// APIクライアント
type APIClient struct {
    fetcher Fetcher
    baseURL string
}

// APIクライアント作成
func NewAPIClient(fetcher Fetcher, baseURL string) *APIClient {
    return &APIClient{
        fetcher: fetcher,
        baseURL: baseURL,
    }
}

// ユーザー取得メソッド。中でフィールドにあるFetcherを利用
func (c *APIClient) GetUser(id string) (User, error) {
    data, err := c.fetcher(fmt.Sprintf("%s/users/%s", c.baseURL, id))
    if err != nil {
        return User{}, err
    }
    
    var user User
    if err := json.Unmarshal(data, &user); err != nil {
        return User{}, &APIError{
            Type:    "network",
            Message: "Failed to parse response",
        }
    }
    
    return user, nil
}

// 使用例
func main() {
    headers := map[string]string{
        "Content-Type": "application/json",
        "X-API-Key":    "my-api-key",
    }
    
    fetcher := NewFetcher(headers)
    client := NewAPIClient(fetcher, "https://api.example.com")
    
    user, err := client.GetUser("123")
    if err != nil {
        var apiErr *APIError
        if errors.As(err, &apiErr) {
            fmt.Printf("API Error: %s - %s\n", apiErr.Type, apiErr.Message)
        } else {
            fmt.Printf("Unknown error: %v\n", err)
        }
        return
    }
    
    fmt.Printf("User: %+v\n", user)
}
```

### 実装の選択基準

1. 関数を選ぶ場合
   - 単純な操作のみ
   - 内部状態が不要
   - 依存が少ない
   - テストが容易

2. classを選ぶ場合
   - 内部状態の管理が必要
   - 設定やリソースの保持が必要
   - メソッド間で状態を共有
   - ライフサイクル管理が必要

3. Adapterを選ぶ場合
   - 外部依存の抽象化
   - テスト時のモック化が必要
   - 実装の詳細を隠蔽したい
   - 差し替え可能性を確保したい

### 一般的なルール

1. 依存性の注入
   - 外部依存はコンストラクタで注入
   - テスト時にモックに置き換え可能に
   - グローバルな状態を避ける

2. インターフェースの設計
   - 必要最小限のメソッドを定義
   - 実装の詳細を含めない
   - プラットフォーム固有の型を避ける

3. テスト容易性
   - モックの実装を簡潔に
   - エッジケースのテストを含める
   - テストヘルパーを適切に分離

4. コードの分割
   - 単一責任の原則に従う
   - 適切な粒度でモジュール化
   - 循環参照を避ける

5. ディレクトリ構造
   - 無闇にpackage名でディレクトリを切らない
   - 例えばinternal/package_name/package_name.goではなく、internal/filename.goで良い