# neverthrow チートシート

## 概要

Rustの`Result`型にインスパイアされた型安全なエラー処理ライブラリ。例外をスローする代わりに、成功（`Ok`）または失敗（`Err`）を表現する`Result`型を使用。

```ts
// npm
import { err, ok, Result, ResultAsync } from "neverthrow";

// Deno
import { err, ok, Result, ResultAsync } from "npm:neverthrow";
```

## 基本的な使い方

### 同期処理

```ts
// 成功の結果を作成
const success = ok<number, string>(5);
success.isOk(); // true
success.isErr(); // false

// 失敗の結果を作成
const failure = err<number, string>("エラーが発生しました");
failure.isOk(); // false
failure.isErr(); // true

// 結果の処理
const result = success.match(
  (value) => `成功: ${value}`,
  (error) => `失敗: ${error}`,
);
// "成功: 5"
```

### 非同期処理

```ts
// 成功の非同期結果
const successAsync = okAsync<number, string>(5);

// 失敗の非同期結果
const failureAsync = errAsync<number, string>("エラーが発生しました");

// Promiseを安全に扱う
const fetchData = (url: string): ResultAsync<any, Error> => {
  return ResultAsync.fromPromise(
    fetch(url).then((res) => res.json()),
    (error) => new Error(`APIエラー: ${error}`),
  );
};

// 非同期結果の処理
fetchData("https://api.example.com/data")
  .map((data) => data.items)
  .mapErr((error) => `取得エラー: ${error.message}`)
  .match(
    (items) => console.log("取得成功:", items),
    (error) => console.error("取得失敗:", error),
  );
```

## 主要な型

| 型                  | 説明                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `Result<T, E>`      | 成功値の型`T`とエラー値の型`E`をジェネリック型として持つ結果型    |
| `Ok<T, E>`          | `Result<T, E>`の成功バリアント。成功値`T`を保持                   |
| `Err<T, E>`         | `Result<T, E>`の失敗バリアント。エラー値`E`を保持                 |
| `ResultAsync<T, E>` | `Result<T, E>`の非同期版。内部的に`Promise<Result<T, E>>`をラップ |

## メソッド一覧

### Result型のメソッド

| カテゴリ             | メソッド                 | 説明                                                   |
| -------------------- | ------------------------ | ------------------------------------------------------ |
| **検査**             | `isOk()`                 | 結果が成功かどうかを返す                               |
|                      | `isErr()`                | 結果が失敗かどうかを返す                               |
| **マッピング**       | `map(fn)`                | 成功値を変換                                           |
|                      | `mapErr(fn)`             | エラー値を変換                                         |
|                      | `andThen(fn)`            | 成功値から別の結果を生成（flatMap）                    |
|                      | `orElse(fn)`             | エラー値から別の結果を生成                             |
|                      | `asyncMap(fn)`           | 成功値を非同期で変換                                   |
|                      | `asyncAndThen(fn)`       | 成功値から非同期結果を生成                             |
| **利用**             | `match(okFn, errFn)`     | 結果に応じて異なる関数を実行                           |
|                      | `unwrapOr(defaultValue)` | 成功値か、エラー時はデフォルト値を返す                 |
| **サイドエフェクト** | `andTee(fn)`             | 成功値でサイドエフェクトを実行し、元の結果を返す       |
|                      | `orTee(fn)`              | エラー値でサイドエフェクトを実行し、元の結果を返す     |
|                      | `andThrough(fn)`         | 成功値でサイドエフェクトを実行し、発生したエラーを伝播 |

### ResultAsync型のメソッド

| カテゴリ             | メソッド                 | 説明                                                   |
| -------------------- | ------------------------ | ------------------------------------------------------ |
| **マッピング**       | `map(fn)`                | 成功値を変換（同期/非同期）                            |
|                      | `mapErr(fn)`             | エラー値を変換（同期/非同期）                          |
|                      | `andThen(fn)`            | 成功値から別の結果を生成（同期/非同期）                |
|                      | `orElse(fn)`             | エラー値から別の結果を生成（同期/非同期）              |
| **利用**             | `match(okFn, errFn)`     | 結果に応じて異なる関数を実行                           |
|                      | `unwrapOr(defaultValue)` | 成功値か、エラー時はデフォルト値を返す                 |
| **サイドエフェクト** | `andTee(fn)`             | 成功値でサイドエフェクトを実行し、元の結果を返す       |
|                      | `orTee(fn)`              | エラー値でサイドエフェクトを実行し、元の結果を返す     |
|                      | `andThrough(fn)`         | 成功値でサイドエフェクトを実行し、発生したエラーを伝播 |

### 静的メソッド

| クラス        | メソッド                        | 説明                                               |
| ------------- | ------------------------------- | -------------------------------------------------- |
| `Result`      | `fromThrowable(fn, errorFn)`    | 例外をスローする関数を`Result`を返す関数に変換     |
|               | `combine(results)`              | 複数の結果を組み合わせる（1つのエラーで中断）      |
|               | `combineWithAllErrors(results)` | 複数の結果を組み合わせ、すべてのエラーを収集       |
| `ResultAsync` | `fromPromise(promise, errorFn)` | Promiseを非同期結果に変換                          |
|               | `fromSafePromise(promise)`      | 拒否されないPromiseを非同期結果に変換              |
|               | `fromThrowable(fn, errorFn)`    | 例外をスローする非同期関数を変換                   |
|               | `combine(results)`              | 複数の非同期結果を組み合わせる                     |
|               | `combineWithAllErrors(results)` | 複数の非同期結果を組み合わせ、すべてのエラーを収集 |

### トップレベルユーティリティ

```ts
// 例外をスローする関数をラップ
const safeJsonParse = fromThrowable(
  JSON.parse,
  (error) => `JSON解析エラー: ${error}`,
);

// 非同期関数をラップ
const safeFetch = fromPromise(
  fetch("https://api.example.com/data"),
  (error) => new Error(`APIエラー: ${error}`),
);
```

## よく使うパターン

### エラー処理パイプライン

```ts
validateInput(input)
  .map(sanitize)
  .andThen(saveToDatabase)
  .mapErr(logError)
  .match(
    (result) => console.log("成功:", result),
    (error) => console.error("エラー:", error),
  );
```

### 複数の結果の組み合わせ

```ts
// すべての結果が成功なら成功
const results = [ok(1), ok(2), ok(3)];
const combined = Result.combine(results);
// Ok([1, 2, 3])

// 1つでも失敗があれば最初の失敗
const mixedResults = [ok(1), err("エラー"), ok(3)];
const combinedMixed = Result.combine(mixedResults);
// Err('エラー')

// すべてのエラーを収集
const withAllErrors = Result.combineWithAllErrors(mixedResults);
// Err(['エラー'])
```

### APIクライアント実装例

```ts
type ApiError =
  | { type: "network"; message: string }
  | { type: "unauthorized"; message: string }
  | { type: "notFound"; message: string };

function fetchUser(id: string): ResultAsync<User, ApiError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then((res) => {
      if (!res.ok) {
        if (res.status === 404) throw { type: "notFound" };
        if (res.status === 401) throw { type: "unauthorized" };
        throw new Error(`HTTP error: ${res.status}`);
      }
      return res.json();
    }),
    (error) => {
      if ((error as any).type) return error as ApiError;
      return { type: "network", message: String(error) };
    },
  );
}

// 使用例
fetchUser("123")
  .match(
    (user) => console.log("ユーザー:", user),
    (error) => {
      switch (error.type) {
        case "notFound":
          console.error("ユーザーが見つかりません");
          break;
        case "unauthorized":
          console.error("権限がありません");
          break;
        case "network":
          console.error(`ネットワークエラー: ${error.message}`);
          break;
      }
    },
  );
```

## ESLint プラグイン

eslint-plugin-neverthrow を使用して、未処理の Result を検出。

```bash
npm install --save-dev eslint-plugin-neverthrow
```

結果を処理する3つの方法:

- `.match()` の呼び出し
- `.unwrapOr()` の呼び出し
- `.unsafeUnwrap()` の呼び出し（テストのみ）

## 参考リンク

- [GitHub](https://github.com/supermacro/neverthrow)
- [npm](https://www.npmjs.com/package/neverthrow)
- [ESLintプラグイン](https://github.com/mdbetancourt/eslint-plugin-neverthrow)
