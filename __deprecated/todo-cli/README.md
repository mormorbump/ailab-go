# Todo CLI

シンプルなTODO管理CLIアプリケーション（Deno + SQLite + zodcli）

## 機能

- TODOタスクの追加
- TODOリストの表示（完了/未完了フィルタリング）
- TODOの完了/未完了の切り替え
- TODOの更新
- TODOの削除

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/todo-cli.git
cd todo-cli

# グローバルにインストール (オプション)
deno install --allow-read --allow-write --allow-env -n todo mod.ts
```

## 使い方

### TODOの追加

```bash
deno run --allow-read --allow-write --allow-env mod.ts add "牛乳を買う"
```

### TODOリストの表示

```bash
# 未完了のTODOを表示
deno run --allow-read --allow-write --allow-env mod.ts list

# 別名 (ls)
deno run --allow-read --allow-write --allow-env mod.ts ls

# すべてのTODO（完了済みを含む）を表示
deno run --allow-read --allow-write --allow-env mod.ts list --all
deno run --allow-read --allow-write --allow-env mod.ts ls -a
```

### TODOの完了/未完了の切り替え

```bash
deno run --allow-read --allow-write --allow-env mod.ts toggle <id>
```

### TODOの更新

```bash
# テキストを更新
deno run --allow-read --allow-write --allow-env mod.ts update <id> --text "新しいテキスト"

# 完了状態を更新
deno run --allow-read --allow-write --allow-env mod.ts update <id> --completed true
deno run --allow-read --allow-write --allow-env mod.ts update <id> --completed false

# 両方を更新
deno run --allow-read --allow-write --allow-env mod.ts update <id> --text "新しいテキスト" --completed true
```

### TODOの削除

```bash
# 削除の確認
deno run --allow-read --allow-write --allow-env mod.ts remove <id>
deno run --allow-read --allow-write --allow-env mod.ts rm <id>

# 強制削除 (確認なし)
deno run --allow-read --allow-write --allow-env mod.ts remove <id> --force
deno run --allow-read --allow-write --allow-env mod.ts rm <id> -f
```

### ヘルプの表示

```bash
deno run --allow-read --allow-write --allow-env mod.ts --help
deno run --allow-read --allow-write --allow-env mod.ts <command> --help
```

## データストレージ

TODOデータはSQLiteデータベースに保存され、`~/.todo/todo.db`に格納されます。

## 技術スタック

- [Deno](https://deno.land/) - セキュアなJavaScript/TypeScriptランタイム
- [SQLite](https://sqlite.org/) - 軽量データベース
- [zodcli](https://github.com/yourusername/zodcli) - 型安全なCLIパーサー
- [Zod](https://github.com/colinhacks/zod) - TypeScriptファーストのスキーマ検証
