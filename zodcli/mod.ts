/**
 * ZodCLI - Zod を使用した型安全なコマンドラインパーサー
 *
 * このモジュールは、Zod スキーマを使用して型安全なコマンドラインインターフェースを
 * 簡単に構築するためのツールを提供します。
 *
 * @example
 * ```ts
 * import { createCliCommand, runCommand } from "./mod.ts";
 * import { z } from "npm:zod";
 *
 * const searchCommand = createCommand({
 *   name: "search",
 *   description: "Search with custom parameters",
 *   args: {
 *     query: {
 *       type: z.string().describe("search query"),
 *       positional: true,
 *     },
 *     count: {
 *       type: z.number().optional().default(5).describe("number of results"),
 *       short: "c",
 *     },
 *   },
 * });
 *
 * const result = searchCommand.parse(Deno.args);
 * runCommand(result, (data) => {
 *   console.log(`Searching for: ${data.query}, count: ${data.count}`);
 * });
 * ```
 */

// 型定義のエクスポート
export type {
  CommandDef,
  CommandResult,
  InferQueryType,
  InferZodType,
  ParseArgsConfig,
  ParseArgsOptionConfig,
  QueryBase,
  SubCommandMap,
  SubCommandResult,
} from "./types.ts";

// コア機能のエクスポート
export {
  createCommand,
  createSubCommands,
  createZodSchema,
  parseArgsToValues,
} from "./core.ts";

// ユーティリティ関数のエクスポート
export {
  convertValue,
  createTypeFromZod,
  generateHelp,
  getTypeDisplayString,
  run,
  zodTypeToParseArgsType,
} from "./utils.ts";

// スキーマ関連のエクスポート
export { isOptionalType, zodToJsonSchema } from "./schema.ts";
