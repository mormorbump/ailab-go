import { z } from "npm:zod";
import { parseArgs } from "node:util";
import type {
  CommandDef,
  CommandResult,
  InferQueryType,
  ParseArgsConfig,
  ParseError,
  QueryBase,
  SafeParseResult,
  SubCommandMap,
  SubCommandResult,
  SubCommandSafeParseResult,
} from "./types.ts";
import { convertValue, generateHelp, zodTypeToParseArgsType } from "./utils.ts";
import { zodToJsonSchema } from "./schema.ts";

// クエリ定義からParseArgsConfigを生成
export function createParseArgsConfig<T extends Record<string, QueryBase<any>>>(
  queryDef: T
): ParseArgsConfig {
  const options: Record<
    string,
    { type: "string" | "boolean"; short?: string; multiple?: boolean }
  > = {};

  // ヘルプオプションを追加
  options["help"] = {
    type: "boolean",
    short: "h",
  };

  // 各クエリ定義からオプションを生成
  for (const [key, def] of Object.entries(queryDef)) {
    // if (def)
    if (def.positional != null) {
      continue;
    }

    const option = {
      type: zodTypeToParseArgsType(def.type),
      short: def.short,
    } as { type: "string" | "boolean"; short?: string; multiple?: boolean };
    // avoid undefined
    if (def.short == undefined) {
      delete option.short;
    }

    // 配列の場合はmultipleをtrueに
    if (def.type instanceof z.ZodArray) {
      option.multiple = true;
    }

    options[key] = option;
  }

  return {
    options,
    allowPositionals: true,
    strict: false,
  };
}

// const debug = console.log;

// parseArgsの結果をZodスキーマに基づいて変換
export function resolveValues<T extends Record<string, QueryBase<any>>>(
  rawParsed: { values: Record<string, any>; positionals: string[] },
  queryDef: T
): InferQueryType<T> {
  const result: Record<string, any> = {};

  const positionalKeys = Object.values(queryDef)
    .filter((x) => typeof x.positional === "number")
    .map((x) => x.positional)
    .sort() as number[];

  // 衝突チェック
  if (positionalKeys.length !== new Set(positionalKeys).size) {
    throw new Error("位置引数のインデックスが重複しています");
  }
  // 連番チェック
  for (let i = 0; i < positionalKeys.length; i++) {
    if (positionalKeys[i] !== i) {
      throw new Error("位置引数のインデックスが連番になっていません");
    }
  }
  // レスト引数の処理（'...'）
  // レスと引数定義の重複チェック
  const restDefs = Object.values(queryDef).filter(
    (x) => x.positional === "..."
  ) as QueryBase<any>[];
  if (restDefs.length > 1) {
    if (positionalKeys.includes(positionalKeys.length)) {
      throw new Error("multiple rest arguments");
    }
  }

  const maxPositionalIndex = Math.max(...positionalKeys);
  const restParam = Object.keys(queryDef).find(
    (key) => queryDef[key].positional === "..."
  );
  if (restParam) {
    const restValues =
      rawParsed.positionals.slice(maxPositionalIndex + 1) ?? [];
    const def = queryDef[restParam];
    if (def.type instanceof z.ZodArray) {
      result[restParam] = convertValue(restValues, def.type);
    } else {
      // 配列型でない場合は自動的に配列に変換
      result[restParam] = restValues;
    }
    result[restParam] = rawParsed.positionals.slice(maxPositionalIndex + 1);
  }
  // 位置引数の処理
  for (const [key, def] of Object.entries(queryDef)) {
    if (def.positional == null) {
      continue;
    }
    if (def.positional === "...") {
      continue;
    }
    const value = rawParsed.positionals[def.positional];
    if (value !== undefined) {
      result[key] = convertValue(value, def.type);
    } else if (def.type instanceof z.ZodDefault) {
      // デフォルト値を持つ場合は、値が提供されなくてもデフォルト値を適用
      result[key] = def.type._def.defaultValue();
    }
  }

  // 名前付き引数の処理
  for (const [key, def] of Object.entries(queryDef)) {
    if (def.positional != null) {
      continue;
    }
    const value = rawParsed.values[key];
    if (value !== undefined) {
      result[key] = convertValue(value, def.type);
    } else if (def.type instanceof z.ZodDefault) {
      // デフォルト値を持つ場合は、値が提供されなくてもデフォルト値を適用
      result[key] = def.type._def.defaultValue();
    }
  }
  return result as InferQueryType<T>;
}

// クエリ定義からzodスキーマを生成
export function createZodSchema<T extends Record<string, QueryBase<any>>>(
  queryDef: T
): z.ZodObject<any> {
  const schema: Record<string, z.ZodTypeAny> = {};

  for (const [key, def] of Object.entries(queryDef)) {
    schema[key] = def.type;
  }

  return z.object(schema);
}

// コマンド定義からCLIコマンドを生成する関数
export function createCommand<T extends Record<string, QueryBase<any>>>(
  commandDef: CommandDef<T>
) {
  const queryDef = commandDef.args;
  const parseArgsConfig = createParseArgsConfig(queryDef);
  const zodSchema = createZodSchema(queryDef);
  const jsonSchema = zodToJsonSchema(zodSchema);
  const helpText = generateHelp(
    commandDef.name,
    commandDef.description,
    queryDef
  );

  // ショートオプションから長いオプション名へのマッピングを作成
  const shortToLongMap = new Map<string, string>();
  const booleanOptions = new Set<string>();

  for (const [key, option] of Object.entries(parseArgsConfig.options || {})) {
    if (option.short) {
      shortToLongMap.set(`-${option.short}`, `--${key}`);
    }
    if (option.type === "boolean") {
      booleanOptions.add(`--${key}`);
      if (option.short) {
        booleanOptions.add(`-${option.short}`);
      }
    }
  }

  // parseArgsWrapper: boolean引数のための特別処理とショートオプションの解決
  function parseArgsWrapper(args: string[]) {
    return parseArgs({
      args: args,
      options: parseArgsConfig.options,
      allowPositionals: parseArgsConfig.allowPositionals,
      strict: parseArgsConfig.strict,
    });
  }

  // パース関数
  function parse(argv: string[]): CommandResult<InferQueryType<T>> {
    // ヘルプフラグのチェック
    if (argv.includes("-h") || argv.includes("--help")) {
      return { type: "help", helpText };
    }
    try {
      const { values, positionals } = parseArgsWrapper(argv);
      const resolved = resolveValues({ values, positionals }, queryDef);

      const validation = zodSchema.safeParse(resolved);
      if (!validation.success) {
        return {
          type: "error",
          error: validation.error,
          helpText,
        };
      }

      return {
        type: "success",
        data: resolved,
      };
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        helpText,
      };
    }
  }

  return {
    parse,
    parseArgsConfig,
    zodSchema,
    jsonSchema,
    helpText,
  };
}

// サブコマンドマップの作成
export function createNestedCommands<T extends SubCommandMap>(subCommands: T) {
  const commands = new Map<string, ReturnType<typeof createCommand>>();

  // 各サブコマンドに対してcreateCliCommandを実行
  for (const [name, def] of Object.entries(subCommands)) {
    commands.set(name, createCommand(def));
  }

  // rootのヘルプテキスト生成
  const rootHelpText = (name: string, description: string) =>
    generateHelp(name, description, {}, subCommands);

  // パース関数
  function parse(
    argv: string[],
    rootName = "command",
    rootDescription = "Command with subcommands"
  ): SubCommandResult {
    // ヘルプフラグのチェック
    if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
      return {
        type: "help",
        helpText: rootHelpText(rootName, rootDescription),
      };
    }

    // 最初の引数をサブコマンド名として処理
    const subCommandName = argv[0];
    const command = commands.get(subCommandName);

    if (!command) {
      return {
        type: "error",
        error: new Error(`Unknown subcommand: ${subCommandName}`),
        helpText: rootHelpText(rootName, rootDescription),
      };
    }

    // サブコマンド用の引数から最初の要素（サブコマンド名）を削除
    const subCommandArgs = argv.slice(1);
    return {
      type: "subcommand",
      name: subCommandName,
      result: command.parse(subCommandArgs),
    };
  }

  return {
    commands,
    parse,
    rootHelpText,
  };
}

/**
 * createParserはコマンド定義から新しいパーサーを作成します。
 * このパーサーはZodスタイルのインターフェースを提供します。
 *
 * @example
 * ```ts
 * const parser = createParser({
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
 * try {
 *   const data = parser.parse(Deno.args);
 *   console.log(`Searching for: ${data.query}, count: ${data.count}`);
 * } catch (error) {
 *   console.error(error.message);
 *   console.log(parser.helpText);
 * }
 * ```
 *
 * @param definition コマンド定義オブジェクト
 * @returns パーサーオブジェクト
 */
export function createParser<T extends Record<string, QueryBase<any>>>(
  definition: CommandDef<T>
) {
  const command = createCommand(definition);

  // 例外を投げるパース関数
  function parse(argv: string[]): InferQueryType<T> {
    const result = command.parse(argv);

    if (result.type === "error") {
      throw result.error;
    } else if (result.type === "help") {
      throw new Error(
        "Help requested. Use --help or -h to display help information."
      );
    }

    return result.data;
  }

  // 安全なパース関数（結果オブジェクトを返す）
  function safeParse(argv: string[]): SafeParseResult<InferQueryType<T>> {
    const result = command.parse(argv);

    if (result.type === "error") {
      return {
        ok: false,
        error: result.error,
      };
    } else if (result.type === "help") {
      return {
        ok: false,
        error: new Error("Help requested"),
      };
    }

    return {
      ok: true,
      data: result.data,
    };
  }

  return {
    parse,
    safeParse,
    help: () => command.helpText,
    zodSchema: command.zodSchema,
    jsonSchema: command.jsonSchema,
  };
}

/**
 * createSubParserはサブコマンドマップから新しいサブコマンドパーサーを作成します。
 * このパーサーはZodスタイルのインターフェースを提供します。
 *
 * @example
 * ```ts
 * const gitParser = createSubParser({
 *   add: {
 *     name: "git add",
 *     description: "Add files to staging",
 *     args: {
 *       files: {
 *         type: z.string().array().describe("files to add"),
 *         positional: true,
 *       },
 *     },
 *   },
 *   commit: {
 *     name: "git commit",
 *     description: "Commit changes",
 *     args: {
 *       message: {
 *         type: z.string().describe("commit message"),
 *         positional: true,
 *       },
 *     },
 *   },
 * }, "git", "Git command line tool");
 *
 * try {
 *   const { command, data } = gitParser.parse(Deno.args);
 *   console.log(`Running git ${command} with:`, data);
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 *
 * @param subCommands サブコマンドマップ
 * @param rootName ルートコマンド名
 * @param rootDescription ルートコマンドの説明
 * @returns サブコマンドパーサーオブジェクト
 */
export function createSubParser<T extends SubCommandMap>(
  subCommands: T,
  rootName = "command",
  rootDescription = "Command with subcommands"
) {
  const subCommandHandler = createNestedCommands(subCommands);

  function parse(argv: string[]) {
    const result = subCommandHandler.parse(argv, rootName, rootDescription);

    if (result.type === "error") {
      throw result.error;
    } else if (result.type === "help") {
      throw new Error("Help requested");
    } else if (result.type === "subcommand") {
      if (result.result.type === "error") {
        throw result.result.error;
      } else if (result.result.type === "help") {
        throw new Error(`Help requested for subcommand: ${result.name}`);
      }

      return {
        command: result.name,
        data: result.result.data,
      };
    }

    // 型安全のため、ここには到達しないはず
    throw new Error("Unknown parse result");
  }

  function safeParse(argv: string[]): SubCommandSafeParseResult {
    const result = subCommandHandler.parse(argv, rootName, rootDescription);

    if (result.type === "error") {
      return { ok: false, error: result.error };
    } else if (result.type === "help") {
      return { ok: false, error: new Error("Help requested") };
    } else if (result.type === "subcommand") {
      if (result.result.type === "error") {
        return { ok: false, error: result.result.error };
      } else if (result.result.type === "help") {
        return {
          ok: false,
          error: new Error(`Help requested for subcommand: ${result.name}`),
        };
      }

      return {
        ok: true,
        data: {
          command: result.name,
          data: result.result.data,
        },
      };
    }

    // 型安全のため、ここには到達しないはず
    return { ok: false, error: new Error("Unknown parse result") };
  }

  return {
    parse,
    safeParse,
    help: (name = rootName, description = rootDescription) =>
      subCommandHandler.rootHelpText(name, description),
    commands: subCommandHandler.commands,
  };
}
