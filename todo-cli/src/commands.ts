import { z } from "zod";
import { createNestedParser } from "../../zodcli/mod.ts";
import {
  addTodo,
  listTodos,
  toggleTodo,
  removeTodo,
  updateTodo,
  getTodo,
  searchTodos,
  getTodoStats,
  removeCompletedTodos,
} from "./db.ts";

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
} as const;

// TODOコマンドパーサーを作成
export const todoParser = createNestedParser(todoCommandDefs, {
  name: "todo",
  description: "シンプルなTODOアプリ",
  default: "list", // デフォルトはlistコマンド
});

// コマンドの実行関数
export function executeCommand(args: string[]): void {
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
        handleAddCommand(data);
        break;
      case "list":
      case "ls":
        handleListCommand(data);
        break;
      case "toggle":
        handleToggleCommand(data);
        break;
      case "remove":
      case "rm":
        handleRemoveCommand(data);
        break;
      case "update":
        handleUpdateCommand(data);
        break;
      case "search":
        handleSearchCommand(data);
        break;
      case "stats":
        handleStatsCommand();
        break;
      case "clear":
        handleClearCommand(data);
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
function handleAddCommand(data: { text: string }): void {
  const newTodo = addTodo(data.text);
  console.log(
    `${green("✓")} 新しいTODOを追加しました: ${bold(newTodo.text)} (ID: ${dim(
      newTodo.id.substring(0, 8)
    )})`
  );
}

// listコマンドのハンドラ
function handleListCommand(data: { all: boolean }): void {
  const todos = listTodos(data.all);

  if (todos.length === 0) {
    console.log(
      `${yellow(
        "!"
      )} TODOはありません。新しいTODOを追加するには: todo add <テキスト>`
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
function handleToggleCommand(data: { id: string }): void {
  const updatedTodo = toggleTodo(data.id);

  if (!updatedTodo) {
    console.error(
      `${red("✗")} ID: ${dim(
        data.id.substring(0, 8)
      )} のTODOは見つかりませんでした。`
    );
    return;
  }

  const statusText = updatedTodo.completed ? "完了" : "未完了";
  const statusColor = updatedTodo.completed ? green : yellow;

  console.log(
    `${statusColor("✓")} TODOを${statusText}に変更しました: ${bold(
      updatedTodo.text
    )} (ID: ${dim(updatedTodo.id.substring(0, 8))})`
  );
}

// removeコマンドのハンドラ
function handleRemoveCommand(data: { id: string; force: boolean }): void {
  // 強制削除でない場合、TODOの内容を表示して確認
  if (!data.force) {
    const todo = getTodo(data.id);

    if (!todo) {
      console.error(
        `${red("✗")} ID: ${dim(
          data.id.substring(0, 8)
        )} のTODOは見つかりませんでした。`
      );
      return;
    }

    console.log(`${yellow("!")} 次のTODOを削除します: ${bold(todo.text)}`);
    console.log(
      `${yellow("!")} 強制削除するには -f オプションを使用してください。`
    );
    return;
  }

  const removed = removeTodo(data.id);

  if (!removed) {
    console.error(
      `${red("✗")} ID: ${dim(
        data.id.substring(0, 8)
      )} のTODOは見つかりませんでした。`
    );
    return;
  }

  console.log(
    `${green("✓")} TODOを削除しました (ID: ${dim(data.id.substring(0, 8))})`
  );
}

// updateコマンドのハンドラ
function handleUpdateCommand(data: {
  id: string;
  text?: string;
  completed?: boolean;
}): void {
  // 更新対象がなければ何もしない
  if (data.text === undefined && data.completed === undefined) {
    console.error(
      `${yellow(
        "!"
      )} 更新する内容を指定してください (--text または --completed)`
    );
    return;
  }

  const updatedTodo = updateTodo(data.id, {
    text: data.text,
    completed: data.completed,
  });

  if (!updatedTodo) {
    console.error(
      `${red("✗")} ID: ${dim(
        data.id.substring(0, 8)
      )} のTODOは見つかりませんでした。`
    );
    return;
  }

  console.log(
    `${green("✓")} TODOを更新しました: ${bold(updatedTodo.text)} (ID: ${dim(
      updatedTodo.id.substring(0, 8)
    )})`
  );
}

// searchコマンドのハンドラ
function handleSearchCommand(data: { text: string; all: boolean }): void {
  const todos = searchTodos(data.text, data.all);

  if (todos.length === 0) {
    console.log(
      `${yellow("!")} "${data.text}" に一致するTODOは見つかりませんでした。`
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
    `完了率:      ${(stats.total > 0
      ? (stats.completed / stats.total) * 100
      : 0
    ).toFixed(1)}%`
  );
  console.log("─".repeat(30));
}

// clearコマンドのハンドラ
function handleClearCommand(data: { force: boolean }): void {
  // 強制削除でない場合、確認メッセージを表示
  if (!data.force) {
    const stats = getTodoStats();

    if (stats.completed === 0) {
      console.log(`${yellow("!")} 完了済みのTODOはありません。`);
      return;
    }

    console.log(
      `${yellow("!")} ${stats.completed}件の完了済みTODOを削除します。`
    );
    console.log(
      `${yellow("!")} 削除するには -f オプションを使用してください。`
    );
    return;
  }

  const count = removeCompletedTodos();

  if (count === 0) {
    console.log(`${yellow("!")} 完了済みのTODOはありません。`);
    return;
  }

  console.log(`${green("✓")} ${count}件の完了済みTODOを削除しました。`);
}
