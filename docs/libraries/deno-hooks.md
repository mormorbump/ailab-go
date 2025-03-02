# deno_hooks チートシート

Husky にインスパイアされた Deno 用の Git
フック管理ツール。依存関係なし、軽量、高速。

## インストール

### 直接実行

```bash
deno run --allow-read --allow-run --allow-write https://deno.land/x/deno_hooks@0.1.1/mod.ts install
```

### deno.json に task として追加（推奨）

```json
{
  "tasks": {
    "hook": "deno run --allow-read --allow-run --allow-write https://deno.land/x/deno_hooks@0.1.1/mod.ts"
  }
}
```

## 基本コマンド

### インストール

```bash
deno task hook install [フォルダ名]
```

- `.hooks` フォルダ（または指定したフォルダ）を作成
- Git のフックパスを設定

### フックの追加

```bash
deno task hook add .hooks/pre-commit "deno fmt --check"
```

- 指定したフックファイルを作成/追加
- 既存のフックには追記される

### アンインストール

```bash
deno task hook uninstall
```

- Git のフックパスを元に戻す

## よく使うフックの例

### pre-commit フック（コミット前に実行）

```bash
# フォーマットチェック
deno task hook add .hooks/pre-commit "deno fmt --check"

# リントチェック
deno task hook add .hooks/pre-commit "deno lint"

# テスト実行
deno task hook add .hooks/pre-commit "deno test"

# 複数コマンドの組み合わせ
deno task hook add .hooks/pre-commit "deno fmt --check && deno lint && deno test"
```

### pre-push フック（プッシュ前に実行）

```bash
deno task hook add .hooks/pre-push "deno test"
```

## カスタマイズ

### フックをスキップする方法

```bash
# --no-verify フラグを使用（commit などで有効）
git commit --no-verify -m "Skip hooks"

# 環境変数 HOOK=0 を使用（すべてのフックで有効）
HOOK=0 git commit -m "Skip hooks"
```

### フックのテスト

フックファイルの末尾に `exit 1` を追加して、実際にコミットせずにテスト可能：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/hook.sh"

deno lint
deno fmt --check
exit 1  # テスト用：常にフックを失敗させる
```

### 外部スクリプトの実行

フック内から他の言語/スクリプトを実行可能：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/hook.sh"

# Deno スクリプトを実行
deno run scripts/pre-commit-checks.ts

# Python スクリプトを実行
python scripts/validate.py
```

### lint-staged との連携

```bash
# lint-staged を pre-commit フックに追加
deno task hook add .hooks/pre-commit "deno run -A npm:lint-staged"

# プロジェクトルートに .lintstagedrc を作成
```

## ワークスペース対応の設定例

Deno のワークスペースプロジェクトでは、ルートディレクトリに hooks
を設定し、各ワークスペースに対してチェックを行う例：

### ルートの deno.json に hook タスクを追加

```json
{
  "tasks": {
    "hook": "deno run --allow-read --allow-run --allow-write https://deno.land/x/deno_hooks@0.1.1/mod.ts",
    "pre-commit-check": "deno fmt --check && deno lint && deno task test"
  }
}
```

### pre-commit フックの設定

```bash
# まずインストール
deno task hook install

# pre-commit フックを追加
deno task hook add .hooks/pre-commit "deno task pre-commit-check"
```

### ワークスペース毎のチェックスクリプト例

特定のワークスペースだけをチェックするスクリプトを作成する場合：

```typescript
// scripts/pre-commit-check.ts
const workspaces = ["npm-summary", "zodcli", "todo-cli", "todo2"];

const changedFiles = new Deno.Command("git", {
  args: ["diff", "--cached", "--name-only"],
}).outputSync().stdout;

const changedFilesStr = new TextDecoder().decode(changedFiles);
const changedWorkspaces = new Set<string>();

// 変更されたファイルからワークスペースを特定
for (const file of changedFilesStr.split("\n")) {
  for (const workspace of workspaces) {
    if (file.startsWith(workspace + "/")) {
      changedWorkspaces.add(workspace);
      break;
    }
  }
}

console.log("Changed workspaces:", [...changedWorkspaces]);

// 変更されたワークスペースに対してのみチェックを実行
for (const workspace of changedWorkspaces) {
  console.log(`\nChecking ${workspace}...`);

  // フォーマットチェック
  const fmtProcess = new Deno.Command("deno", {
    args: ["fmt", "--check", workspace],
  }).spawn();
  const fmtStatus = await fmtProcess.status;
  if (!fmtStatus.success) {
    console.error(`❌ Format check failed for ${workspace}`);
    Deno.exit(1);
  }

  // リントチェック
  const lintProcess = new Deno.Command("deno", {
    args: ["lint", workspace],
  }).spawn();
  const lintStatus = await lintProcess.status;
  if (!lintStatus.success) {
    console.error(`❌ Lint check failed for ${workspace}`);
    Deno.exit(1);
  }

  // テスト実行（ワークスペース内にテストがある場合）
  const testProcess = new Deno.Command("deno", {
    args: ["test", workspace],
    cwd: workspace,
  }).spawn();
  const testStatus = await testProcess.status;
  if (!testStatus.success) {
    console.error(`❌ Tests failed for ${workspace}`);
    Deno.exit(1);
  }

  console.log(`✅ All checks passed for ${workspace}`);
}

console.log("\n✅ All workspace checks passed");
```

## 対応しているフック

以下のフックがサポートされています：

- `pre-commit`: コミット前に実行
- `prepare-commit-msg`: コミットメッセージ準備時に実行
- `commit-msg`: コミットメッセージ作成時に実行
- `post-commit`: コミット後に実行
- `pre-rebase`: リベース前に実行
- `post-checkout`: チェックアウト後に実行
- `post-merge`: マージ後に実行
- `pre-push`: プッシュ前に実行

その他のフックは [Git フックのドキュメント](https://git-scm.com/docs/githooks)
を参照。

## 参考リンク

- [GitHub リポジトリ](https://github.com/Yakiyo/deno_hooks)
- [Deno Land ページ](https://deno.land/x/deno_hooks)
- [Git フックのドキュメント](https://git-scm.com/docs/githooks)
