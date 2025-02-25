## テストの書き方

`@std/expect` と `@std/testing/bdd` を使う。
とくに実装上の理由がない限り、 `describe` による入れ子はしない。

```ts
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("2+3=5", () => {
  expect(add(2, 3), "sum of numbers").toBe(5);
});
```

アサーションの書き方

- `expect(result, "<expected behavior>").toBe("result")` で可能な限り期待する動作を書く