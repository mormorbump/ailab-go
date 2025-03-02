import { z } from "npm:zod";
import { createNestedParser } from "../zodcli/mod.ts";
import {
  addTodo,
  getTodo,
  getTodoStats,
  listTodos,
  removeCompletedTodos,
  removeTodo,
  searchTodos,
  toggleTodo,
  updateTodo,
} from "./db.ts";
import { processChatCommand, setTodoParserForHelp } from "./ai.ts";
import {
  ask,
  confirm,
  select,
  type selectOrCreateCategory,
  type selectPriority,
} from "./ask.ts";

// 新しいTODOを追加するコマンド
const addCommandSchema = {
  name: "add",
  description: "新しいTODOを追加する",
  args: {
    text: {
      type: z.string().min(1, "タスクの内容は必須です").describe("TODOの内容"),
      positional: 0,
    },
  },
};

// TODOリストを表示するコマンド
const listCommandSchema = {
  name: "list",
  description: "TODOリストを表示する",
  args: {
    all: {
      type: z.boolean().default(false).describe("完了したタスクも表示する"),
      short: "a",
    },
  },
};

// TODOの完了/未完了を切り替えるコマンド
const toggleCommandSchema = {
  name: "toggle",
  description: "TODOの完了/未完了を切り替える",
  args: {
    id: {
      type: z.string().describe("TODOのID"),
      positional: 0,
    },
  },
};

// TODOを削除するコマンド
const removeCommandSchema = {
  name: "remove",
  description: "TODOを削除する",
  args: {
    id: {
      type: z.string().describe("TODOのID"),
      positional: 0,
    },
    force: {
      type: z.boolean().default(false).describe("確認なしで削除する"),
      short: "f",
    },
  },
};

// TODOを更新するコマンド
const updateCommandSchema = {
  name: "update",
  description: "TODOを更新する",
  args: {
    id: {
      type: z.string().describe("TODOのID"),
      positional: 0,
    },
    text: {
      type: z.string().optional().describe("新しいTODOの内容"),
      short: "t",
    },
    completed: {
      type: z.boolean().optional().describe("完了状態を設定する"),
      short: "c",
    },
  },
};

// TODOを検索するコマンド
const searchCommandSchema = {
  name: "search",
  description: "TODOをテキストで検索する",
  args: {
    text: {
      type: z
        .string()
        .min(1, "検索テキストは必須です")
        .describe("検索するテキスト"),
      positional: 0,
    },
    all: {
      type: z.boolean().default(false).describe("完了したタスクも検索する"),
      short: "a",
    },
  },
};

// TODOの統計情報を表示するコマンド
const statsCommandSchema = {
  name: "stats",
  description: "TODOの統計情報を表示する",
  args: {},
};

// 完了したTODOをすべて削除するコマンド
const clearCommandSchema = {
  name: "clear",
  description: "完了したTODOをすべて削除する",
  args: {
    force: {
      type: z.boolean().default(false).describe("確認なしで削除する"),
      short: "f",
    },
  },
};

// AIとの対話モードコマンド
const chatCommandSchema = {
  name: "chat",
  description: "AIと対話してTODOを管理する",
  args: {
    prompt: {
      type: z
        .string()
        .optional()
        .describe("対話プロンプト（指定しない場合は標準入力から読み込み）"),
      positional: 0,
    },
  },
};

// コマンド定義をまとめる
const todoCommandDefs = {
  add: addCommandSchema,
  list: listCommandSchema,
  ls: listCommandSchema, // リストのエイリアス
  toggle: toggleCommandSchema,
  remove: removeCommandSchema,
  rm: removeCommandSchema, // 削除のエイリアス
  update: updateCommandSchema,
  search: searchCommandSchema,
  stats: statsCommandSchema,
  clear: clearCommandSchema,
  chat: chatCommandSchema,
} as const;

// TODOコマンドパーサーを作成
export const todoParser = createNestedParser(todoCommandDefs, {
  name: "todo",
  description: "シンプルなTODOアプリ",
  default: "list", // デフォルトはlistコマンド
});

// aiモジュールにtodoParserを設定（循環参照問題の解決）
setTodoParserForHelp(todoParser);

// コマンドの実行関数
export async function executeCommand(args: string[]): Promise<void> {
  try {
    const result = todoParser.safeParse(args);

    if (!result.ok) {
      console.error("エラー:", result.error.message);
      console.log(todoParser.help());
      return;
    }

    const { command, data } = result.data;

    switch (command) {
      case "add":
        await handleAddCommand(data);
        break;
      case "list":
      case "ls":
        handleListCommand(data);
        break;
      case "toggle":
        await handleToggleCommand(data);
        break;
      case "remove":
      case "rm":
        await handleRemoveCommand(data);
        break;
      case "update":
        await handleUpdateCommand(data);
        break;
      case "search":
        handleSearchCommand(data);
        break;
      case "stats":
        handleStatsCommand();
        break;
      case "clear":
        await handleClearCommand(data);
        break;
      case "chat":
        await handleChatCommand(data);
        break;
      default:
        console.log(todoParser.help());
        break;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Help requested")) {
      console.log(todoParser.help());
    } else {
      console.error("予期しないエラーが発生しました:", error);
    }
  }
}

// 色付きテキストのユーティリティ関数
function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

// addコマンドのハンドラ
async function handleAddCommand(data: { text: string }): Promise<void> {
  // タスクの内容が与えられていない場合は質問する
  let taskText = data.text;
  if (!taskText || taskText.trim() === "") {
    taskText = await ask("追加するTODOの内容を入力してください");
    if (!taskText || taskText.trim() === "") {
      console.log(
        `${
          yellow(
            "!",
          )
        } TODOの内容が入力されていないため、追加をキャンセルします。`,
      );
      return;
    }
  }

  // 詳細情報はスキップ
  const askForDetails = false;

  let details = "";
  let priority = "中" as "高" | "中" | "低";
  let category = "";

  // 詳細情報の入力をスキップ

  // TODOを追加
  const newTodo = addTodo(taskText);
  console.log(
    `${green("✓")} 新しいTODOを追加しました: ${bold(newTodo.text)} (ID: ${
      dim(
        newTodo.id.substring(0, 8),
      )
    })`,
  );
}

// listコマンドのハンドラ
function handleListCommand(data: { all: boolean }): void {
  const todos = listTodos(data.all);

  if (todos.length === 0) {
    console.log(
      `${
        yellow(
          "!",
        )
      } TODOはありません。新しいTODOを追加するには: todo add <テキスト>`,
    );
    return;
  }

  console.log(`TODOリスト (${todos.length}件):`);
  console.log("─".repeat(50));
  console.log("ID        | 状態  | 内容                  | 作成日");
  console.log("─".repeat(50));

  todos.forEach((todo) => {
    const id = dim(todo.id.substring(0, 8));
    const status = todo.completed ? green("✓") : yellow("□");
    const createdAt = new Date(todo.createdAt).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    console.log(`${id} | ${status}   | ${todo.text.padEnd(20)} | ${createdAt}`);
  });

  console.log("─".repeat(50));
}

// toggleコマンドのハンドラ
async function handleToggleCommand(data: { id: string }): Promise<void> {
  // 先にTODOを取得して存在と現在の状態を確認
  const todo = getTodo(data.id);

  if (!todo) {
    console.error(
      `${red("✗")} ID: ${
        dim(
          data.id.substring(0, 8),
        )
      } のTODOは見つかりませんでした。`,
    );
    return;
  }

  // 現在の状態を表示
  const currentStatus = todo.completed ? "完了" : "未完了";
  const newStatus = todo.completed ? "未完了" : "完了";

  console.log(`現在のTODO: ${bold(todo.text)}`);
  console.log(
    `現在の状態: ${todo.completed ? green("完了") : yellow("未完了")}`,
  );

  // 状態を切り替える前に確認
  const shouldToggle = await confirm(
    `このTODOを「${newStatus}」に変更してもよろしいですか？`,
    true,
  );

  if (!shouldToggle) {
    console.log(`${yellow("!")} 状態の変更をキャンセルしました。`);
    return;
  }

  const updatedTodo = toggleTodo(data.id);

  if (!updatedTodo) {
    console.error(`${red("✗")} 状態の更新中にエラーが発生しました。`);
    return;
  }

  const statusText = updatedTodo.completed ? "完了" : "未完了";
  const statusColor = updatedTodo.completed ? green : yellow;

  console.log(
    `${statusColor("✓")} TODOを${statusText}に変更しました: ${
      bold(
        updatedTodo.text,
      )
    } (ID: ${dim(updatedTodo.id.substring(0, 8))})`,
  );
}

// removeコマンドのハンドラ
async function handleRemoveCommand(data: {
  id: string;
  force: boolean;
}): Promise<void> {
  const todo = getTodo(data.id);

  if (!todo) {
    console.error(
      `${red("✗")} ID: ${
        dim(
          data.id.substring(0, 8),
        )
      } のTODOは見つかりませんでした。`,
    );
    return;
  }

  // 強制削除でない場合、対話的に確認を取る
  if (!data.force) {
    console.log(`${yellow("!")} 次のTODOを削除します: ${bold(todo.text)}`);

    const shouldDelete = await confirm(
      "このTODOを削除してもよろしいですか？",
      false,
    );

    if (!shouldDelete) {
      console.log(`${yellow("!")} 削除をキャンセルしました。`);
      return;
    }
  }

  const removed = removeTodo(data.id);

  if (!removed) {
    console.error(
      `${red("✗")} ID: ${
        dim(
          data.id.substring(0, 8),
        )
      } のTODOは見つかりませんでした。`,
    );
    return;
  }

  console.log(
    `${green("✓")} TODOを削除しました (ID: ${dim(data.id.substring(0, 8))})`,
  );
}

// updateコマンドのハンドラ
async function handleUpdateCommand(data: {
  id: string;
  text?: string;
  completed?: boolean;
}): Promise<void> {
  const todo = getTodo(data.id);

  if (!todo) {
    console.error(
      `${red("✗")} ID: ${
        dim(
          data.id.substring(0, 8),
        )
      } のTODOは見つかりませんでした。`,
    );
    return;
  }

  console.log(`現在のTODO: ${bold(todo.text)}`);
  console.log(`状態: ${todo.completed ? green("完了") : yellow("未完了")}`);

  // 更新内容が指定されていない場合は対話的に入力させる
  let updateText = data.text;
  let updateCompleted = data.completed;

  if (updateText === undefined && updateCompleted === undefined) {
    console.log(`${yellow("!")} 更新内容を入力してください`);

    // テキストの更新を確認
    const shouldUpdateText = await confirm("テキストを更新しますか？", false);
    if (shouldUpdateText) {
      updateText = await ask("新しいテキスト", todo.text);
    }

    // 完了状態の更新を確認
    const shouldUpdateStatus = await confirm("完了状態を変更しますか？", false);
    if (shouldUpdateStatus) {
      const statusOptions = ["完了", "未完了"] as const;
      const selectedStatus = await select(
        "状態を選択してください:",
        statusOptions,
        todo.completed ? 0 : 1,
      );
      updateCompleted = selectedStatus === "完了";
    }

    // 何も変更がない場合
    if (updateText === undefined && updateCompleted === undefined) {
      console.log(
        `${
          yellow(
            "!",
          )
        } 更新内容が指定されていないため、更新をキャンセルします。`,
      );
      return;
    }
  }

  const updatedTodo = updateTodo(data.id, {
    text: updateText,
    completed: updateCompleted,
  });

  if (!updatedTodo) {
    console.error(`${red("✗")} 更新中にエラーが発生しました。`);
    return;
  }

  console.log(
    `${green("✓")} TODOを更新しました: ${bold(updatedTodo.text)} (ID: ${
      dim(
        updatedTodo.id.substring(0, 8),
      )
    })`,
  );
}

// searchコマンドのハンドラ
function handleSearchCommand(data: { text: string; all: boolean }): void {
  const todos = searchTodos(data.text, data.all);

  if (todos.length === 0) {
    console.log(
      `${yellow("!")} "${data.text}" に一致するTODOは見つかりませんでした。`,
    );
    return;
  }

  console.log(`"${data.text}" の検索結果 (${todos.length}件):`);
  console.log("─".repeat(50));
  console.log("ID        | 状態  | 内容                  | 作成日");
  console.log("─".repeat(50));

  todos.forEach((todo) => {
    const id = dim(todo.id.substring(0, 8));
    const status = todo.completed ? green("✓") : yellow("□");
    const createdAt = new Date(todo.createdAt).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    console.log(`${id} | ${status}   | ${todo.text.padEnd(20)} | ${createdAt}`);
  });

  console.log("─".repeat(50));
}

// statsコマンドのハンドラ
function handleStatsCommand(): void {
  const stats = getTodoStats();

  console.log("TODOの統計情報:");
  console.log("─".repeat(30));
  console.log(`総タスク数:  ${bold(stats.total.toString())}`);
  console.log(`完了済み:    ${green(stats.completed.toString())}`);
  console.log(`未完了:      ${yellow(stats.active.toString())}`);
  console.log(
    `完了率:      ${
      (stats.total > 0 ? (stats.completed / stats.total) * 100 : 0).toFixed(1)
    }%`,
  );
  console.log("─".repeat(30));
}

// clearコマンドのハンドラ
async function handleClearCommand(data: { force: boolean }): Promise<void> {
  const stats = getTodoStats();

  if (stats.completed === 0) {
    console.log(`${yellow("!")} 完了済みのTODOはありません。`);
    return;
  }

  // 強制削除でない場合、対話的に確認を取る
  if (!data.force) {
    console.log(
      `${yellow("!")} ${stats.completed}件の完了済みTODOを削除します。`,
    );

    const shouldDelete = await confirm(
      `${stats.completed}件の完了済みTODOを削除してもよろしいですか？`,
      false,
    );

    if (!shouldDelete) {
      console.log(`${yellow("!")} 削除をキャンセルしました。`);
      return;
    }
  }

  const count = removeCompletedTodos();
  console.log(`${green("✓")} ${count}件の完了済みTODOを削除しました。`);
}

// chatコマンドのハンドラ
async function handleChatCommand(data: { prompt?: string }): Promise<void> {
  try {
    // プロンプトが指定されていない場合は標準入力から読み込む
    let userPrompt = data.prompt;
    if (!userPrompt) {
      console.log(
        "対話モードを開始します。終了するには「終了」と入力してください。",
      );
      console.log("何をお手伝いしましょうか？");
      console.log(">> ");

      // 標準入力から読み込む
      const buf = new Uint8Array(1024);
      const n = await Deno.stdin.read(buf);
      if (n) {
        userPrompt = new TextDecoder().decode(buf.subarray(0, n)).trim();
      }

      if (
        !userPrompt ||
        userPrompt.toLowerCase() === "終了" ||
        userPrompt.toLowerCase() === "exit"
      ) {
        console.log("対話モードを終了します。");
        return;
      }
    }

    // AIとの対話処理を実行
    await processChatCommand(userPrompt);
  } catch (error) {
    console.error(
      "対話処理中にエラーが発生しました:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
