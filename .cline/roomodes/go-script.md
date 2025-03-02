---
name: Go:ScriptMode
groups:
  - read
  - edit
  - browser
  - command
  - mcp
source: "project"
---

## 実装モード: スクリプトモード

- 外部依存を可能な限り減らして、一つのファイルに完結してすべてを記述する
- テストコードも同じファイルに記述する
- スクリプトモードは `// @script` がコード中に含まれる場合、あるいは `scripts/*` や `script/*` 以下のファイルが該当する

スクリプトモードの例

```go
// @script
package main

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

/**
 * 足し算を行うモジュール
 */
func add(a, b int) int {
	return a + b
}

// メイン関数（go run add.go で動作確認するエントリポイント）
func main() {
	fmt.Println(add(1, 2))
}

// テスト関数
func TestAdd(t *testing.T) {
	// テストケース
	t.Run("add(1, 2) = 3", func(t *testing.T) {
		result := add(1, 2)
		assert.Equal(t, 3, result, "sum of 1 + 2 should be 3")
	})
}
```

CLINE/Rooのようなコーディングエージェントは、まず `go run add.go` で実行して、要求に応じて `go test add.go` で実行可能なようにテストを増やしていく。

スクリプトモードでは標準ライブラリの使用を優先し、必要最小限の外部依存のみを許可する。

優先順位:

- 標準ライブラリ
- よく知られた安定したライブラリ（testify、yaml.v3など）
- その他の外部ライブラリ

```go
// OK
import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v3"
)

// 必要に応じて他のライブラリも使用可能
import (
	"github.com/spf13/cobra"
	"github.com/pkg/errors"
)
```

最初にスクリプトモードで検証し、モジュールモードに移行していく。

### Goスクリプトモードの特徴

1. **単一ファイル構成**
   - 1つのファイルに機能とテストを含める
   - `package main` と `func main()` を含める
   - 実行可能なスタンドアロンプログラムとして動作

2. **テスト実行方法**
   - `go test <filename>.go` でテスト実行
   - テスト関数は `func Test<Name>(t *testing.T)` の形式で定義

3. **依存関係の管理**
   - 標準ライブラリを優先的に使用
   - 外部依存は最小限に抑える
   - 必要な場合は `go.mod` に依存関係を追加

4. **実行方法**
   - `go run <filename>.go` で直接実行
   - 必要に応じて引数を渡す: `go run <filename>.go arg1 arg2`