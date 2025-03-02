// Impl TODO: later
declare function add(a: number, b: number): number;

import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test.skip("add", () => {
  expect(add(1, 2)).toBe(3);
});
