import { integer, sqliteTable, text } from "drizzle-sqlite";
import { z } from "zod";

/**
 * Todo テーブルのスキーマ定義
 */
export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

/**
 * チャット履歴テーブルのスキーマ定義
 */
export const chatHistory = sqliteTable("chat_history", {
  id: text("id").primaryKey(),
  user_prompt: text("user_prompt").notNull(),
  ai_response: text("ai_response").notNull(),
  timestamp: text("timestamp").notNull(),
});

/**
 * Todo 型はドリズルのスキーマから自動的に推論
 */
export type Todo = typeof todos.$inferSelect;

/**
 * 新規 Todo 作成のための型
 */
export type NewTodo = Pick<Todo, "text">;

/**
 * Todo 更新のための型
 */
export type TodoUpdate = Partial<Pick<Todo, "text" | "completed">>;

/**
 * チャット履歴の型
 */
export type ChatHistory = typeof chatHistory.$inferSelect;

// Zod スキーマ - バリデーション用
export const todoSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1, "タスクの内容は必須です"),
  completed: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const todoUpdateSchema = todoSchema.partial().pick({
  text: true,
  completed: true,
});

export const chatHistorySchema = z.object({
  id: z.string().uuid(),
  user_prompt: z.string(),
  ai_response: z.string(),
  timestamp: z.string().datetime(),
});
