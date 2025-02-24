declare function add(a: number, b: number): number;
// declare function
// Unit Tests
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("add", () => {
  expect(add(1, 2)).toBe(3);
});
