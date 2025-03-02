import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import {
  addChatHistory,
  addTodo,
  getRecentChatHistory,
  getTodoStats,
  listTodos,
  removeTodo,
  searchTodos,
  toggleTodo,
  updateTodo,
} from "./db.ts";
import { ask } from "./ask.ts";
import type { Todo } from "./types.ts";
// todoParserのヘルプメソッドだけを使用するためのシンプルなインターフェース
interface HelpProvider {
  help(): string;
}

// 実際のtodoParserオブジェクトは実行時に注入する
let _todoParser: HelpProvider | null = null;

// todoParserを設定する関数
export function setTodoParserForHelp(parser: HelpProvider): void {
  _todoParser = parser;
}

// ヘルプを取得するための関数
function getTodoHelp(): string {
  if (!_todoParser) {
    return "TODOアプリのヘルプは現在利用できません。";
  }
  return _todoParser.help();
}
import { z } from "npm:zod";

// エンコーダー（標準出力に直接書き込むため）
const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

// TODOのツール定義
const todoTools = {
  // タスク追加ツール
  addTodo: tool({
    description: "新しいTODOを追加する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      text: z.string().describe("TODOの内容") as any,
    }),
    execute: async ({ text }) => {
      const newTodo = addTodo(text);
      return {
        success: true,
        id: newTodo.id,
        text: newTodo.text,
        message: `✓ 新しいTODOを追加しました: ${newTodo.text} (ID: ${
          newTodo.id.substring(0, 8)
        })`,
      };
    },
  }),

  // タスク一覧表示ツール
  listTodos: tool({
    description: "TODOリストを表示する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      showCompleted: z
        .boolean()
        .default(true)
        .describe("完了したタスクも表示する"),
    }),
    execute: async ({ showCompleted }) => {
      const todos = listTodos(showCompleted);
      return {
        success: true,
        count: todos.length,
        todos: todos.map((todo) => ({
          id: todo.id,
          text: todo.text,
          completed: todo.completed,
          createdAt: todo.createdAt,
        })),
      };
    },
  }),

  // タスク検索ツール
  searchTodos: tool({
    description: "TODOをテキストで検索する",
    // @ts-ignore - zod type definitions are not up-to-date

    parameters: z.object({
      text: z.string().min(1).describe("検索するテキスト"),
      showCompleted: z
        .boolean()
        .default(true)
        .describe("完了したタスクも検索する"),
    }),
    execute: async ({ text, showCompleted }) => {
      const todos = searchTodos(text, showCompleted);
      return {
        success: true,
        count: todos.length,
        searchText: text,
        todos: todos.map((todo) => ({
          id: todo.id,
          text: todo.text,
          completed: todo.completed,
          createdAt: todo.createdAt,
        })),
      };
    },
  }),

  // タスク完了切り替えツール
  toggleTodo: tool({
    description: "TODOの完了/未完了を切り替える",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      id: z.string().describe("TODOのID"),
    }),
    execute: async ({ id }) => {
      const updatedTodo = toggleTodo(id);
      if (!updatedTodo) {
        return {
          success: false,
          message: `✗ ID: ${id} のTODOは見つかりませんでした。`,
        };
      }

      const statusText = updatedTodo.completed ? "完了" : "未完了";
      return {
        success: true,
        id: updatedTodo.id,
        text: updatedTodo.text,
        completed: updatedTodo.completed,
        message:
          `✓ TODOを${statusText}に変更しました: ${updatedTodo.text} (ID: ${
            updatedTodo.id.substring(0, 8)
          })`,
      };
    },
  }),

  // タスク削除ツール
  removeTodo: tool({
    description: "TODOを削除する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      id: z.string().describe("TODOのID"),
    }),
    execute: async ({ id }) => {
      const removed = removeTodo(id);
      if (!removed) {
        return {
          success: false,
          message: `✗ ID: ${id} のTODOは見つかりませんでした。`,
        };
      }

      return {
        success: true,
        id,
        message: `✓ TODOを削除しました (ID: ${id})`,
      };
    },
  }),

  // タスク更新ツール
  updateTodo: tool({
    description: "TODOの内容や状態を更新する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      id: z.string().describe("TODOのID"),
      text: z.string().optional().describe("更新するTODOの内容"),
      completed: z.boolean().optional().describe("完了状態の設定"),
    }),
    execute: async ({ id, text, completed }) => {
      const todo = updateTodo(id, { text, completed });
      if (!todo) {
        return {
          success: false,
          message: `✗ ID: ${id} のTODOは見つかりませんでした。`,
        };
      }

      return {
        success: true,
        id: todo.id,
        text: todo.text,
        completed: todo.completed,
        message: `✓ TODOを更新しました: ${todo.text} (ID: ${
          todo.id.substring(
            0,
            8,
          )
        })`,
      };
    },
  }),

  // 統計情報取得ツール
  getTodoStats: tool({
    description: "TODOの統計情報を取得する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({}),
    execute: async () => {
      const stats = getTodoStats();
      return {
        success: true,
        total: stats.total,
        completed: stats.completed,
        active: stats.active,
        completionRate: stats.total > 0
          ? (stats.completed / stats.total) * 100
          : 0,
      };
    },
  }),

  // ヘルプ表示ツール
  getHelp: tool({
    description: "TODOアプリの使い方を表示する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({}),
    execute: async () => {
      return {
        success: true,
        help: getTodoHelp(),
      };
    },
  }),

  // ユーザーに質問するツール
  askHuman: tool({
    description: "ユーザーに質問をして回答を取得する",
    // @ts-ignore - zod type definitions are not up-to-date
    parameters: z.object({
      question: z.string().describe("ユーザーに対する質問"),
      defaultValue: z
        .string()
        .optional()
        .describe("デフォルトの回答（ユーザーが何も入力しない場合に使用）"),
    }),
    execute: async ({ question, defaultValue = "" }) => {
      console.log(""); // 質問の前に改行を入れて見やすくする

      try {
        // ユーザーに質問を表示して回答を取得
        const answer = await ask(question, defaultValue);

        return {
          success: true,
          question,
          answer,
          message: `質問「${question}」に対する回答: ${answer}`,
        };
      } catch (error) {
        return {
          success: false,
          question,
          error: error instanceof Error ? error.message : String(error),
          message: "質問の処理中にエラーが発生しました。",
        };
      }
    },
  }),
};

/**
 * AIにTODOアプリのコマンドを決定させる
 * @param prompt ユーザーの入力プロンプト
 * @returns AIの応答
 */
export async function processChatCommand(prompt: string): Promise<void> {
  console.log("%cthinking", "color: gray");

  try {
    // 直近の会話履歴を取得
    const recentHistory = getRecentChatHistory(5);
    let historyContext = "";

    if (recentHistory.length > 0) {
      historyContext = "\n\n直近の会話履歴:\n";
      recentHistory.forEach((chat, index) => {
        historyContext += `${index + 1}. ユーザー: ${chat.userPrompt}\n   AI: ${
          chat.aiResponse.substring(0, 100)
        }${chat.aiResponse.length > 100 ? "..." : ""}\n\n`;
      });
    }

    // AIの応答を蓄積する変数
    let fullAiResponse = "";

    const { fullStream } = await streamText({
      model: anthropic("claude-3-7-sonnet-latest", {
        // @ts-ignore - anthropic type definitions are not up-to-date
        cacheControl: true,
      }),
      system: `あなたはTODOアプリの対話インターフェースです。
ユーザーの入力を分析し、適切なツールを呼び出して処理してください。
ツールの呼び出し結果に基づいて、自然な日本語で応答してください。

ユーザーの「ヘルプ」「使い方」などの入力には getHelp ツールを呼び出してください。
明示的なコマンドではない自然な文章入力の場合は、意図を解釈して適切なツールを選んでください。

例えば：
- 「牛乳を買う必要がある」→ addTodo ツールで "牛乳を買う" タスクを追加
- 「新しいタスクを追加して」→ ユーザーの入力をそのままタスクとして addTodo ツールで追加
- 「タスク一覧を見せて」→ listTodos ツールでTODO一覧を表示
- 「買い物に関連するタスクを探して」→ searchTodos ツールで "買い物" を検索
- 「ID:abc123のタスクを完了にして」→ toggleTodo ツールで指定IDのタスクを完了に変更
- 「タスクの統計情報を見せて」→ getTodoStats ツールで統計情報を表示
- 「ID:abc123のタスク内容を更新して」→ updateTodo ツールで指定IDのタスク内容を変更
- 「ID:abc123のタスクを『牛乳と卵を買う』に変更して」→ updateTodo ツールで指定IDのタスク内容を更新

質問が必要な例：
- 「タスクを完了にして」→ askHuman ツールで「どのタスクを完了にしますか？ID または 内容の一部を教えてください」と質問し、回答を使ってタスクを特定

重要：タスク追加時には可能な限り askHuman を使わず、ユーザーの入力からタスク内容を直接抽出するか、入力された内容をそのままタスクとして追加してください。askHuman ツールは必要最小限だけ使用してください。

askHuman ツールを使用する際は、明確で具体的な質問をしてください。
必要に応じてデフォルト値を提案することもできます。

返答はシンプルに、必要な情報だけを含めてください。
成功や失敗のメッセージも適切に表示してください。
${historyContext}`,
      tools: todoTools,
      maxSteps: 3, // 複数のステップを許可
      prompt,
    });

    // 回答をストリーミング
    for await (const part of fullStream) {
      switch (part.type) {
        case "text-delta": {
          write(part.textDelta);
          // AIの応答を蓄積
          fullAiResponse += part.textDelta;
          break;
        }
        case "tool-call": {
          console.log(
            `\n%c[tool-call:${part.toolName}] ${
              JSON.stringify(
                part.args,
                null,
                2,
              )
            }`,
            "color: gray",
          );

          break;
        }

        case "tool-result": {
          console.log(
            `\n%c[tool-result:${part.toolName}] ${
              JSON.stringify(
                part.result,
                null,
                2,
              )
            }`,
            "color: gray",
          );
          break;
        }

        case "error":
          console.error("Error:", part.error);
          break;
      }
    }
    write("\n");

    // 会話履歴をデータベースに保存
    addChatHistory(prompt, fullAiResponse);
    console.log("%c会話履歴を保存しました", "color: gray");
  } catch (error) {
    console.error(
      `AIとの通信中にエラーが発生しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
