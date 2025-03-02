// check-ci コマンドは GitHub Actions の CI 実行結果を確認します
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

// RunListItem は GitHub Actions の実行情報を表す構造体です
type RunListItem struct {
	DatabaseID int `json:"databaseId"`
}

// CheckLatestCI は最新の CI 実行を取得して表示します
func CheckLatestCI() error {
	// gh コマンドが利用可能か確認
	_, err := exec.LookPath("gh")
	if err != nil {
		return fmt.Errorf("GitHub CLI (gh) がインストールされていません: %w", err)
	}

	// 最新の CI 実行を取得
	cmd := exec.Command("gh", "run", "list", "--json", "databaseId", "--limit", "1")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("CI 実行の取得に失敗しました: %w", err)
	}

	// JSON をパース
	var runs []RunListItem
	if err := json.Unmarshal(output, &runs); err != nil {
		return fmt.Errorf("JSON のパースに失敗しました: %w", err)
	}

	// CI 実行が見つからない場合
	if len(runs) == 0 {
		fmt.Println("❌ CI 実行が見つかりません")
		return nil
	}

	// CI 実行の詳細を表示
	runID := runs[0].DatabaseID
	viewCmd := exec.Command("gh", "run", "view", fmt.Sprintf("%d", runID), "--exit-status")
	
	// コマンドの標準出力と標準エラー出力を現在のプロセスにリダイレクト
	viewCmd.Stdout = os.Stdout
	viewCmd.Stderr = os.Stderr
	
	// コマンドを実行
	err = viewCmd.Run()
	if err != nil {
		// CI が失敗している場合、失敗したジョブのログを表示
		fmt.Println("---- CI Log ----")
		logCmd := exec.Command("gh", "run", "view", fmt.Sprintf("%d", runID), "--log-failed")
		logCmd.Stdout = os.Stdout
		logCmd.Stderr = os.Stderr
		_ = logCmd.Run() // エラーは無視
	}

	return nil
}

func main() {
	if err := CheckLatestCI(); err != nil {
		fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
		os.Exit(1)
	}
}