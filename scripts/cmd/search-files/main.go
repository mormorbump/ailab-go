// search-files コマンドは ripgrep または grep を使って検索し、マッチしたファイル名だけを表示します
package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// コマンドが存在するか確認する
func commandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// SearchFiles は指定されたパターンでファイルを検索します
func SearchFiles(pattern string, path string, options []string) ([]string, error) {
	// ripgrep が存在するか確認
	useRipgrep := commandExists("rg")

	var cmd *exec.Cmd
	if useRipgrep {
		// ripgrep コマンドを使用
		args := []string{"-l", pattern, path}
		args = append(args, options...)
		cmd = exec.Command("rg", args...)
	} else {
		// grep コマンドを使用
		args := []string{"-l", "-r", pattern, path}
		args = append(args, options...)
		cmd = exec.Command("grep", args...)
	}

	output, err := cmd.Output()
	if err != nil {
		// コマンドが失敗した場合（マッチするファイルがない場合も含む）
		if exitErr, ok := err.(*exec.ExitError); ok {
			fmt.Fprintf(os.Stderr, "検索エラー: %s\n", string(exitErr.Stderr))
		} else {
			fmt.Fprintf(os.Stderr, "検索エラー: %s\n", err.Error())
		}
		return []string{}, nil
	}

	// 出力を行ごとに分割して返す
	files := strings.Split(strings.TrimSpace(string(output)), "\n")
	result := []string{}
	for _, file := range files {
		if file != "" {
			result = append(result, file)
		}
	}
	return result, nil
}

func main() {
	// コマンドライン引数を解析
	args := os.Args[1:]
	if len(args) < 1 {
		fmt.Println("使用法: search-files <検索パターン> [検索パス] [追加オプション...]")
		os.Exit(1)
	}

	pattern := args[0]
	path := "."
	options := []string{}

	if len(args) > 1 {
		path = args[1]
	}

	if len(args) > 2 {
		options = args[2:]
	}

	// 使用するコマンドを表示
	if commandExists("rg") {
		fmt.Println("ripgrep (rg) を使用して検索します")
	} else {
		fmt.Println("grep を使用して検索します")
	}

	fmt.Printf("\"%s\" を %s で検索中...\n", pattern, path)
	files, err := SearchFiles(pattern, path, options)
	if err != nil {
		fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
		os.Exit(1)
	}

	if len(files) == 0 {
		fmt.Println("マッチするファイルが見つかりませんでした。")
	} else {
		fmt.Println("\n--- マッチしたファイル ---")
		for _, file := range files {
			fmt.Println(file)
		}
		fmt.Printf("\n合計: %d件のファイルが見つかりました。\n", len(files))
	}
}
