# Go contextパッケージ ベストプラクティスと注意点

## はじめに

Goにおける並行処理は、goroutineを用いることで容易に実現できます。しかし、複数のgoroutineを扱うようになると、処理のキャンセルやタイムアウト、goroutine間でのデータ共有などを適切に管理する必要が生じます。Goのcontextパッケージは、これらの課題を解決するための強力なツールです。

本稿では、contextパッケージの基礎から応用、ベストプラクティス、注意点までを網羅的に解説し、Go開発者が並行処理を安全かつ効率的に行うための手助けとなることを目指します。

## Go contextパッケージとは

Goのcontextパッケージは、API境界やプロセス間で、デッドライン、キャンセルシグナル、およびリクエストに関連付けられた値を伝達するためのContext型を定義します。

- **キャンセルシグナル**: 作業を中止する必要があることを示します。
- **デッドライン**: デッドラインが過ぎるとキャンセルされます。
- **リクエストに関連付けられた値**: リクエストに固有の値を格納します。

Contextは、ゴルーチン間の同期やリソースの解放、サーバのグレースフルシャットダウン、分散システムにおける不要な処理の防止など、様々な場面で役立ちます。

## Contextの作成

contextパッケージには、Contextを作成するための関数がいくつか用意されています。

| Context Type | Creation Function | Description |
|--------------|-------------------|-------------|
| Background | `context.Background()` | 空のContextを返します。これは通常、メイン関数、初期化、テスト、および着信リクエストのトップレベルのContextとして使用されます。 |
| TODO | `context.TODO()` | どのContextを使用するか不明な場合、またはまだ使用できない場合（周囲の関数がContextパラメータを受け入れるように拡張されていないため）に使用されます。 |

## Contextの派生

既存のContextから新しいContextを派生させることができます。

| Context Type | Creation Function | Description |
|--------------|-------------------|-------------|
| Cancelable context | `context.WithCancel(parent Context)` | 新しいDoneチャネルを持つ親のコピーを返します。返されたContextのDoneチャネルは、返されたキャンセル関数が呼び出されたとき、または親ContextのDoneチャネルが閉じられたときのいずれか早い方のタイミングで閉じられます。 |
| Context with Deadline | `context.WithDeadline(parent Context, deadline time.Time)` | 指定された期限までにキャンセルされる新しいContextを返します。 |
| Context with Timeout | `context.WithTimeout(parent Context, timeout time.Duration)` | 指定された期間が経過した後にキャンセルされる新しいContextを返します。 |
| Context with Value | `context.WithValue(parent Context, key, val interface{})` | 親Contextをラップし、キーと値のペアを追加した新しいContextを作成します。 |
| Context with Cancel Cause | `context.WithCancelCause(parent Context)` | キャンセルの原因となるエラーを指定できるキャンセル可能なContextを返します。 |
| Context with Deadline Cause | `context.WithDeadlineCause(parent Context, d time.Time, cause error)` | キャンセルの原因となるエラーを指定できる、指定された期限までにキャンセルされるContextを返します。 |
| Context with Timeout Cause | `context.WithTimeoutCause(parent Context, timeout time.Duration, cause error)` | キャンセルの原因となるエラーを指定できる、指定された期間が経過した後にキャンセルされるContextを返します。 |
| Non-cancelable context | `context.WithoutCancel(parent Context)` | キャンセルできない親Contextのコピーを返します。 |

`context.WithCancelCause`, `context.WithDeadlineCause`, `context.WithTimeoutCause`で作成されたContextは、`context.Cause`関数を使用してキャンセルの原因となったエラーを取得できます。

## contextパッケージの内部構造

contextパッケージのソースコードを見ると、Contextはインターフェースとして定義されており、`Deadline()`, `Done()`, `Err()`, `Value()` の4つのメソッドを持っています。

- `context.Background()`と`context.TODO()`は、空のContextを返す関数ですが、内部的にはそれぞれ`backgroundCtx`構造体と`todoCtx`構造体として実装されています。これらの構造体は、Contextインターフェースを満たすための最小限の実装を提供しています。
- `context.WithValue()`は、親Contextとキー、値を保持する`valueCtx`構造体を返します。`valueCtx`は親Contextを埋め込むことで、値の探索を再帰的に行うことができます。
- `context.WithCancel()`は、キャンセル可能なContextを返す関数で、内部的には`cancelCtx`構造体として実装されています。`cancelCtx`は、Doneチャネルを閉じるためのキャンセル関数と、キャンセル状態を管理するためのミューテックスなどを保持しています。
- `context.WithDeadline()`と`context.WithTimeout()`は、それぞれ指定された期限とタイムアウトを持つContextを返す関数で、内部的には`timerCtx`構造体として実装されています。`timerCtx`は、`cancelCtx`を埋め込み、さらにデッドラインまたはタイムアウトを管理するためのタイマーを保持しています。

## Contextの使用方法

Contextは、ゴルーチンにキャンセルシグナルを送信したり、タイムアウトを設定したり、リクエストに関連付けられた値を格納したりするために使用できます。

### キャンセルの例

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	// context.WithCancelでキャンセル可能なcontextを作成
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // 関数終了時にキャンセルを実行

	go func(ctx context.Context) {
		for {
			select {
			case <-ctx.Done(): // キャンセルシグナルを受信
				fmt.Println("work canceled")
				return
			default:
				fmt.Println("working...")
				time.Sleep(500 * time.Millisecond)
			}
		}
	}(ctx)

	time.Sleep(2 * time.Second) // 2秒後にキャンセル
}
```

この例では、`context.WithCancel`を使用してキャンセル可能なContextを作成し、ゴルーチンに渡しています。2秒後に`cancel()`関数を呼び出すことで、Contextがキャンセルされ、ゴルーチン内の`ctx.Done()`チャネルが閉じられます。これにより、ゴルーチンはループを終了し、"work canceled"と出力して終了します。

### タイムアウトの例

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	// context.WithTimeoutでタイムアウトを設定したcontextを作成
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel() // 関数終了時にキャンセルを実行

	go func(ctx context.Context) {
		for {
			select {
			case <-ctx.Done(): // タイムアウト
				fmt.Println("work canceled:", ctx.Err())
				return
			default:
				fmt.Println("working...")
				time.Sleep(500 * time.Millisecond)
			}
		}
	}(ctx)

	time.Sleep(3 * time.Second) // 3秒待機（タイムアウト発生）
}
```

この例では、`context.WithTimeout`を使用して2秒のタイムアウトを設定したContextを作成し、ゴルーチンに渡しています。ゴルーチン内の処理が2秒以内に終わらない場合、`ctx.Done()`チャネルが閉じられ、"work canceled: context deadline exceeded"と出力してゴルーチンは終了します。

### リクエストに関連付けられた値の例

```go
package main

import (
	"context"
	"fmt"
)

func main() {
	// context.WithValueで値を設定したcontextを作成
	ctx := context.WithValue(context.Background(), "requestID", 12345)

	go func(ctx context.Context) {
		// contextから値を取得
		requestID := ctx.Value("requestID").(int)
		fmt.Println("requestID:", requestID)
	}(ctx)
}
```

この例では、`context.WithValue`を使用して`requestID`というキーに`12345`という値を関連付けたContextを作成し、ゴルーチンに渡しています。ゴルーチン内では、`ctx.Value("requestID")`で値を取得し、"requestID: 12345"と出力します。

## HTTPサーバでのContextの利用例

contextパッケージは、HTTPサーバにおいても非常に有用です。例えば、クライアントからのリクエストを処理する際に、タイムアウトを設定したり、リクエストのキャンセルを処理したりすることができます。

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

func handler(w http.ResponseWriter, r *http.Request) {
	// リクエストごとにcontext.WithTimeoutでタイムアウトを設定
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// contextをreqに設定
	r = r.WithContext(ctx)

	select {
	case <-time.After(10 * time.Second): // 10秒かかる処理をシミュレート
		fmt.Fprintln(w, "response")
	case <-ctx.Done():
		fmt.Fprintln(w, "handler canceled:", ctx.Err())
	}
}

func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}
```

この例では、`handler`関数内で`context.WithTimeout`を使用して5秒のタイムアウトを設定したContextを作成し、`r.WithContext(ctx)`でリクエストにContextを設定しています。リクエスト処理が5秒以内に終わらない場合、`ctx.Done()`チャネルが閉じられ、"handler canceled: context deadline exceeded"と出力します。

## ベストプラクティス

1. **Contextを最初の引数として渡す**: 関数にContextを渡すときは、常に最初の引数として渡します。これにより、コードの可読性が向上し、関数がキャンセルをサポートしていること、またはデッドラインがあることが明確になります。

2. **構造体にContextを格納しない**: Contextは明示的に関数に渡す必要があり、構造体やグローバル変数に格納してはいけません。Contextは、リクエストのスコープ内でのみ有効であり、構造体などに格納すると、意図しない動作を引き起こす可能性があります。

3. **nil Contextを渡さない**: nilのContextを渡すと、予期しない動作やパニックが発生する可能性があります。Contextがnilの場合には、`context.Background()`または`context.TODO()`を使用して、適切なContextを作成してください。

4. **context.WithValueは控えめに使用する**: `context.WithValue`は、リクエストに関連付けられたデータにのみ使用します。関数のオプションパラメータを渡すために使用しないでください。`context.WithValue`を過度に使用すると、Contextツリーが深くなり、値の取得に時間がかかるため、パフォーマンスの低下につながる可能性があります。

5. **キャンセルを適切に処理する**: `ctx.Done()`を常にチェックして、キャンセルを処理します。ゴルーチン内でContextのキャンセルを無視すると、リソースリークや意図しない動作につながる可能性があります。

6. **必要に応じてデッドラインを設定する**: タイムアウトとデッドラインを使用して、ゴルーチンが無期限に実行されないようにします。特に、外部リソースにアクセスするゴルーチンなど、処理時間に制限を設ける必要がある場合には、タイムアウトやデッドラインを設定することで、リソースの浪費を防ぐことができます。

7. **キャンセル関数を呼び出す**: `context.WithCancel`, `context.WithDeadline`, `context.WithTimeout`などで作成したContextは、`CancelFunc`を返します。`CancelFunc`を呼び出すことで、Contextをキャンセルし、関連するリソースを解放することができます。`CancelFunc`を呼び出さないと、Contextがキャンセルされず、リソースリークが発生する可能性があります。

## 注意点

1. **Contextの値の過剰な使用**: `context.WithValue`を過度に使用すると、依存関係が不明確になり、コードの保守が難しくなる可能性があります。また、値の取得は線形探索で行われるため、パフォーマンスの低下にもつながります。

2. **ゴルーチンのリーク**: Contextで開始されたゴルーチンは、Doneチャネルをチェックして適切に終了する必要があります。そうしないと、Contextがキャンセルされた後もゴルーチンが実行され続け、リソースリークが発生する可能性があります。

3. **ブロッキング呼び出しの使用**: ファイル/ネットワークIOなどのブロッキング呼び出しは、Contextのキャンセルをチェックするようにラップする必要があります。ブロッキング呼び出し中にContextがキャンセルされた場合、処理が中断されずにハングアップする可能性があります。

## まとめ

contextパッケージは、Goの並行処理を管理するための強力なツールであり、goroutineのキャンセル、タイムアウト、goroutine間でのデータ共有などを安全かつ効率的に行うために不可欠です。

本稿では、contextパッケージの基礎から応用、ベストプラクティス、注意点までを解説しました。これらの情報を参考に、contextパッケージを効果的に活用することで、より堅牢で保守性の高い並行処理アプリケーションを開発することができます。

## 参考資料

1. [Go公式ドキュメント - context](https://pkg.go.dev/context)
2. [Goのcontextパッケージのセマンティクス](https://www.ardanlabs.com/blog/2019/09/context-package-semantics-in-go.html)
3. [GoのContextパッケージをマスターする](https://medium.com/@ksandeeptech07/mastering-gos-context-package-a-detailed-guide-with-examples-for-effective-concurrency-management-26d3f55a179a)
4. [Goにおけるコンテキスト](https://dzone.com/articles/contexts-in-go-a-comprehensive-guide)
5. [Goのコンテキスト](https://www.kelche.co/blog/go/golang-context/)
6. [Go contextの落とし穴](https://www.calhoun.io/pitfalls-of-context-values-and-how-to-avoid-or-mitigate-them/)
7. [Goにおけるコンテキストの完全ガイド](https://medium.com/@jamal.kaksouri/the-complete-guide-to-context-in-golang-efficient-concurrency-management-43d722f6eaea)
8. [Go context APIと使用のベストプラクティス](https://www.reddit.com/r/golang/comments/10qf73m/context_api_and_best_practices_of_using_it/)

## 引用文献

1. context - Go Packages, 3月 4, 2025にアクセス、 https://pkg.go.dev/context
2. What is Context in Go? - ByteSizeGo, 3月 4, 2025にアクセス、 https://www.bytesizego.com/blog/context-golang
3. net/context/context.go at master · golang/net · GitHub, 3月 4, 2025にアクセス、 https://github.com/golang/net/blob/master/context/context.go
4. context package - golang.org/x/net/context - Go Packages, 3月 4, 2025にアクセス、 https://pkg.go.dev/golang.org/x/net/context
5. Putting Go's Context package into context - meain/blog, 3月 4, 2025にアクセス、 https://blog.meain.io/2024/golang-context/
6. Mastering Go's Context Package: A Detailed Guide with Examples for Effective Concurrency Management | by Sandeep | Medium, 3月 4, 2025にアクセス、 https://medium.com/@ksandeeptech07/mastering-gos-context-package-a-detailed-guide-with-examples-for-effective-concurrency-management-26d3f55a179a
7. Contexts in Go: A Comprehensive Guide - DZone, 3月 4, 2025にアクセス、 https://dzone.com/articles/contexts-in-go-a-comprehensive-guide
8. Context - Go by Example, 3月 4, 2025にアクセス、 https://gobyexample.com/context
9. Context API and best practices of using it - golang - Reddit, 3月 4, 2025にアクセス、 https://www.reddit.com/r/golang/comments/10qf73m/context_api_and_best_practices_of_using_it/
10. The Complete Guide to Context in Golang: Efficient Concurrency Management - Medium, 3月 4, 2025にアクセス、 https://medium.com/@jamal.kaksouri/the-complete-guide-to-context-in-golang-efficient-concurrency-management-43d722f6eaea
11. useContext - React, 3月 4, 2025にアクセス、 https://react.dev/reference/react/useContext
12. Pitfalls of context values and how to avoid or mitigate them in Go - Calhoun.io, 3月 4, 2025にアクセス、 https://www.calhoun.io/pitfalls-of-context-values-and-how-to-avoid-or-mitigate-them/
13. Context Package Semantics In Go - Ardan Labs, 3月 4, 2025にアクセス、 https://www.ardanlabs.com/blog/2019/09/context-package-semantics-in-go.html
14. Golang Context (A Complete Guide) - Kelche, 3月 4, 2025にアクセス、 https://www.kelche.co/blog/go/golang-context/