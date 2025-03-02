/* @script @tdd */
/**
 * エラトステネスの篩による素数判定を行うモジュール
 */

/**
 * 与えられた数値が整数かどうかを判定する
 */
function isInteger(n: number): boolean {
  return Number.isInteger(n);
}

/**
 * 与えられた数値以下の素数を全て求める
 * @param n 2以上の整数
 * @returns n以下の素数の配列。nが2未満の場合は空配列
 * @throws {Error} nが整数でない場合
 */
function sieveOfEratosthenes(n: number): number[] {
  // 入力値のバリデーション
  if (!isInteger(n)) {
    throw new Error("Input must be an integer");
  }

  // 2未満の場合は空配列を返す
  if (n < 2) {
    return [];
  }

  // 篩い落とし用の配列を初期化（true: 素数の候補）
  const sieve = new Array(n + 1).fill(true);
  sieve[0] = sieve[1] = false;

  // エラトステネスの篩
  for (let i = 2; i * i <= n; i++) {
    if (sieve[i]) {
      // iが素数なら、その倍数を全て篩い落とす
      for (let j = i * i; j <= n; j += i) {
        sieve[j] = false;
      }
    }
  }

  // 素数の配列を作成
  const primes: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (sieve[i]) {
      primes.push(i);
    }
  }

  return primes;
}

/**
 * 与えられた数値が素数かどうかを判定する
 * @param n 判定する数値
 * @returns 素数ならtrue、そうでなければfalse。2未満の数値は常にfalse
 * @throws {Error} nが整数でない場合
 */
function isPrime(n: number): boolean {
  // 入力値のバリデーション
  if (!isInteger(n)) {
    throw new Error("Input must be an integer");
  }

  // 2未満の数は素数ではない
  if (n < 2) {
    return false;
  }

  // 2は素数
  if (n === 2) {
    return true;
  }

  // 2より大きい偶数は素数ではない
  if (n % 2 === 0) {
    return false;
  }

  // 3以上の奇数について、nの平方根までの奇数での割り算を試す
  const sqrt = Math.sqrt(n);
  for (let i = 3; i <= sqrt; i += 2) {
    if (n % i === 0) {
      return false;
    }
  }

  return true;
}

// テスト
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

test("sieveOfEratosthenes handles edge cases", () => {
  expect(
    sieveOfEratosthenes(-1),
    "negative number returns empty array",
  ).toEqual([]);
  expect(sieveOfEratosthenes(0), "zero returns empty array").toEqual([]);
  expect(sieveOfEratosthenes(1), "one returns empty array").toEqual([]);
  expect(sieveOfEratosthenes(2), "two returns [2]").toEqual([2]);
});

test("sieveOfEratosthenes throws on non-integer input", () => {
  expect(() => sieveOfEratosthenes(3.5)).toThrow();
});

test("sieveOfEratosthenes(10) returns first primes", () => {
  expect(sieveOfEratosthenes(10), "primes up to 10").toEqual([2, 3, 5, 7]);
});

test("sieveOfEratosthenes(20) returns correct primes", () => {
  expect(sieveOfEratosthenes(20), "primes up to 20").toEqual([
    2,
    3,
    5,
    7,
    11,
    13,
    17,
    19,
  ]);
});

test("sieveOfEratosthenes returns more primes for larger numbers", () => {
  const primes50 = sieveOfEratosthenes(50);
  const primes100 = sieveOfEratosthenes(100);
  expect(
    primes100.length > primes50.length,
    "more primes in larger range",
  ).toBe(true);
  expect(primes100[primes100.length - 1], "largest prime under 100").toBe(97);
});

test("isPrime handles edge cases", () => {
  expect(isPrime(-1), "negative number is not prime").toBe(false);
  expect(isPrime(0), "zero is not prime").toBe(false);
  expect(isPrime(1), "one is not prime").toBe(false);
});

test("isPrime throws on non-integer input", () => {
  expect(() => isPrime(3.5)).toThrow();
});

test("isPrime identifies small prime numbers correctly", () => {
  expect(isPrime(2), "2 is prime").toBe(true);
  expect(isPrime(3), "3 is prime").toBe(true);
  expect(isPrime(4), "4 is not prime").toBe(false);
  expect(isPrime(5), "5 is prime").toBe(true);
  expect(isPrime(6), "6 is not prime").toBe(false);
  expect(isPrime(7), "7 is prime").toBe(true);
});

test("isPrime identifies larger prime numbers correctly", () => {
  expect(isPrime(17), "17 is prime").toBe(true);
  expect(isPrime(19), "19 is prime").toBe(true);
  expect(isPrime(20), "20 is not prime").toBe(false);
  expect(isPrime(97), "97 is prime").toBe(true);
  expect(isPrime(100), "100 is not prime").toBe(false);
});

test("isPrime handles numbers around prime numbers", () => {
  // 素数の前後の数をテスト
  expect(isPrime(16), "16 is not prime").toBe(false);
  expect(isPrime(17), "17 is prime").toBe(true);
  expect(isPrime(18), "18 is not prime").toBe(false);

  expect(isPrime(96), "96 is not prime").toBe(false);
  expect(isPrime(97), "97 is prime").toBe(true);
  expect(isPrime(98), "98 is not prime").toBe(false);
});

test("Performance test for large numbers", () => {
  const start = performance.now();
  const primes = sieveOfEratosthenes(1000);
  const end = performance.now();

  expect(primes.length > 0, "should find primes").toBe(true);
  expect(end - start, "execution time").toBeLessThan(1000); // 1秒以内に完了すべき
});

// エントリーポイント
if (import.meta.main) {
  console.log("Primes up to 20:", sieveOfEratosthenes(20));
  console.log("Is 17 prime?", isPrime(17));

  // パフォーマンステスト
  console.log("Running performance test...");
  const start = performance.now();
  const primes = sieveOfEratosthenes(1000);
  const end = performance.now();
  console.log(`Found primes up to 1000 in ${end - start}ms`);
}
