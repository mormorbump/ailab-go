---
name: Deno:TestFirstMode
groups:
  - read
  - edit
  - browser
  - command
  - mcp
source: "project"
---

## 実装モード: テストファーストモード

テストファーストモードは、実装の型シグネチャとテストコードを先に書き、それをユーザーに確認を取りながら実装を行う。

ファイル冒頭に `@tdd` を含む場合、それはテストファーストモードである。

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

```ts
// @script @tdd
import { Result, ok, err } from "npm:neverthrow";

// 型定義
export interface User {
  id: string;
  name: string;
}

export type ApiError = 
  | { type: "unauthorized"; message: string }
  | { type: "network"; message: string };

// インターフェース定義
declare function getUser(token: string, id: string): Promise<Result<User, ApiError>>;

import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("有効なトークンの場合にユーザー情報を取得すると成功すること", async () => {
  // 1. まず期待する結果を書く
  const expectedUser: User = {
    id: "1",
    name: "Test User"
  };

  // 2. ここでユーザーに結果の妥当性を確認

  // 3. 次に操作を書く
  const result = await getUser("valid-token", "1");

  // 4. 最後に準備を書く（この例では不要）

  // アサーション
  expect(result.isOk()).toBe(true);
  result.map(user => {
    expect(user).toEqual(expectedUser);
  });
});

test("無効なトークンの場合にユーザー情報を取得するとエラーになること", async () => {
  // 1. まず期待する結果を書く
  const expectedError: ApiError = {
    type: "unauthorized",
    message: "Invalid token"
  };

  // 2. ユーザーに結果の妥当性を確認

  // 3. 次に操作を書く
  const result = await getUser("invalid-token", "1");

  // アサーション
  expect(result.isErr()).toBe(true);
  result.mapErr(error => {
    expect(error).toEqual(expectedError);
  });
});
```

### 開発手順の詳細

1. 型シグネチャの定義
   ```ts
   declare function getUser(token: string, id: string): Promise<Result<User, ApiError>>;
   ```

2. テストケースごとに：

   a. 期待する結果を定義
   ```ts
   const expectedUser: User = {
     id: "1",
     name: "Test User"
   };
   ```

   b. **ユーザーと結果の確認**
   - この時点で期待する結果が適切か確認
   - 仕様の見直しや追加が必要な場合は、ここで修正

   c. 操作コードの実装
   ```ts
   const result = await getUser("valid-token", "1");
   ```

   d. 必要な準備コードの実装
   ```ts
   // 必要な場合のみ
   const mockApi = new MockApi();
   mockApi.setup();
   ```

3. テストを一つずつ `skip` を外しながら実装

テストファーストモードは他のモードと両立する。