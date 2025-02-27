import { z } from "npm:zod";
import { parseArgs } from "node:util";
import type {
  CommandDef,
  CommandResult,
  InferQueryType,
  ParseArgsConfig,
  QueryBase,
  SubCommandMap,
  SubCommandResult,
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
    if (!def.positional) {
      const type = zodTypeToParseArgsType(def.type);

      const option = {
        type,
        short: def.short,
      } as { type: "string" | "boolean"; short?: string; multiple?: boolean };

      // 配列の場合はmultipleをtrueに
      if (def.type instanceof z.ZodArray) {
        option.multiple = true;
      }

      options[key] = option;
    }
  }

  return {
    options,
    allowPositionals: true,
    // booleanを含む場合にフラグ形式で使えるようにするため
    strict: false,
  };
}

// parseArgsの結果をZodスキーマに基づいて変換
export function parseArgsToValues<T extends Record<string, QueryBase<any>>>(
  parseResult: { values: Record<string, any>; positionals: string[] },
  queryDef: T
): InferQueryType<T> {
  const result: Record<string, any> = {};

  // 位置引数の処理
  let positionalIndex = 0;
  let arrayPosFound = false;

  // 最初に位置引数を検索して型を確認
  for (const [key, def] of Object.entries(queryDef)) {
    if (def.positional && def.type instanceof z.ZodArray) {
      // 配列型の位置引数が見つかった場合
      arrayPosFound = true;

      // 残りの位置引数をすべて配列としてマッピング
      if (positionalIndex < parseResult.positionals.length) {
        const arrayValues = parseResult.positionals.slice(positionalIndex);
        result[key] = convertValue(arrayValues, def.type);
      } else if (def.type instanceof z.ZodDefault) {
        // @ts-ignore Check for default value
        result[key] = def.type._def.defaultValue();
      } else {
        result[key] = [];
      }

      // 配列型の位置引数はすべての残りの位置引数を消費する
      positionalIndex = parseResult.positionals.length;
      break;
    }
  }

  // 配列型の位置引数がなかった場合は通常の処理
  if (!arrayPosFound) {
    positionalIndex = 0;
    for (const [key, def] of Object.entries(queryDef)) {
      if (def.positional) {
        if (positionalIndex < parseResult.positionals.length) {
          const value = parseResult.positionals[positionalIndex];
          result[key] = convertValue(value, def.type);
          positionalIndex++;
        } else if (def.type instanceof z.ZodDefault) {
          result[key] = def.type._def.defaultValue();
        }
      }
    }
  }

  // 名前付き引数の処理
  for (const [key, def] of Object.entries(queryDef)) {
    if (!def.positional) {
      const value = parseResult.values[key];
      if (value !== undefined) {
        result[key] = convertValue(value, def.type);
      } else if (def.type instanceof z.ZodDefault) {
        // デフォルト値を持つ場合は、値が提供されなくてもデフォルト値を適用
        result[key] = def.type._def.defaultValue();
      }
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

  // parseArgsWrapper: boolean引数のための特別処理
  function parseArgsWrapper(args: string[]) {
    // 特別処理: --flagのみでbooleanオプションを処理できるようにする
    const processedArgs: string[] = [];
    const booleanOptions = new Set<string>();

    // boolean型のオプションを特定
    for (const [key, option] of Object.entries(parseArgsConfig.options || {})) {
      if (option.type === "boolean") {
        booleanOptions.add(`--${key}`);
        if (option.short) {
          booleanOptions.add(`-${option.short}`);
        }
      }
    }

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      // --flag=value 形式のチェック
      if (arg.includes("=")) {
        processedArgs.push(arg);
        i++;
        continue;
      }

      // --flag や -f 形式のチェック
      if (booleanOptions.has(arg)) {
        // boolean型の場合は、--flag true の代わりに --flag だけでOK
        processedArgs.push(arg);
        processedArgs.push("true");
        i++;
        continue;
      }

      // それ以外は通常処理
      processedArgs.push(arg);
      i++;
    }

    return parseArgs({
      args: processedArgs,
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
      const parsedArgs = parseArgsToValues({ values, positionals }, queryDef);

      // zodスキーマでバリデーション
      const validation = zodSchema.safeParse(parsedArgs);
      if (!validation.success) {
        return {
          type: "error",
          error: validation.error,
          helpText,
        };
      }

      return {
        type: "success",
        data: parsedArgs,
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
export function createSubCommands<T extends SubCommandMap>(subCommands: T) {
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
