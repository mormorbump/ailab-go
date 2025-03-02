import { DatabaseSync, type SupportedValueType } from "node:sqlite";
import type { ChatHistory, Todo, TodoUpdate } from "./types.ts";
import { ensureDirSync, type existsSync } from "@std/fs";
import { type dirname, join } from "@std/path";

// TODOデータを保存するディレクトリとDBファイルのパス
const HOME_DIR = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
const TODO_DIR = join(HOME_DIR, ".todo");
const DB_PATH = join(TODO_DIR, "todo.db");

/**
 * データベース接続を初期化する
 * @returns SQLiteデータベース接続
 */
export function initDb(): DatabaseSync {
  // データディレクトリが存在しない場合は作成
  ensureDirSync(TODO_DIR);

  // DBに接続
  const db = new DatabaseSync(DB_PATH);

  // TODOテーブルが存在しない場合は作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // チャット履歴テーブルが存在しない場合は作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      user_prompt TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  return db;
}

/**
 * 新しいTODOを追加する
 * @param text TODOの内容
 * @returns 追加されたTODO
 */
export function addTodo(text: string): Todo {
  const db = initDb();
  const now = new Date().toISOString();

  const todo: Todo = {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    "INSERT INTO todos (id, text, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    todo.id,
    todo.text,
    todo.completed ? 1 : 0,
    todo.createdAt,
    todo.updatedAt,
  );

  db.close();

  return todo;
}

/**
 * TODOを完了/未完了に切り替える
 * @param id TODOのID（完全なIDまたは部分的なID）
 * @returns 更新されたTODO、見つからない場合はnull
 */
export function toggleTodo(id: string): Todo | null {
  const db = initDb();
  const now = new Date().toISOString();

  // 完全一致または部分一致するTODOを検索
  // 部分一致の場合はLIKE演算子を使う
  const row = db
    .prepare(
      "SELECT id, text, completed, created_at as createdAt, updated_at as updatedAt FROM todos WHERE id = ? OR id LIKE ?",
    )
    .get(id, `%${id}%`) as Todo | undefined;

  if (!row) {
    db.close();
    return null;
  }

  const newStatus = !row.completed;
  const todoId = row.id; // 完全なIDを取得

  // ステータスを更新
  db.prepare("UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?").run(
    newStatus ? 1 : 0,
    now,
    todoId,
  );

  db.close();

  // 更新されたTODOを返す
  return {
    ...row,
    completed: newStatus,
    updatedAt: now,
  };
}

/**
 * TODOを更新する
 * @param id TODOのID
 * @param update 更新内容
 * @returns 更新されたTODO、見つからない場合はnull
 */
export function updateTodo(id: string, update: TodoUpdate): Todo | null {
  const db = initDb();
  const now = new Date().toISOString();

  // 現在のTODOを取得
  const row = db
    .prepare(
      "SELECT id, text, completed, created_at as createdAt, updated_at as updatedAt FROM todos WHERE id = ?",
    )
    .get(id) as Todo | undefined;

  if (!row) {
    db.close();
    return null;
  }

  const todo = row;

  // 更新用のフィールドとパラメータを準備
  const fields: string[] = [];
  const params: SupportedValueType[] = [];

  if (update.text !== undefined) {
    fields.push("text = ?");
    params.push(update.text);
  }

  if (update.completed !== undefined) {
    fields.push("completed = ?");
    params.push(update.completed ? 1 : 0);
  }

  // 更新日時は常に更新
  fields.push("updated_at = ?");
  params.push(now);

  // IDは最後のパラメータ
  params.push(id);

  // 更新クエリを実行
  db.prepare(`UPDATE todos SET ${fields.join(", ")} WHERE id = ?`).run(
    ...params,
  );

  db.close();

  // 更新されたTODOを返す
  return {
    ...todo,
    ...(update.text !== undefined ? { text: update.text } : {}),
    ...(update.completed !== undefined ? { completed: update.completed } : {}),
    updatedAt: now,
  };
}

/**
 * TODOを削除する
 * @param id TODOのID
 * @returns 削除に成功したかどうか
 */
export function removeTodo(id: string): boolean {
  const db = initDb();

  // 削除前に存在確認
  const exists = !!db.prepare("SELECT 1 FROM todos WHERE id = ?").get(id);

  if (!exists) {
    db.close();
    return false;
  }

  // 削除を実行
  db.prepare("DELETE FROM todos WHERE id = ?").run(id);

  db.close();

  return true;
}

/**
 * すべてのTODOを取得する
 * @param showCompleted 完了したTODOを含めるかどうか
 * @returns TODOのリスト
 */
export function listTodos(showCompleted = true): Todo[] {
  const db = initDb();

  let query =
    "SELECT id, text, completed, created_at as createdAt, updated_at as updatedAt FROM todos";

  if (!showCompleted) {
    query += " WHERE completed = 0";
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all() as Todo[];

  db.close();

  return rows;
}

/**
 * IDでTODOを取得する
 * @param id TODOのID
 * @returns TODOまたはnull
 */
export function getTodo(id: string): Todo | null {
  const db = initDb();

  const row = db
    .prepare(
      "SELECT id, text, completed, created_at as createdAt, updated_at as updatedAt FROM todos WHERE id = ?",
    )
    .get(id) as Todo | undefined;

  db.close();

  return row || null;
}

/**
 * テキストでTODOを検索する
 * @param searchText 検索するテキスト
 * @param showCompleted 完了したTODOを含めるかどうか
 * @returns 検索結果のTODOリスト
 */
export function searchTodos(searchText: string, showCompleted = true): Todo[] {
  const db = initDb();

  // SQLiteのLIKE演算子用にワイルドカード文字を追加
  const searchPattern = `%${searchText}%`;

  let query =
    "SELECT id, text, completed, created_at as createdAt, updated_at as updatedAt FROM todos WHERE text LIKE ?";

  const params: SupportedValueType[] = [searchPattern];

  if (!showCompleted) {
    query += " AND completed = 0";
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params) as Todo[];

  db.close();

  return rows;
}

/**
 * TODOの統計情報を取得する
 * @returns 統計情報（総数、完了数、未完了数）
 */
export function getTodoStats(): {
  total: number;
  completed: number;
  active: number;
} {
  const db = initDb();

  // 総数
  const totalCount = db
    .prepare("SELECT COUNT(*) as count FROM todos")
    .get() as { count: number };

  // 完了数
  const completedCount = db
    .prepare("SELECT COUNT(*) as count FROM todos WHERE completed = 1")
    .get() as { count: number };

  db.close();

  return {
    total: totalCount.count,
    completed: completedCount.count,
    active: totalCount.count - completedCount.count,
  };
}

/**
 * 完了したTODOをすべて削除する
 * @returns 削除された項目の数
 */
export function removeCompletedTodos(): number {
  const db = initDb();

  // 削除前に完了済みTODOの数を取得
  const countResult = db
    .prepare("SELECT COUNT(*) as count FROM todos WHERE completed = 1")
    .get() as { count: number };
  const count = countResult.count;

  if (count > 0) {
    // 削除を実行
    db.prepare("DELETE FROM todos WHERE completed = 1").run();
  }

  db.close();

  return count;
}

/**
 * 新しい会話履歴を追加する
 * @param userPrompt ユーザーの入力プロンプト
 * @param aiResponse AIの応答
 * @returns 追加された会話履歴
 */
export function addChatHistory(
  userPrompt: string,
  aiResponse: string,
): ChatHistory {
  const db = initDb();
  const now = new Date().toISOString();

  const chatHistory: ChatHistory = {
    id: crypto.randomUUID(),
    userPrompt,
    aiResponse,
    timestamp: now,
  };

  db.prepare(
    "INSERT INTO chat_history (id, user_prompt, ai_response, timestamp) VALUES (?, ?, ?, ?)",
  ).run(
    chatHistory.id,
    chatHistory.userPrompt,
    chatHistory.aiResponse,
    chatHistory.timestamp,
  );

  db.close();

  return chatHistory;
}

/**
 * 直近の会話履歴を取得する
 * @param limit 取得する履歴の数（デフォルト:5）
 * @returns 会話履歴のリスト
 */
export function getRecentChatHistory(limit = 5): ChatHistory[] {
  const db = initDb();

  const query = `
    SELECT
      id,
      user_prompt as userPrompt,
      ai_response as aiResponse,
      timestamp
    FROM
      chat_history
    ORDER BY
      timestamp DESC
    LIMIT ?
  `;

  const rows = db.prepare(query).all(limit) as ChatHistory[];

  db.close();

  return rows;
}
