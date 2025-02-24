## 型定義の方針

- 可能な限り具体的な型を使用し、any の使用を避ける
- 共通の型パターンには Utility Types を活用する
- 型エイリアスは意味のある名前をつけ、型の意図を明確にする

```ts
// 良い例
type UserId = string;
type UserData = {
  id: UserId;
  createdAt: Date;
};

// 避けるべき例
type Data = any;