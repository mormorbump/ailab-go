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
			// gofmt コマンドを使用してフォーマット
			if err := runCommand("gofmt", "-w", dir); err != nil {
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
			// go.workファイルが存在する場合は、-mod=readonly オプションを追加
			if _, err := os.Stat("go.work"); err == nil {
				if err := runCommand("go", "vet", "-mod=readonly", dir); err != nil {
					fmt.Println("❌ Vet check failed")
					os.Exit(1)
				}
			} else {
				// go.workファイルがない場合は、従来通り go vet を使用
				if err := runCommand("go", "vet", dir); err != nil {
					fmt.Println("❌ Vet check failed")
					os.Exit(1)
				}
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
			// go.workファイルが存在する場合は、-mod=readonly オプションを追加
			if _, err := os.Stat("go.work"); err == nil {
				if err := runCommand("go", "test", "-mod=readonly", "-v", testPath); err != nil {
					fmt.Printf("❌ Tests failed for %s\n", path)
					os.Exit(1)
				} else {
					fmt.Printf("✅ Tests passed for %s\n", path)
				}
			} else {
				// go.workファイルがない場合は、従来通り go test を使用
				if err := runCommand("go", "test", "-v", testPath); err != nil {
					fmt.Printf("❌ Tests failed for %s\n", path)
					os.Exit(1)
				} else {
					fmt.Printf("✅ Tests passed for %s\n", path)
				}
			}
		}
	} else {
		fmt.Println("\n⚠️ No Go files found to test")
	}

	// 依存関係チェック
	for _, arg := range os.Args[1:] {
		if arg == "--check-deps" {
			fmt.Println("\n📦 Running dependency check...")
			// go.workファイルが存在するか確認
			if _, err := os.Stat("go.work"); err == nil {
				if err := runCommand("go", "work", "sync"); err != nil {
					fmt.Println("❌ Workspace sync failed")
					os.Exit(1)
				}

				// 各ワークスペースの依存関係を検証
				workspaces, err := getWorkspaces()
				if err != nil {
					fmt.Printf("警告: ワークスペース情報の取得に失敗しました: %v\n", err)
				} else {
					for _, workspace := range workspaces {
						if _, err := os.Stat(workspace + "/go.mod"); err == nil {
							fmt.Printf("Verifying dependencies for %s\n", workspace)
							if err := runCommand("go", "mod", "verify", "-C", workspace); err != nil {
								fmt.Printf("❌ Dependency check failed for %s\n", workspace)
								os.Exit(1)
							}
						}
					}
				}
				fmt.Println("✅ Dependency check passed")
			} else if _, err := os.Stat("go.mod"); err == nil {
				// go.modファイルが存在する場合
				if err := runCommand("go", "mod", "verify"); err != nil {
					fmt.Println("❌ Dependency check failed")
					os.Exit(1)
				} else {
					fmt.Println("✅ Dependency check passed")
				}
			} else {
				fmt.Println("⚠️ No go.mod or go.work file found, skipping dependency check")
			}
			break
		}
	}

	fmt.Println("\n✅ All checks passed successfully!")
}

// getWorkspaces はgo.workファイルからワークスペース情報を取得します
func getWorkspaces() ([]string, error) {
	// go.workファイルを読み込む
	content, err := ioutil.ReadFile("go.work")
	if err != nil {
		return nil, err
	}

	var workspaces []string
	scanner := bufio.NewScanner(bytes.NewReader(content))
	inUseBlock := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// use ブロックの開始を検出
		if line == "use (" {
			inUseBlock = true
			continue
		}

		// use ブロックの終了を検出
		if inUseBlock && line == ")" {
			inUseBlock = false
			continue
		}

		// use ブロック内のパスを処理
		if inUseBlock && line != "" {
			// 先頭の "./" を削除
			path := strings.TrimPrefix(line, "./")
			path = strings.TrimSpace(path)
			if path != "" && path != "." {
				workspaces = append(workspaces, path)
			}
		}

		// 単一行の use 文を処理 (例: use ./path)
		if strings.HasPrefix(line, "use ") && !inUseBlock {
			parts := strings.Fields(line)
			if len(parts) > 1 {
				path := strings.TrimPrefix(parts[1], "./")
				path = strings.TrimSpace(path)
				if path != "" && path != "." {
					workspaces = append(workspaces, path)
				}
			}
		}
	}

	// go.workファイルにワークスペースが指定されていない場合は、
	// プロジェクト内のディレクトリを検索
	if len(workspaces) == 0 {
		entries, err := ioutil.ReadDir(".")
		if err != nil {
			return nil, err
		}

		for _, entry := range entries {
			if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") && !strings.HasPrefix(entry.Name(), "_") {
				// 一般的なGoプロジェクトのディレクトリ構造をチェック
				if entry.Name() == "cmd" || entry.Name() == "pkg" || entry.Name() == "internal" {
					workspaces = append(workspaces, entry.Name())
				}
			}
		}
	}

	return workspaces, nil
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
