# Git Hooks の設定と使用方法

このドキュメントでは、プロジェクトで使用しているGit Hooksの設定方法と使用方法について説明します。

## pre-commit フック

pre-commitフックは、コミット前に自動的に実行され、コードの品質チェックを行います。このプロジェクトでは、Goスクリプトを使用してフォーマットチェック、静的解析、リントチェック、テスト実行などを行っています。

### 設定手順

1. **pre-commitスクリプトの作成**

   `.hooks/scripts/pre-commit-check.go` ファイルを作成し、以下のような内容を記述します：

   ```go
   
   package main

   import (
       "bufio"
       "bytes"
       "fmt"
       "io/ioutil"
       "os"
       "os/exec"
       "strings"
   )

   // ワークスペース設定
   var rootLevelScripts = []string{"scripts"}

   func main() {
       // ワークスペース一覧を取得
       workspaces, err := getWorkspaces()
       if err != nil {
           fmt.Printf("警告: ワークスペース情報の取得に失敗しました: %v\n", err)
           workspaces = []string{} // 空の配列で続行
       }

       // Git でステージングされたファイル一覧を取得
       changedFiles, err := getGitStagedFiles()
       if err != nil {
           fmt.Printf("エラー: Gitの変更ファイル取得に失敗しました: %v\n", err)
           os.Exit(1)
       }

       // 変更されたファイルからワークスペースとスクリプトを特定
       changedPaths := make(map[string]bool)
       for _, file := range changedFiles {
           if file == "" {
               continue
           }

           // ワークスペースの変更をチェック
           for _, workspace := range workspaces {
               if strings.HasPrefix(file, workspace+"/") {
                   changedPaths[workspace] = true
                   break
               }
           }

           // ルートレベルのスクリプト変更をチェック
           for _, scriptDir := range rootLevelScripts {
               if strings.HasPrefix(file, scriptDir+"/") {
                   changedPaths[scriptDir] = true
                   break
               }
           }

           // ルートレベルの .go ファイルをチェック
           if strings.HasSuffix(file, ".go") && !strings.Contains(file, "/") {
               changedPaths["root"] = true
           }
       }

       // 何も変更がない場合は終了
       if len(changedPaths) == 0 {
           fmt.Println("No relevant changes detected. Skipping checks.")
           os.Exit(0)
       }

       // 変更されたパスを表示
       paths := make([]string, 0, len(changedPaths))
       for path := range changedPaths {
           paths = append(paths, path)
       }
       fmt.Printf("Changed paths: %v\n", paths)

       // フォーマットチェック
       fmt.Println("\n📝 Running format check...")
       // Goファイルが存在するディレクトリを特定
       goFiles, err := findGoFiles()
       if err != nil {
           fmt.Printf("警告: Goファイルの検索に失敗しました: %v\n", err)
       }

       if len(goFiles) > 0 {
           goDirs := getGoDirs(goFiles)
           for _, dir := range goDirs {
               fmt.Printf("Formatting Go files in %s\n", dir)
               if err := runCommand("go", "fmt", dir); err != nil {
                   fmt.Println("❌ Format check failed")
                   os.Exit(1)
               }
           }
           fmt.Println("✅ Format check passed")
       } else {
           fmt.Println("⚠️ No Go files found to format")
       }

       // 静的解析チェック
       fmt.Println("\n🔍 Running vet check...")
       if len(goFiles) > 0 {
           goDirs := getGoDirs(goFiles)
           for _, dir := range goDirs {
               fmt.Printf("Vetting Go files in %s\n", dir)
               if err := runCommand("go", "vet", dir); err != nil {
                   fmt.Println("❌ Vet check failed")
                   os.Exit(1)
               }
           }
           fmt.Println("✅ Vet check passed")
       } else {
           fmt.Println("⚠️ No Go files found to vet")
       }

       // リントチェック（golangci-lintがインストールされている場合）
       if commandExists("golangci-lint") {
           fmt.Println("\n🔍 Running lint check...")
           if len(goFiles) > 0 {
               goDirs := getGoDirs(goFiles)
               for _, dir := range goDirs {
                   fmt.Printf("Linting Go files in %s\n", dir)
                   if err := runCommand("golangci-lint", "run", dir); err != nil {
                       fmt.Println("❌ Lint check failed")
                       os.Exit(1)
                   }
               }
               fmt.Println("✅ Lint check passed")
           } else {
               fmt.Println("⚠️ No Go files found to lint")
           }
       }

       // 変更されたワークスペース/スクリプトに対してテストを実行
       if len(goFiles) > 0 {
           for path := range changedPaths {
               if path == "root" || path == "scripts" {
                   continue // ルートとscriptsのテストはスキップ
               }

               // パスにGoファイルが含まれているか確認
               hasGoFiles := false
               for _, file := range goFiles {
                   if strings.HasPrefix(file, "./"+path+"/") {
                       hasGoFiles = true
                       break
                   }
               }

               if !hasGoFiles {
                   fmt.Printf("\n⚠️ No Go files found in %s, skipping tests\n", path)
                   continue
               }

               fmt.Printf("\n🧪 Running tests for %s...\n", path)

               testPath := "./" + path + "/..."
               if err := runCommand("go", "test", "-v", testPath); err != nil {
                   fmt.Printf("❌ Tests failed for %s\n", path)
                   os.Exit(1)
               } else {
                   fmt.Printf("✅ Tests passed for %s\n", path)
               }
           }
       } else {
           fmt.Println("\n⚠️ No Go files found to test")
       }

       // 依存関係チェック
       for _, arg := range os.Args[1:] {
           if arg == "--check-deps" {
               fmt.Println("\n📦 Running dependency check...")
               // go.modファイルが存在するか確認
               if _, err := os.Stat("go.mod"); err == nil {
                   if err := runCommand("go", "mod", "verify"); err != nil {
                       fmt.Println("❌ Dependency check failed")
                       os.Exit(1)
                   } else {
                       fmt.Println("✅ Dependency check passed")
                   }
               } else {
                   fmt.Println("⚠️ No go.mod file found, skipping dependency check")
               }
               break
           }
       }

       fmt.Println("\n✅ All checks passed successfully!")
   }

   // getWorkspaces はgo.modファイルからモジュール名を取得し、ワークスペースを推測します
   func getWorkspaces() ([]string, error) {
       // go.modファイルを読み込む
       content, err := ioutil.ReadFile("go.mod")
       if err != nil {
           return nil, err
       }

       // モジュール名を取得
       scanner := bufio.NewScanner(bytes.NewReader(content))
       for scanner.Scan() {
           line := scanner.Text()
           if strings.HasPrefix(line, "module ") {
               // ここでは簡易的に、プロジェクト内のディレクトリをワークスペースとして扱います
               // 実際のプロジェクト構造に合わせて調整してください
               entries, err := ioutil.ReadDir(".")
               if err != nil {
                   return nil, err
               }

               var workspaces []string
               for _, entry := range entries {
                   if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") && !strings.HasPrefix(entry.Name(), "_") {
                       // 一般的なGoプロジェクトのディレクトリ構造をチェック
                       if entry.Name() == "cmd" || entry.Name() == "pkg" || entry.Name() == "internal" {
                           workspaces = append(workspaces, entry.Name())
                       }
                   }
               }
               return workspaces, nil
           }
       }

       return []string{}, nil
   }

   // getGitStagedFiles はGitでステージングされたファイル一覧を取得します
   func getGitStagedFiles() ([]string, error) {
       cmd := exec.Command("git", "diff", "--cached", "--name-only")
       output, err := cmd.Output()
       if err != nil {
           return nil, err
       }

       files := strings.Split(string(output), "\n")
       return files, nil
   }

   // runCommand は指定されたコマンドを実行します
   func runCommand(name string, args ...string) error {
       cmd := exec.Command(name, args...)
       cmd.Stdout = os.Stdout
       cmd.Stderr = os.Stderr
       return cmd.Run()
   }

   // commandExists は指定されたコマンドが存在するかチェックします
   func commandExists(cmd string) bool {
       _, err := exec.LookPath(cmd)
       return err == nil
   }

   // findGoFiles はプロジェクト内のGoファイルを検索します
   func findGoFiles() ([]string, error) {
       fmt.Println("検索コマンド: find . -name \"*.go\" -type f -not -path \"*/\\.*\"")
       cmd := exec.Command("find", ".", "-name", "*.go", "-type", "f", "-not", "-path", "*/\\.*")
       output, err := cmd.Output()
       if err != nil {
           return nil, err
       }

       files := strings.Split(string(output), "\n")
       var goFiles []string
       for _, file := range files {
           if file != "" {
               goFiles = append(goFiles, file)
           }
       }
       
       fmt.Println("検索結果:")
       if len(goFiles) == 0 {
           fmt.Println("  Goファイルが見つかりませんでした")
       } else {
           for _, file := range goFiles {
               fmt.Printf("  %s\n", file)
           }
       }
       
       // カレントディレクトリも表示
       pwd, err := os.Getwd()
       if err == nil {
           fmt.Printf("カレントディレクトリ: %s\n", pwd)
       }
       
       return goFiles, nil
   }

   // getGoDirs はGoファイルが存在するディレクトリのリストを返します
   func getGoDirs(goFiles []string) []string {
       dirMap := make(map[string]bool)
       for _, file := range goFiles {
           dir := "."
           if lastSlash := strings.LastIndex(file, "/"); lastSlash != -1 {
               dir = file[:lastSlash]
           }
           dirMap[dir] = true
       }

       dirs := make([]string, 0, len(dirMap))
       for dir := range dirMap {
           dirs = append(dirs, dir)
       }
       return dirs
   }
   ```

2. **pre-commitフックの作成**

   `.hooks/pre-commit` ファイルを作成し、以下の内容を記述します：

   ```sh
   #!/usr/bin/env sh

   # プロジェクトのルートディレクトリを取得
   ROOT_DIR=$(git rev-parse --show-toplevel)

   # Goスクリプトを実行
   go run "$ROOT_DIR/.hooks/scripts/pre-commit-check.go"
   ```

3. **実行権限の付与**

   pre-commitフックに実行権限を付与します：

   ```bash
   chmod +x .hooks/pre-commit
   ```

4. **Gitフックの設定**

   `.git/hooks` ディレクトリに `.hooks/pre-commit` へのシンボリックリンクを作成します：

   ```bash
   ln -sf "$(pwd)/.hooks/pre-commit" .git/hooks/pre-commit
   ```

### 動作確認

pre-commitフックが正しく設定されているか確認するには、以下の手順を実行します：

1. ファイルを変更してステージングします：

   ```bash
   # ファイルを変更
   echo "// Test" >> test.go

   # 変更をステージング
   git add test.go
   ```

2. コミットを実行します：

   ```bash
   git commit -m "Test pre-commit hook"
   ```

   コミット時に pre-commit フックが実行され、以下のような出力が表示されます：

   ```
   Changed paths: [root]

   📝 Running format check...
   Formatting Go files in .
   ✅ Format check passed

   🔍 Running vet check...
   Vetting Go files in .
   ✅ Vet check passed

   🔍 Running lint check...
   Linting Go files in .
   ✅ Lint check passed

   ✅ All checks passed successfully!
   [main xxxxxxx] Test pre-commit hook
    1 file changed, 1 insertion(+)
   ```

### 注意事項

- pre-commitフックは、コミット時に自動的に実行されます。
- フックのチェックに失敗した場合、コミットは中断されます。
- `--no-verify` オプションを使用すると、pre-commitフックをスキップできますが、推奨されません：

  ```bash
  git commit -m "Skip pre-commit hook" --no-verify
  ```

- 新しい開発者がリポジトリをクローンした場合、手動でフックを設定する必要があります：

  ```bash
  ln -sf "$(pwd)/.hooks/pre-commit" .git/hooks/pre-commit
  ```

### トラブルシューティング

1. **フックが実行されない場合**

   - フックファイルに実行権限があるか確認します：
     ```bash
     ls -la .git/hooks/pre-commit
     ```

   - シンボリックリンクが正しく設定されているか確認します：
     ```bash
     ls -la .git/hooks/pre-commit
     ```

   - フックパスが正しく設定されているか確認します：
     ```bash
     git config --get core.hooksPath
     ```

2. **フックがエラーで失敗する場合**

   - エラーメッセージを確認し、問題を修正します。
   - 必要なツール（go、golangci-lint など）がインストールされているか確認します。
   - パスが正しく設定されているか確認します。

## その他のGitフック

このプロジェクトでは、現在 pre-commit フックのみを使用していますが、以下のような他のフックも利用可能です：

- **pre-push**: プッシュ前に実行されるフック
- **commit-msg**: コミットメッセージの検証を行うフック
- **post-commit**: コミット後に実行されるフック

これらのフックも同様の方法で設定できます。詳細は [Git Hooks の公式ドキュメント](https://git-scm.com/docs/githooks) を参照してください。