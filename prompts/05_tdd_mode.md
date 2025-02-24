## 実装モード: テストファーストモード

テストファーストモードは、実装の型シグネチャとテストコードを先に書き、それをユーザーに確認を取りながら実装を行う。

ファイル冒頭に `@tdd` を含む場合、それはテストファーストモードである。

テストファーストモードでは、実装対象の関数/クラスの型シグネチャを実装し、それに対して `deno check <filename>` でエラーが出ないことを確認する。

実装例

```ts
// @script @tdd
declare function add(a: number, b: number): number;

import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test.skip("add", () => {
  expect(add(1, 2)).toBe(3);
});
```

型が通ったら、 **必ず** ユーザーにその方向性で実装を進めていいか確認する。了解がとれたら、実装を進める。

最初は `test.skip` で実装し、段階的に実装する。

テストファーストモードは他のモードと両立する。