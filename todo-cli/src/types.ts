import { z } from "zod";

/**
 * TODOタスクのZodスキーマ
 */
export const todoSchema = z.object({
  /** タスクのID */
  id: z.string().uuid(),
  /** タスクの内容 */
  text: z.string().min(1, "タスクの内容は必須です"),
  /** タスクが完了しているかどうか */
  completed: z.boolean().default(false),
  /** タスクの作成日時 */
  createdAt: z.string().datetime(),
  /** タスクの更新日時 */
  updatedAt: z.string().datetime(),
});

/**
 * TODOタスクの型
 */
export type Todo = z.infer<typeof todoSchema>;

/**
 * 新しいTODO作成用のスキーマ（IDと日付は自動生成）
 */
export const newTodoSchema = todoSchema.pick({ text: true });

/**
 * 新しいTODO作成用の型
 */
export type NewTodo = z.infer<typeof newTodoSchema>;

/**
 * TODOリストのスキーマ
 */
export const todoListSchema = z.object({
  todos: z.array(todoSchema),
});

/**
 * TODOリストの型
 */
export type TodoList = z.infer<typeof todoListSchema>;

/**
 * TODOの更新用のスキーマ
 */
export const todoUpdateSchema = todoSchema.partial().pick({
  text: true,
  completed: true,
});

/**
 * TODOの更新用の型
 */
export type TodoUpdate = z.infer<typeof todoUpdateSchema>;

/**
 * チャット履歴のZodスキーマ
 */
export const chatHistorySchema = z.object({
  /** チャット履歴のID */
  id: z.string().uuid(),
  /** ユーザーの入力プロンプト */
  userPrompt: z.string(),
  /** AIの応答 */
  aiResponse: z.string(),
  /** 会話が行われた日時 */
  timestamp: z.string().datetime(),
});

/**
 * チャット履歴の型
 */
export type ChatHistory = z.infer<typeof chatHistorySchema>;
