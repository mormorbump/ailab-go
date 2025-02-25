/* @script */
/**
 * Adapterパターンの実装例
 *
 * このファイルでは、外部APIとの通信を抽象化するAdapterパターンを実装します。
 * 高階関数とコンストラクタインジェクションを使用して、テスト可能な設計を実現します。
 * エラー処理にはneverthrowを使用し、例外を型安全に扱います。
 */

import { Result, ok, err } from "npm:neverthrow";

// 型定義
export interface User {
  id: string;
  name: string;
  email: string;
}

// エラー型
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
    private readonly baseUrl: string
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

// エントリーポイント
if (import.meta.main) {
  const api = new UserApiClient(
    createFetcher({ Authorization: "Bearer test-token" }),
    "https://api.example.com"
  );

  const result = await api.getUser("1");
  result
    .map((user) => console.log("User:", user))
    .mapErr((error) => {
      switch (error.type) {
        case "notFound":
          console.error("User not found");
          break;
        case "unauthorized":
          console.error("Please login first");
          break;
        case "network":
          console.error("Network error:", error.message);
          break;
      }
    });
}

// テスト
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("ユーザー情報を取得できること", async () => {
  // モックデータ
  const mockUser: User = {
    id: "1",
    name: "Test User",
    email: "test@example.com",
  };

  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    path: string
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

test("ユーザー一覧を取得できること", async () => {
  // モックデータ
  const mockUsers: User[] = [
    { id: "1", name: "User 1", email: "user1@example.com" },
    { id: "2", name: "User 2", email: "user2@example.com" },
  ];

  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    path: string
  ): Promise<Result<T, ApiError>> => {
    if (path.endsWith("/users")) {
      return ok(mockUsers as T);
    }
    return err({ type: "notFound", message: "Not found" });
  };

  // テスト用のクライアント
  const api = new UserApiClient(mockFetcher, "https://api.example.com");

  // テスト実行
  const result = await api.listUsers();
  expect(result.isOk()).toBe(true);
  result.map((users) => {
    expect(users).toEqual(mockUsers);
  });
});

test("存在しないユーザーのリクエストでNotFoundエラーが返ること", async () => {
  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    _path: string
  ): Promise<Result<T, ApiError>> => {
    return err({ type: "notFound", message: "User not found" });
  };

  // テスト用のクライアント
  const api = new UserApiClient(mockFetcher, "https://api.example.com");

  // テスト実行
  const result = await api.getUser("999");
  expect(result.isErr()).toBe(true);
  result.mapErr((error) => {
    expect(error.type).toBe("notFound");
    expect(error.message).toBe("User not found");
  });
});

test("認証エラーが適切に処理されること", async () => {
  // モックのFetcher実装
  const mockFetcher: Fetcher = async <T>(
    _path: string
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
