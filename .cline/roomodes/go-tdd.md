---
name: Go:TestFirstMode
groups:
  - read
  - edit
  - browser
  - command
  - mcp
source: "project"
---

## 実装モード: テストファーストモード

テストファーストモードは、実装のインターフェース定義とテストコードを先に書き、それをユーザーに確認を取りながら実装を行う。

ファイル冒頭に `// @tdd` を含む場合、それはテストファーストモードである。

### テストの命名規約

テスト名は以下の形式で記述する：

```
「{状況}の場合に{操作}をすると{結果}になること」
```

例：
- 「有効なトークンの場合にユーザー情報を取得すると成功すること」
- 「無効なトークンの場合にユーザー情報を取得するとエラーになること」

### テストの実装順序

テストコードは以下の順序で **実装** する：

1. 期待する結果（アサーション）を最初に書く
2. アサーションの妥当性をユーザーに確認
3. 確認が取れたら、操作（Act）のコードを書く
4. 最後に、準備（Arrange）のコードを書く

これは実行順序（Arrange → Act → Assert）とは異なる。実装を結果から始めることで、目的を明確にしてから実装を進められる。

実装例：

```go
// @script @tdd
package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// 型定義
type User struct {
	ID   string
	Name string
}

// エラー型定義
type ErrorType string

const (
	ErrorTypeUnauthorized ErrorType = "unauthorized"
	ErrorTypeNetwork      ErrorType = "network"
)

type ApiError struct {
	Type    ErrorType
	Message string
}

// Result型の簡易実装
type Result struct {
	user     *User
	apiError *ApiError
	isOk     bool
}

func Ok(user User) Result {
	return Result{
		user: &user,
		isOk: true,
	}
}

func Err(err ApiError) Result {
	return Result{
		apiError: &err,
		isOk:     false,
	}
}

func (r Result) IsOk() bool {
	return r.isOk
}

func (r Result) IsErr() bool {
	return !r.isOk
}

func (r Result) Value() *User {
	return r.user
}

func (r Result) Error() *ApiError {
	return r.apiError
}

// インターフェース定義
// GetUser はトークンとIDを使用してユーザー情報を取得する
func GetUser(token string, id string) Result {
	// 実装はテスト後に記述
	panic("Not implemented")
}

// テスト
func TestGetUser(t *testing.T) {
	t.Run("有効なトークンの場合にユーザー情報を取得すると成功すること", func(t *testing.T) {
		// 1. まず期待する結果を書く
		expectedUser := User{
			ID:   "1",
			Name: "Test User",
		}

		// 2. ここでユーザーに結果の妥当性を確認

		// 3. 次に操作を書く
		result := GetUser("valid-token", "1")

		// 4. 最後に準備を書く（この例では不要）

		// アサーション
		assert.True(t, result.IsOk(), "結果は成功であること")
		if result.IsOk() {
			assert.Equal(t, expectedUser, *result.Value(), "ユーザー情報が期待通りであること")
		}
	})

	t.Run("無効なトークンの場合にユーザー情報を取得するとエラーになること", func(t *testing.T) {
		// 1. まず期待する結果を書く
		expectedError := ApiError{
			Type:    ErrorTypeUnauthorized,
			Message: "Invalid token",
		}

		// 2. ユーザーに結果の妥当性を確認

		// 3. 次に操作を書く
		result := GetUser("invalid-token", "1")

		// アサーション
		assert.True(t, result.IsErr(), "結果はエラーであること")
		if result.IsErr() {
			assert.Equal(t, expectedError, *result.Error(), "エラー情報が期待通りであること")
		}
	})
}

// 実装例（テスト後に記述）
func GetUserImpl(token string, id string) Result {
	if token == "valid-token" {
		return Ok(User{
			ID:   id,
			Name: "Test User",
		})
	}
	return Err(ApiError{
		Type:    ErrorTypeUnauthorized,
		Message: "Invalid token",
	})
}
```

### 開発手順の詳細

1. インターフェース定義
   ```go
   // GetUser はトークンとIDを使用してユーザー情報を取得する
   func GetUser(token string, id string) Result {
       // 実装はテスト後に記述
       panic("Not implemented")
   }
   ```

2. テストケースごとに：

   a. 期待する結果を定義
   ```go
   expectedUser := User{
       ID:   "1",
       Name: "Test User",
   }
   ```

   b. **ユーザーと結果の確認**
   - この時点で期待する結果が適切か確認
   - 仕様の見直しや追加が必要な場合は、ここで修正

   c. 操作コードの実装
   ```go
   result := GetUser("valid-token", "1")
   ```

   d. 必要な準備コードの実装
   ```go
   // 必要な場合のみ
   mockAPI := NewMockAPI()
   mockAPI.Setup()
   ```

3. テストを一つずつ実行しながら実装

### Goでのテストファーストモードの特徴

1. **テーブル駆動テスト**
   - 複数のテストケースをテーブル形式で定義
   - データとロジックを分離
   - 例：
     ```go
     func TestAdd(t *testing.T) {
         tests := []struct {
             name     string
             a, b     int
             expected int
         }{
             {"正の数同士", 2, 3, 5},
             {"正と負の数", 2, -3, -1},
             {"負の数同士", -2, -3, -5},
         }
         
         for _, tt := range tests {
             t.Run(tt.name, func(t *testing.T) {
                 // 期待する結果を確認
                 // 操作を実行
                 result := Add(tt.a, tt.b)
                 // アサーション
                 assert.Equal(t, tt.expected, result)
             })
         }
     }
     ```

2. **インターフェースを活用したモック**
   - 依存関係をインターフェースとして定義
   - テスト時にモック実装を注入
   - 例：
     ```go
     type UserRepository interface {
         GetUser(id string) (*User, error)
     }
     
     // 本番実装
     type UserService struct {
         repo UserRepository
     }
     
     // テスト用モック
     type MockUserRepository struct{}
     
     func (m *MockUserRepository) GetUser(id string) (*User, error) {
         return &User{ID: id, Name: "Test User"}, nil
     }
     ```

テストファーストモードは他のモードと両立する。