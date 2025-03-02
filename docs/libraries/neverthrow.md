# neverthrow

## 概要

neverthrowは、TypeScriptとJavaScriptのための型安全なエラー処理ライブラリです。Rustの`Result`型にインスパイアされており、例外をスローする代わりに、成功（`Ok`）または失敗（`Err`）を表現する`Result`型を使用します。

このライブラリを使用すると、例外処理に関連する問題（捕捉されない例外、制御フローの予測困難性など）を回避しながら、型安全でエラーを明示的に処理することができます。また、非同期処理のための`ResultAsync`クラスも提供しており、Promiseを`Result`型でラップすることができます。

## 基本的な使い方

### インストール

```bash
npm install neverthrow
# または
yarn add neverthrow
```

### 同期処理の基本例

```typescript
import { ok, err, Result } from 'neverthrow';

// 成功の結果を表現
const success: Result<number, string> = ok(5);
success.isOk(); // true
success.isErr(); // false

// 失敗の結果を表現
const failure: Result<number, string> = err("エラーが発生しました");
failure.isOk(); // false
failure.isErr(); // true

// 結果の処理
const processResult = (result: Result<number, string>): string => {
  return result.match(
    (value) => `成功: ${value}`,
    (error) => `失敗: ${error}`
  );
};

console.log(processResult(success)); // "成功: 5"
console.log(processResult(failure)); // "失敗: エラーが発生しました"
```

### 非同期処理の基本例

```typescript
import { okAsync, errAsync, ResultAsync } from 'neverthrow';

// 成功の非同期結果
const successAsync: ResultAsync<number, string> = okAsync(5);

// 失敗の非同期結果
const failureAsync: ResultAsync<number, string> = errAsync("エラーが発生しました");

// Promiseを安全に扱う
const fetchData = (url: string): ResultAsync<any, Error> => {
  return ResultAsync.fromPromise(
    fetch(url).then(res => res.json()),
    (error) => new Error(`APIエラー: ${error}`)
  );
};

// 非同期結果の処理
fetchData('https://api.example.com/data')
  .map(data => data.items)
  .mapErr(error => `取得エラー: ${error.message}`)
  .match(
    (items) => console.log('取得成功:', items),
    (error) => console.error('取得失敗:', error)
  );
```

## 主な機能

### Result型

`Result<T, E>`は、成功値の型`T`とエラー値の型`E`をジェネリック型として持つ型で、次の2つのバリアントがあります：

- `Ok<T, E>`: 成功値`T`を保持
- `Err<T, E>`: エラー値`E`を保持

これにより、例外をスローする代わりに、関数の戻り値としてエラー状態を明示的に返すことができます。

### ResultAsync型

`ResultAsync<T, E>`は`Result<T, E>`の非同期版で、内部的に`Promise<Result<T, E>>`をラップします。これにより、非同期操作に対しても同じエラー処理パターンを適用できます。

### パイプライン処理

neverthrowは関数型プログラミングのパイプラインパターンをサポートしており、`map`、`mapErr`、`andThen`などのメソッドを使用して、結果を連鎖的に処理できます。

```typescript
const result = validateInput(input)
  .map(sanitize)
  .andThen(saveToDatabase)
  .mapErr(logError);
```

### 例外のラッピング

サードパーティのライブラリが例外をスローする場合、neverthrowの`fromThrowable`や`fromPromise`を使用して、それらの例外を`Result`型に安全に変換できます。

```typescript
const safeJsonParse = Result.fromThrowable(
  JSON.parse,
  (error) => `JSON解析エラー: ${error}`
);

const result = safeJsonParse('{"name": "John"}');
// Ok({ name: 'John' })

const badResult = safeJsonParse('{"name": ');
// Err('JSON解析エラー: SyntaxError: Unexpected end of JSON input')
```

### 複数の結果の組み合わせ

`Result.combine`を使用して、複数の結果を1つの結果にまとめることができます。すべての結果が`Ok`の場合は成功値の配列を含む`Ok`を返し、いずれかが`Err`の場合は最初のエラーを返します。

```typescript
const results = [ok(1), ok(2), ok(3)];
const combined = Result.combine(results);
// Ok([1, 2, 3])

const mixedResults = [ok(1), err('エラー'), ok(3)];
const combinedMixed = Result.combine(mixedResults);
// Err('エラー')
```

## APIリファレンス

### 同期API (Result)

#### 結果の作成

- `ok<T, E>(value: T): Ok<T, E>` - 成功の結果を作成
- `err<T, E>(error: E): Err<T, E>` - 失敗の結果を作成

#### 結果の検査

- `isOk(): boolean` - 結果が`Ok`かどうかを確認
- `isErr(): boolean` - 結果が`Err`かどうかを確認

#### マッピングと変換

- `map<U>(fn: (value: T) => U): Result<U, E>` - 成功値を変換
- `mapErr<F>(fn: (error: E) => F): Result<T, F>` - エラー値を変換
- `andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>` - 成功値から別の結果を生成
- `orElse<U, A>(fn: (error: E) => Result<U, A>): Result<T | U, A>` - エラー値から別の結果を生成
- `asyncMap<U>(fn: (value: T) => Promise<U>): ResultAsync<U, E>` - 成功値を非同期で変換
- `asyncAndThen<U, F>(fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F>` - 成功値から非同期結果を生成

#### 結果の利用

- `match<A, B = A>(okFn: (value: T) => A, errFn: (error: E) => B): A | B` - 結果に応じて異なる関数を実行
- `unwrapOr<A>(defaultValue: A): T | A` - 成功値か、エラー時はデフォルト値を返す

#### サイドエフェクト

- `andTee(fn: (value: T) => unknown): Result<T, E>` - 成功値でサイドエフェクトを実行し、元の結果を返す
- `orTee(fn: (error: E) => unknown): Result<T, E>` - エラー値でサイドエフェクトを実行し、元の結果を返す
- `andThrough<F>(fn: (value: T) => Result<unknown, F>): Result<T, E | F>` - 成功値でサイドエフェクトを実行し、エラーを伝播

#### 静的メソッド

- `Result.fromThrowable<F extends Function, E>(fn: F, errorFn?: (error: unknown) => E): (...args: Parameters<F>) => Result<ReturnType<F>, E>` - 例外をスローする関数を`Result`を返す関数に変換
- `Result.combine<T, E>(results: Result<T, E>[]): Result<T[], E>` - 複数の結果を組み合わせる
- `Result.combineWithAllErrors<T, E>(results: Result<T, E>[]): Result<T[], E[]>` - 複数の結果を組み合わせ、すべてのエラーを収集

### 非同期API (ResultAsync)

#### 結果の作成

- `okAsync<T, E>(value: T): ResultAsync<T, E>` - 成功の非同期結果を作成
- `errAsync<T, E>(error: E): ResultAsync<T, E>` - 失敗の非同期結果を作成

#### Promiseの変換

- `ResultAsync.fromPromise<T, E>(promise: Promise<T>, errorFn: (error: unknown) => E): ResultAsync<T, E>` - Promiseを非同期結果に変換
- `ResultAsync.fromSafePromise<T, E>(promise: Promise<T>): ResultAsync<T, E>` - 拒否されないPromiseを非同期結果に変換
- `ResultAsync.fromThrowable<F extends Function, E>(fn: F, errorFn?: (error: unknown) => E): (...args: Parameters<F>) => ResultAsync<ReturnType<F>, E>` - 非同期関数を非同期結果を返す関数に変換

#### マッピングと変換

- `map<U>(fn: (value: T) => U | Promise<U>): ResultAsync<U, E>` - 成功値を変換（同期または非同期）
- `mapErr<F>(fn: (error: E) => F | Promise<F>): ResultAsync<T, F>` - エラー値を変換（同期または非同期）
- `andThen<U, F>(fn: (value: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F>` - 成功値から別の結果を生成
- `orElse<U, A>(fn: (error: E) => Result<U, A> | ResultAsync<U, A>): ResultAsync<T | U, A>` - エラー値から別の結果を生成

#### 結果の利用

- `match<A, B = A>(okFn: (value: T) => A, errFn: (error: E) => B): Promise<A | B>` - 結果に応じて異なる関数を実行
- `unwrapOr<A>(defaultValue: A): Promise<T | A>` - 成功値か、エラー時はデフォルト値を返す

#### サイドエフェクト

- `andTee(fn: (value: T) => unknown): ResultAsync<T, E>` - 成功値でサイドエフェクトを実行し、元の結果を返す
- `orTee(fn: (error: E) => unknown): ResultAsync<T, E>` - エラー値でサイドエフェクトを実行し、元の結果を返す
- `andThrough<F>(fn: (value: T) => Result<unknown, F> | ResultAsync<unknown, F>): ResultAsync<T, E | F>` - 成功値でサイドエフェクトを実行し、エラーを伝播

#### 静的メソッド

- `ResultAsync.combine<T, E>(results: ResultAsync<T, E>[]): ResultAsync<T[], E>` - 複数の非同期結果を組み合わせる
- `ResultAsync.combineWithAllErrors<T, E>(results: ResultAsync<T, E>[]): ResultAsync<T[], E[]>` - 複数の非同期結果を組み合わせ、すべてのエラーを収集

### ユーティリティ

- `fromThrowable` - `Result.fromThrowable`のトップレベルエクスポート
- `fromAsyncThrowable` - `ResultAsync.fromThrowable`のトップレベルエクスポート
- `fromPromise` - `ResultAsync.fromPromise`のトップレベルエクスポート
- `fromSafePromise` - `ResultAsync.fromSafePromise`のトップレベルエクスポート
- `safeTry` - ジェネレータ関数を使用した簡潔なエラー処理を提供するユーティリティ

## ベストプラクティス

### 「期待されるエラー」と「予期せぬエラー」の区別

neverthrowは主に「期待されるエラー」（入力検証エラー、ネットワークエラーなど）を処理するためのものです。システムクラッシュのような「予期せぬエラー」や「回復不能なエラー」に対しては、通常の例外メカニズムの使用が適しています。

### サードパーティコードのラッピング

JavaScriptのエコシステムでは例外をスローすることが一般的です。サードパーティライブラリを使用する場合は、それらを`try/catch`ブロックでラップし、例外を`Result`型に変換することをお勧めします。

```typescript
// 同期的な例
const safeJsonParse = (jsonString: string): Result<any, string> => {
  try {
    return ok(JSON.parse(jsonString));
  } catch (e) {
    return err(`解析エラー: ${e}`);
  }
};

// 非同期の例
const fetchBook = (id: string): ResultAsync<Book, Error> => ResultAsync.fromPromise(
  axios.get(`/api/books/${id}`).then(res => res.data),
  (error) => new Error(`API呼び出しエラー: ${error}`)
);
```

### eslint-plugin-neverthrowの使用

neverthrowには公式のESLintプラグイン「eslint-plugin-neverthrow」があり、`Result`型の結果が処理されずに無視されることを防止します。このプラグインは以下の3つの方法で結果を消費することを強制します：

- `.match()`の呼び出し
- `.unwrapOr()`の呼び出し
- `._unsafeUnwrap()`の呼び出し（テスト環境のみ）

```bash
npm install --save-dev eslint-plugin-neverthrow
```

### 型と関数パイプラインでの思考

neverthrowを使用する際は、型と関数パイプラインの観点からコードを設計することを推奨します。各関数はドメイン固有の入力と出力の型を持ち、これらの関数を`map`や`andThen`などのメソッドでチェーンすることで複雑な処理を表現できます。

## 使用例

### ユーザー登録フロー

```typescript
import { Result, ResultAsync, ok, err } from 'neverthrow';

type User = { id: string; name: string; email: string };
type ValidationError = { field: string; message: string };
type DatabaseError = { code: number; message: string };

// 入力バリデーション
const validateUserInput = (input: any): Result<User, ValidationError[]> => {
  const errors: ValidationError[] = [];
  
  if (!input.name || typeof input.name !== 'string') {
    errors.push({ field: 'name', message: '名前は必須です' });
  }
  
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({ field: 'email', message: '有効なメールアドレスを入力してください' });
  }
  
  return errors.length === 0
    ? ok({ id: crypto.randomUUID(), name: input.name, email: input.email })
    : err(errors);
};

// データベース保存
const saveUserToDatabase = (user: User): ResultAsync<User, DatabaseError> => {
  // 実際のデータベース保存処理をここに実装
  return ResultAsync.fromPromise(
    db.users.create(user),
    (error) => ({ code: 500, message: `ユーザー保存エラー: ${error}` })
  );
};

// メール送信
const sendWelcomeEmail = (user: User): ResultAsync<void, string> => {
  return ResultAsync.fromPromise(
    emailService.send({
      to: user.email,
      subject: 'ようこそ！',
      body: `${user.name}さん、ご登録ありがとうございます。`
    }),
    (error) => `メール送信エラー: ${error}`
  );
};

// 完全なユーザー登録フロー
const registerUser = (input: any): ResultAsync<User, ValidationError[] | DatabaseError | string> => {
  return validateUserInput(input)
    .asyncAndThen(saveUserToDatabase)
    .andThen((user) => {
      return sendWelcomeEmail(user)
        .map(() => user); // メール送信後にユーザーオブジェクトを返す
    });
};

// 使用例
registerUser({ name: '山田太郎', email: 'taro@example.com' })
  .match(
    (user) => console.log(`ユーザー ${user.name} が登録されました`),
    (error) => console.error('登録エラー:', error)
  );
```

### APIクライアント

```typescript
import { ResultAsync } from 'neverthrow';
import axios, { AxiosError } from 'axios';

type ApiError = 
  | { type: 'network'; message: string }
  | { type: 'unauthorized'; message: string }
  | { type: 'notFound'; message: string }
  | { type: 'server'; message: string };

class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  get<T>(path: string): ResultAsync<T, ApiError> {
    return ResultAsync.fromPromise(
      axios.get<T>(`${this.baseUrl}${path}`).then(res => res.data),
      (error) => this.handleApiError(error)
    );
  }
  
  post<T, D>(path: string, data: D): ResultAsync<T, ApiError> {
    return ResultAsync.fromPromise(
      axios.post<T>(`${this.baseUrl}${path}`, data).then(res => res.data),
      (error) => this.handleApiError(error)
    );
  }
  
  private handleApiError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      switch (axiosError.response?.status) {
        case 401:
          return { type: 'unauthorized', message: '認証エラー' };
        case 404:
          return { type: 'notFound', message: 'リソースが見つかりません' };
        default:
          return { 
            type: 'server', 
            message: `サーバーエラー: ${axiosError.response?.status || 'unknown'}`
          };
      }
    }
    
    return { 
      type: 'network', 
      message: error instanceof Error ? error.message : '不明なエラー'
    };
  }
}

// 使用例
const api = new ApiClient('https://api.example.com');

api.get<{ items: any[] }>('/items')
  .map(data => data.items)
  .match(
    (items) => console.log('取得成功:', items),
    (error) => {
      switch (error.type) {
        case 'unauthorized':
          console.error('認証が必要です');
          break;
        case 'notFound':
          console.error('アイテムが見つかりません');
          break;
        default:
          console.error(error.message);
      }
    }
  );
```

## 他の類似ライブラリとの比較

### try-catch との比較

- **neverthrow**: エラーを型で表現し、明示的な処理を強制。コンパイル時のエラーチェックが可能。
- **try-catch**: 暗黙的なエラー処理。型の安全性がなく、捕捉されない例外のリスクがある。

### fp-ts/Either との比較

- **neverthrow**: シンプルなAPIと使いやすさに焦点。より直感的で取り入れやすい。
- **fp-ts/Either**: より広範な関数型プログラミング機能を提供。より強力だが学習曲線が急。

### ts-results との比較

- **neverthrow**: より広範なAPIと機能（ResultAsync、サイドエフェクト処理など）。
- **ts-results**: よりシンプルなAPIで、基本的な機能に焦点。

### resultar との比較

- **neverthrow**: より成熟していて、コミュニティのサポートが広い。
- **resultar**: neverthrowに影響を受けたライブラリで、類似の機能を提供するが、開発がアクティブではない可能性がある。

## まとめ

neverthrowは、TypeScriptとJavaScriptプロジェクトに型安全なエラー処理を導入するための強力なツールです。Rustの`Result`型にインスパイアされた設計により、例外を投げる従来のアプローチの弱点を克服し、明示的で予測可能なエラー処理を可能にします。

このライブラリの主な利点は以下の通りです：

1. **型安全性**: コンパイル時にエラー処理の漏れを検出
2. **明示的なエラー処理**: すべてのエラーケースを考慮するようコードを構造化
3. **関数型アプローチ**: 関数合成とパイプラインをサポート
4. **非同期サポート**: Promiseベースの非同期コードでも同じパターンを使用可能
5. **テスト容易性**: 明示的なエラーパスにより、テストが書きやすくなる

neverthrowは、堅牢で保守性の高いアプリケーションを構築するために、あらゆる規模のプロジェクトで役立ちます。特に、エラー処理が重要な領域（APIクライアント、データ処理パイプライン、ユーザー入力検証など）で威力を発揮します。

## 参考リンク

- [公式GitHub](https://github.com/supermacro/neverthrow)
- [npmパッケージ](https://www.npmjs.com/package/neverthrow)
- [ESLintプラグイン](https://github.com/mdbetancourt/eslint-plugin-neverthrow)
- [エラー処理ベストプラクティス](https://github.com/supermacro/neverthrow/wiki/Error-Handling-Best-Practices)
- [Rust Result型ドキュメント](https://doc.rust-lang.org/std/result/) (インスピレーション源)