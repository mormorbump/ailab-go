# TypeScriptにおけるAdapterパターン

TypeScriptでのAdapterパターンは、外部依存を抽象化し、テスト可能なコードを実現するためのパターンです。

## 基本的な考え方

1. インターフェースで抽象化する
2. 実装は関数かclassで提供する
3. テストではモック実装を使用する
4. エラー処理はResult型で表現する

## 実装パターン1: 関数ベース

内部状態を持たない単純な操作の場合は、関数ベースの実装を選択します：

```ts
// fs.ts

import { err, ok, Result } from "npm:neverthrow";

// インターフェース定義
export interface FileSystem {
  readFile(path: string): Promise<Result<string, FileSystemError>>;
  writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileSystemError>>;
  exists(path: string): Promise<Result<boolean, FileSystemError>>;
}

export type FileSystemError = {
  type: "notFound" | "permission" | "unknown";
  message: string;
};

// 実装
export function createFileSystem(): FileSystem {
  return {
    async readFile(path: string): Promise<Result<string, FileSystemError>> {
      try {
        const decoder = new TextDecoder();
        const data = await Deno.readFile(path);
        return ok(decoder.decode(data));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return err({ type: "notFound", message: `File not found: ${path}` });
        }
        return err({ type: "unknown", message: error.message });
      }
    },

    async writeFile(
      path: string,
      content: string,
    ): Promise<Result<void, FileSystemError>> {
      try {
        const encoder = new TextEncoder();
        await Deno.writeFile(path, encoder.encode(content));
        return ok(undefined);
      } catch (error) {
        if (error instanceof Deno.errors.PermissionDenied) {
          return err({ type: "permission", message: "Permission denied" });
        }
        return err({ type: "unknown", message: error.message });
      }
    },

    async exists(path: string): Promise<Result<boolean, FileSystemError>> {
      try {
        await Deno.stat(path);
        return ok(true);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return ok(false);
        }
        return err({ type: "unknown", message: error.message });
      }
    },
  };
}
```

## 実装パターン2: classベース

設定やキャッシュなどの内部状態を管理する必要がある場合は、classベースの実装を選択します：

```ts
// cached-fs.ts

import { Result } from "npm:neverthrow";
import { FileSystem, FileSystemError } from "./fs.ts";

export class CachedFileSystem implements FileSystem {
  private cache = new Map<string, string>();
  private baseFs: FileSystem;

  constructor(baseFs: FileSystem) {
    this.baseFs = baseFs;
  }

  async readFile(path: string): Promise<Result<string, FileSystemError>> {
    const cached = this.cache.get(path);
    if (cached) return ok(cached);

    const result = await this.baseFs.readFile(path);
    result.map((content) => {
      this.cache.set(path, content);
    });
    return result;
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileSystemError>> {
    const result = await this.baseFs.writeFile(path, content);
    result.map(() => {
      this.cache.set(path, content);
    });
    return result;
  }

  async exists(path: string): Promise<Result<boolean, FileSystemError>> {
    return this.baseFs.exists(path);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## 実装パターン3: 高階関数とコンストラクタインジェクション

外部APIとの通信など、モックが必要な場合は、高階関数でラップしてコンストラクタで注入します：

```ts
// api-client.ts

import { err, ok, Result } from "npm:neverthrow";

// 型定義
export interface User {
  id: string;
  name: string;
  email: string;
}

export type ApiError =
  | { type: "network"; message: string }
  | { type: "notFound"; message: string }
  | { type: "unauthorized"; message: string };

// fetchの抽象化
export type Fetcher = <T>(path: string) => Promise<Result<T, ApiError>>;

// APIクライアント
export class UserApiClient {
  constructor(
    private readonly getData: Fetcher,
    private readonly baseUrl: string,
  ) {}

  async getUser(id: string): Promise<Result<User, ApiError>> {
    return await this.getData<User>(`${this.baseUrl}/users/${id}`);
  }

  async listUsers(): Promise<Result<User[], ApiError>> {
    return await this.getData<User[]>(`${this.baseUrl}/users`);
  }
}

// 本番用実装
export function createFetcher(headers: Record<string, string> = {}): Fetcher {
  return async <T>(path: string): Promise<Result<T, ApiError>> => {
    try {
      const response = await fetch(path, { headers });

      if (!response.ok) {
        switch (response.status) {
          case 404:
            return err({ type: "notFound", message: "Resource not found" });
          case 401:
            return err({
              type: "unauthorized",
              message: "Unauthorized access",
            });
          default:
            return err({
              type: "network",
              message: `HTTP error: ${response.status}`,
            });
        }
      }

      const data = await response.json();
      return ok(data as T);
    } catch (error) {
      return err({
        type: "network",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
```

### テスト

```ts
// api-client.test.ts

import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { err, ok } from "npm:neverthrow";
import { ApiError, Fetcher, User, UserApiClient } from "./api-client.ts";

test("ユーザー情報を取得できること", async () => {
  // モックデータ
  const mockUser: User = {
    id: "1",
    name: "Test User",
    email: "test@example.com",
  };

  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    path: string,
  ): Promise<Result<T, ApiError>> => {
    if (path.endsWith("/users/1")) {
      return ok(mockUser as T);
    }
    return err({ type: "notFound", message: "User not found" });
  };

  // テスト用のクライアント
  const api = new UserApiClient(mockFetcher, "https://api.example.com");

  // テスト実行
  const result = await api.getUser("1");
  expect(result.isOk()).toBe(true);
  result.map((user) => {
    expect(user).toEqual(mockUser);
  });
});

test("認証エラーが適切に処理されること", async () => {
  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    _path: string,
  ): Promise<Result<T, ApiError>> => {
    return err({ type: "unauthorized", message: "Invalid token" });
  };

  // テスト用のクライアント
  const api = new UserApiClient(mockFetcher, "https://api.example.com");

  // テスト実行
  const result = await api.getUser("1");
  expect(result.isErr()).toBe(true);
  result.mapErr((error) => {
    expect(error.type).toBe("unauthorized");
    expect(error.message).toBe("Invalid token");
  });
});
```

## 実装の選択基準

1. 関数ベース
   - 単純な操作のみ
   - 内部状態が不要
   - 依存が少ない
   - 例：基本的なファイル操作、単純なHTTPリクエスト

2. classベース
   - 内部状態の管理が必要
   - 設定やリソースの保持が必要
   - メソッド間で状態を共有
   - 例：キャッシュ機能、接続プール、設定管理

3. 高階関数とコンストラクタインジェクション
   - 外部APIとの通信
   - モックが必要な処理
   - 共通の前処理/後処理
   - 例：認証付きHTTPリクエスト、ロギング、エラーハンドリング

## ベストプラクティス

1. インターフェースはシンプルに保つ
2. 基本的には関数ベースを優先する
3. 内部状態が必要な場合のみclassを使用する
4. モックはテストファイル内に定義する
5. 外部依存は高階関数でラップしてインジェクションする
6. エラー処理はResult型で表現し、例外を使わない
7. エラー型は具体的なケースを列挙する
