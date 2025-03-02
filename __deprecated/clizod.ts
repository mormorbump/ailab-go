/* @script */
import { z } from "npm:zod";
import { parseArgs } from "node:util";
import type { Schema } from "npm:jsonschema";

// 基本的なクエリ定義型
export type QueryBase<ArgType extends z.ZodTypeAny> = {
  type: ArgType;
  positional?: boolean;
  short?: string;
  description?: string;
};

// 引数の型を抽出するヘルパー型
export type InferZodType<T extends z.ZodTypeAny> = z.infer<T>;
export type InferQueryType<T extends Record<string, QueryBase<any>>> = {
  [K in keyof T]: InferZodType<T[K]["type"]>;
};

// コマンド定義型
export type CommandDef<T extends Record<string, QueryBase<any>>> = {
  name: string;
  description: string;
  args: T;
};

// サブコマンド定義型
export type SubCommandMap = Record<string, CommandDef<any>>;

// 実行結果の型定義
export type CommandResult<T> =
  | { type: "success"; data: T }
  | { type: "help"; helpText: string }
  | { type: "error"; error: Error | z.ZodError; helpText: string };

export type SubCommandResult =
  | { type: "subcommand"; name: string; result: CommandResult<any> }
  | { type: "help"; helpText: string }
  | { type: "error"; error: Error; helpText: string };

// Node.jsのparseArgsと互換性のある型定義
interface ParseArgsOptionConfig {
  type: "string" | "boolean";
  short?: string;
  multiple?: boolean;
}

interface ParseArgsConfig {
  args?: string[];
  options?: Record<string, ParseArgsOptionConfig>;
  strict?: boolean;
  allowPositionals?: boolean;
}

// Zodの型からparseArgsの型に変換
function zodTypeToParseArgsType(zodType: z.ZodTypeAny): "string" | "boolean" {
  if (zodType instanceof z.ZodBoolean) {
    return "boolean";
  }
  // 他のすべての型は文字列として扱う
  return "string";
}

// クエリ定義からParseArgsConfigを生成
function createParseArgsConfig<T extends Record<string, QueryBase<any>>>(
  queryDef: T,
): ParseArgsConfig {
  const options: Record<string, ParseArgsOptionConfig> = {};

  // ヘルプオプションを追加
  options["help"] = {
    type: "boolean",
    short: "h",
  };

  // 各クエリ定義からオプションを生成
  for (const [key, def] of Object.entries(queryDef)) {
    if (!def.positional) {
      const type = zodTypeToParseArgsType(def.type);

      const option: ParseArgsOptionConfig = {
        type,
        short: def.short,
      };

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

// 値の型変換
function convertValue(
  value: string | boolean | string[] | undefined,
  zodType: z.ZodTypeAny,
): any {
  if (value === undefined) {
    return undefined;
  }

  if (zodType instanceof z.ZodNumber) {
    return typeof value === "string" ? Number(value) : value;
  } else if (zodType instanceof z.ZodEnum) {
    return value;
  } else if (zodType instanceof z.ZodArray) {
    if (Array.isArray(value)) {
      if (zodType._def.type instanceof z.ZodNumber) {
        return value.map((v) => Number(v));
      }
      return value;
    }
    return typeof value === "string" ? [value] : [];
  } else if (zodType instanceof z.ZodOptional) {
    return value === undefined
      ? undefined
      : convertValue(value, zodType._def.innerType);
  } else if (zodType instanceof z.ZodDefault) {
    return value === undefined
      ? zodType._def.defaultValue()
      : convertValue(value, zodType._def.innerType);
  }

  return value;
}

// parseArgsの結果をZodスキーマに基づいて変換
function parseArgsToValues<T extends Record<string, QueryBase<any>>>(
  parseResult: { values: Record<string, any>; positionals: string[] },
  queryDef: T,
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

// ヘルプメッセージの生成
function generateHelp<T extends Record<string, QueryBase<any>>>(
  commandName: string,
  description: string,
  queryDef: T,
  subCommands?: SubCommandMap,
): string {
  let help = `${commandName}\n> ${description}\n\n`;

  // サブコマンドの説明
  if (subCommands && Object.keys(subCommands).length > 0) {
    help += "SUBCOMMANDS:\n";
    for (const [name, cmd] of Object.entries(subCommands)) {
      help += `  ${name} - ${cmd.description}\n`;
    }
    help += "\n";
  }

  // 位置引数の説明
  const positionals = Object.entries(queryDef).filter(
    ([_, def]) => def.positional,
  );
  if (positionals.length > 0) {
    help += "ARGUMENTS:\n";
    for (const [key, def] of positionals) {
      const typeStr = getTypeDisplayString(def.type);
      const desc = def.type.description || def.description || "";
      help += `  <${key}:${typeStr}> - ${desc}\n`;
    }
    help += "\n";
  }

  // オプションの説明
  const options = Object.entries(queryDef).filter(
    ([_, def]) => !def.positional,
  );
  if (options.length > 0) {
    help += "OPTIONS:\n";
    for (const [key, def] of options) {
      const typeStr = getTypeDisplayString(def.type);
      const shortOption = def.short ? `-${def.short}` : "";
      const desc = def.type.description || def.description || "";
      const defaultValue = def.type instanceof z.ZodDefault
        ? ` (default: ${JSON.stringify(def.type._def.defaultValue())})`
        : "";

      // boolean型の場合は <type> を表示しない
      const typeDisplay = def.type instanceof z.ZodBoolean
        ? ""
        : ` <${typeStr}>`;
      help += `  --${key}${
        shortOption ? ", " + shortOption : ""
      }${typeDisplay} - ${desc}${defaultValue}\n`;
    }
    help += "\n";
  }

  // フラグの説明（ヘルプなど）
  help += "FLAGS:\n";
  help += "  --help, -h - show help\n";

  return help;
}

// 型の表示用文字列を取得
function getTypeDisplayString(zodType: z.ZodTypeAny): string {
  if (zodType instanceof z.ZodString) {
    return "str";
  } else if (zodType instanceof z.ZodNumber) {
    return "num";
  } else if (zodType instanceof z.ZodBoolean) {
    return "bool";
  } else if (zodType instanceof z.ZodEnum) {
    return zodType._def.values.join("|");
  } else if (zodType instanceof z.ZodArray) {
    return `${getTypeDisplayString(zodType._def.type)}[]`;
  } else if (zodType instanceof z.ZodOptional) {
    return getTypeDisplayString(zodType._def.innerType);
  } else if (zodType instanceof z.ZodDefault) {
    return getTypeDisplayString(zodType._def.innerType);
  }
  return "any";
}

// クエリ定義からzodスキーマを生成
function createZodSchema<T extends Record<string, QueryBase<any>>>(
  queryDef: T,
): z.ZodObject<any> {
  const schema: Record<string, z.ZodTypeAny> = {};

  for (const [key, def] of Object.entries(queryDef)) {
    schema[key] = def.type;
  }

  return z.object(schema);
}

// Zodスキーマから型推論した結果と整合する型変換ヘルパー
function createTypeFromZod<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  // 単に型推論のためのヘルパー関数
  // 実際の実行時には何もしない（型情報のみ）
  return null as any;
}

// オプショナルまたはデフォルト値を持つ型かチェック
function isOptionalType(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault;
}

// ----------------------------------------------------
// Zodスキーマ から JSON Schema への変換実装
// ----------------------------------------------------

// JSONスキーマに変換（シンプル版）
function zodToJsonSchema(schema: z.ZodTypeAny): Schema {
  // 基本的な型の処理
  if (schema instanceof z.ZodString) {
    return {
      type: "string",
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodNumber) {
    return {
      type: "number",
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodBoolean) {
    return {
      type: "boolean",
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(schema._def.type),
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodObject) {
    // オブジェクト型の処理をシンプルに実装
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    // 型安全に処理するために型アサーションを使用
    const shape = schema.shape as Record<string, z.ZodTypeAny>;

    for (const key of Object.keys(shape)) {
      const zodSchema = shape[key];
      properties[key] = zodToJsonSchema(zodSchema);

      // 必須フィールドの判定 - オプショナルまたはデフォルト値を持つフィールドは必須ではない
      if (!isOptionalType(zodSchema)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: [...schema._def.values],
      ...(schema.description ? { description: schema.description } : {}),
    };
  } else if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  } else if (schema instanceof z.ZodDefault) {
    const innerSchema = zodToJsonSchema(schema._def.innerType);
    return {
      ...innerSchema,
      default: schema._def.defaultValue(),
    };
  }

  // 複雑な型は単純なobjectとして扱う（型安全性を確保するため）
  return {
    type: "object",
    ...(schema.description ? { description: schema.description } : {}),
  };
}

// コマンド定義からCLIコマンドを生成する関数
function createCliCommand<T extends Record<string, QueryBase<any>>>(
  commandDef: CommandDef<T>,
) {
  const queryDef = commandDef.args;
  const parseArgsConfig = createParseArgsConfig(queryDef);
  const zodSchema = createZodSchema(queryDef);
  const jsonSchema = zodToJsonSchema(zodSchema);
  const helpText = generateHelp(
    commandDef.name,
    commandDef.description,
    queryDef,
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
function createSubCommandMap<T extends SubCommandMap>(subCommands: T) {
  const commands = new Map<string, ReturnType<typeof createCliCommand>>();

  // 各サブコマンドに対してcreateCliCommandを実行
  for (const [name, def] of Object.entries(subCommands)) {
    commands.set(name, createCliCommand(def));
  }

  // rootのヘルプテキスト生成
  const rootHelpText = (name: string, description: string) =>
    generateHelp(name, description, {}, subCommands);

  // パース関数
  function parse(
    argv: string[],
    rootName = "command",
    rootDescription = "Command with subcommands",
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

// 実行用のヘルパー関数
function runCommand<T>(result: CommandResult<T>, runFn?: (data: T) => void) {
  switch (result.type) {
    case "help":
      console.log(result.helpText);
      break;
    case "error":
      console.error(
        "Error:",
        result.error instanceof z.ZodError
          ? result.error.message
          : result.error.message,
      );
      console.log("\n" + result.helpText);
      break;
    case "success":
      if (runFn) {
        runFn(result.data);
      } else {
        console.log("Parsed args:", result.data);
      }
      break;
  }
}

// 使用例
if (import.meta.main) {
  // 基本的なコマンド定義
  const searchCommand = createCliCommand({
    name: "search",
    description: "Search with custom parameters",
    args: {
      query: {
        type: z.string().describe("search query"),
        positional: true,
      },
      count: {
        type: z
          .number()
          .optional()
          .default(5)
          .describe("number of results to return"),
        short: "c",
      },
      format: {
        type: z
          .enum(["json", "text", "table"])
          .default("text")
          .describe("output format"),
        short: "f",
      },
    },
  });

  // サブコマンドの定義例
  const gitSubCommands = createSubCommandMap({
    add: {
      name: "git add",
      description: "Add files to git staging",
      args: {
        files: {
          type: z.string().array().describe("files to add"),
          positional: true,
        },
        all: {
          type: z.boolean().default(false).describe("add all files"),
          short: "a",
        },
      },
    },
    commit: {
      name: "git commit",
      description: "Commit staged changes",
      args: {
        message: {
          type: z.string().describe("commit message"),
          positional: true,
        },
        amend: {
          type: z.boolean().default(false).describe("amend previous commit"),
          short: "a",
        },
      },
    },
  });

  // コマンドラインから実行（基本コマンド）
  console.log("基本コマンドのデモ:");
  if (Deno.args.length > 0) {
    const result = searchCommand.parse(Deno.args);
    runCommand(result, (data) => {
      console.log(
        `Search query: ${data.query}, count: ${data.count}, format: ${data.format}`,
      );
    });
  } else {
    // デモンストレーション
    console.log("Generated Help:");
    console.log(searchCommand.helpText);

    console.log("\nSample parse result:");
    const sampleResult = searchCommand.parse([
      "test",
      "--count",
      "10",
      "--format",
      "json",
    ]);
    runCommand(sampleResult);

    // サブコマンドデモ
    console.log("\nサブコマンドデモ:");
    console.log(gitSubCommands.rootHelpText("git", "Git command line tool"));

    const addResult = gitSubCommands.parse(
      ["add", "file1.txt", "file2.txt", "--all"],
      "git",
      "Git command line tool",
    );
    console.log("\nサブコマンド解析結果:", JSON.stringify(addResult, null, 2));
  }
}

// テスト用エクスポート
export {
  convertValue,
  createCliCommand,
  createSubCommandMap,
  createZodSchema,
  generateHelp,
  parseArgsToValues,
  runCommand,
  zodToJsonSchema,
  // 型情報はファイル先頭でexport済み
};
