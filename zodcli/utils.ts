import { z } from "npm:zod";
import type { QueryBase, SubCommandMap, SubCommandResult } from "./types.ts";

// Zodの型からparseArgsの型に変換
export function zodTypeToParseArgsType(
  zodType: z.ZodTypeAny
): "string" | "boolean" {
  if (zodType instanceof z.ZodBoolean) {
    return "boolean";
  }
  // 他のすべての型は文字列として扱う
  return "string";
}

// 値の型変換
export function convertValue(
  value: string | boolean | string[] | undefined,
  zodType: z.ZodTypeAny
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

// 型の表示用文字列を取得
export function getTypeDisplayString(zodType: z.ZodTypeAny): string {
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

// ヘルプメッセージの生成
export function generateHelp<T extends Record<string, QueryBase<any>>>(
  commandName: string,
  description: string,
  queryDef: T,
  subCommands?: SubCommandMap
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
    ([_, def]) => def.positional != null && def.positional !== "..."
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
  const positionalRest = Object.entries(queryDef).find(
    ([_, def]) => def.positional === "..."
  );
  if (positionalRest) {
    const [key, def] = positionalRest;
    const typeStr = getTypeDisplayString(def.type);
    const desc = def.type.description || def.description || "";
    help += `  ...<${key}:${typeStr}[]>${desc || " - rest arguments"}\n\n`;
  }

  // オプションの説明
  const options = Object.entries(queryDef).filter(
    ([_, def]) => !def.positional
  );
  if (options.length > 0) {
    help += "OPTIONS:\n";
    for (const [key, def] of options) {
      const typeStr = getTypeDisplayString(def.type);
      const shortOption = def.short ? `-${def.short}` : "";
      const desc = def.type.description || def.description || "";
      const defaultValue =
        def.type instanceof z.ZodDefault
          ? ` (default: ${JSON.stringify(def.type._def.defaultValue())})`
          : "";

      // boolean型の場合は <type> を表示しない
      const typeDisplay =
        def.type instanceof z.ZodBoolean ? "" : ` <${typeStr}>`;
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

// 型のインポート
import { CommandResult } from "./types.ts";

/**
 * 実行用ヘルパー関数
 *
 * @overload 従来のインターフェース（後方互換性用）
 * @deprecated 新しいオーバーロードを使用してください
 */
export function run<T>(
  result: CommandResult<T> | SubCommandResult,
  runFn?: (data: any, subCommandName?: string) => void
): void;

/**
 * 実行用ヘルパー関数
 *
 * @overload 新しいショートハンドインターフェース
 * @example
 * ```ts
 * const parser = createParser({
 *   name: "search",
 *   description: "Search with custom parameters",
 *   args: { ... }
 * });
 *
 * // パーサー、引数、成功時のコールバックを指定して実行
 * run(parser, Deno.args, (data) => {
 *   console.log(`Search query: ${data.query}, count: ${data.count}`);
 * });
 * ```
 */
export function run<
  T,
  P extends {
    parse: (args: string[]) => T;
    safeParse: (args: string[]) => any;
    help: () => string;
  }
>(
  schema: P,
  args: string[],
  onSuccess: (data: T) => void | Promise<void>,
  onError?: (error: Error) => void | Promise<void>
): void;

// 実装
export function run<
  T,
  P extends {
    parse: (args: string[]) => T;
    safeParse: (args: string[]) => any;
    help: () => string;
  }
>(
  schemaOrResult: P | CommandResult<T> | SubCommandResult,
  argsOrRunFn?: string[] | ((data: any, subCommandName?: string) => void),
  onSuccess?: (data: T) => void | Promise<void>,
  onError?: (error: Error) => void | Promise<void>
): void {
  // 従来のインターフェース: run(result, runFn?)
  if ((schemaOrResult as CommandResult<T>).type !== undefined) {
    const result = schemaOrResult as CommandResult<T> | SubCommandResult;
    const runFn = argsOrRunFn as
      | ((data: any, subCommandName?: string) => void)
      | undefined;

    switch (result.type) {
      case "help":
        console.log(result.helpText);
        break;
      case "error":
        console.error(
          "Error:",
          result.error instanceof z.ZodError
            ? result.error.message
            : result.error.message
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
      case "subcommand":
        // サブコマンドの場合はサブコマンド結果を処理
        if (result.result.type === "success") {
          if (runFn) {
            // サブコマンド名も渡す
            runFn(result.result.data, result.name);
          } else {
            console.log(
              `Subcommand [${result.name}] args:`,
              result.result.data
            );
          }
        } else {
          // helpとerrorの場合は直接処理
          if (result.result.type === "help") {
            console.log(result.result.helpText);
          } else if (result.result.type === "error") {
            console.error(
              "Error:",
              result.result.error instanceof z.ZodError
                ? result.result.error.message
                : result.result.error.message
            );
            console.log("\n" + result.result.helpText);
          }
        }
        break;
    }
    return;
  }

  // 新しいインターフェース: run(schema, args, onSuccess?, onError?)
  const schema = schemaOrResult as P;
  const args = argsOrRunFn as string[];

  try {
    // パーサーの parse メソッドを使用
    const data = schema.parse(args);
    if (onSuccess) {
      onSuccess(data);
    } else {
      console.log("Parsed args:", data);
    }
  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    } else {
      // エラー時のデフォルト動作
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      console.log("\n" + schema.help());
    }
  }
}

// Zodスキーマから型推論した結果と整合する型変換ヘルパー
export function createTypeFromZod<T extends z.ZodTypeAny>(
  schema: T
): z.infer<T> {
  // 単に型推論のためのヘルパー関数
  // 実際の実行時には何もしない（型情報のみ）
  return null as any;
}

/**
 * ヘルプテキストを標準出力に表示します
 *
 * @param helpText 表示するヘルプテキスト
 */
export function printHelp(helpText: string) {
  console.log(helpText);
}
