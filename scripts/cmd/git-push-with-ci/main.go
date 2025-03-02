// git-push-with-ci コマンドは git push を実行し、GitHub Actions の CI が完了するまで待機します
package main

import (
	"fmt"
	"os"
	"os/exec"
	"time"
)

// RunInfo は GitHub Actions の実行情報を表す構造体です
type RunInfo struct {
	DatabaseID int    `json:"databaseId"`
	Conclusion string `json:"conclusion"`
}

// WaitCIError はエラー情報を表す構造体です
type WaitCIError struct {
	Type    string
	Message string
}

func (e WaitCIError) Error() string {
	return e.Message
}

// PushWithWaitCI は git push を実行し、CI が完了するまで待機します
func PushWithWaitCI(workflowName, branchName string) error {
	// gh コマンドが利用可能か確認
	_, err := exec.LookPath("gh")
	if err != nil {
		return fmt.Errorf("GitHub CLI (gh) がインストールされていません: %w", err)
	}

	// git status を表示
	statusCmd := exec.Command("git", "status", "--porcelain")
	statusOutput, err := statusCmd.Output()
	if err != nil {
		return fmt.Errorf("git status の実行に失敗しました: %w", err)
	}
	fmt.Println(string(statusOutput))

	// 前回の実行 ID を取得
	var prevRunCmd *exec.Cmd
	if workflowName != "" {
		prevRunCmd = exec.Command("gh", "run", "list", "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId", "--workflow", workflowName)
	} else {
		prevRunCmd = exec.Command("gh", "run", "list", "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId")
	}
	prevRunOutput, err := prevRunCmd.Output()
	prevRunID := "<not-found>"
	if err == nil && len(prevRunOutput) > 0 {
		prevRunID = string(prevRunOutput)
	} else {
		fmt.Println("前回の実行が見つかりませんでした。")
	}

	// 現在のブランチ名を取得
	if branchName == "" {
		branchCmd := exec.Command("git", "symbolic-ref", "--short", "HEAD")
		branchOutput, err := branchCmd.Output()
		if err != nil {
			return fmt.Errorf("ブランチ名の取得に失敗しました: %w", err)
		}
		branchName = string(branchOutput)
	}
	branchName = string(branchName)

	// git push を実行
	pushCmd := exec.Command("git", "push", "origin", branchName)
	pushCmd.Stdout = os.Stdout
	pushCmd.Stderr = os.Stderr
	if err := pushCmd.Run(); err != nil {
		return fmt.Errorf("git push の実行に失敗しました: %w", err)
	}

	// CI のトリガーを待機
	fmt.Println("CI のトリガーを待機しています...")
	time.Sleep(5 * time.Second)

	// 新しい実行 ID を取得
	var runID string
	maxRetry := 3
	for i := 0; i < maxRetry; i++ {
		currentRunCmd := exec.Command("gh", "run", "list", "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId")
		currentRunOutput, err := currentRunCmd.Output()
		if err != nil {
			fmt.Printf("実行 ID の取得に失敗しました (リトライ %d/%d): %s\n", i+1, maxRetry, err.Error())
			time.Sleep(5 * time.Second)
			continue
		}

		currentID := string(currentRunOutput)
		if currentID != prevRunID && len(currentID) > 0 {
			runID = currentID
			break
		}

		fmt.Printf("新しい実行が見つかりません (リトライ %d/%d)...\n", i+1, maxRetry)
		time.Sleep(5 * time.Second)
	}

	if runID == "" {
		return &WaitCIError{
			Type:    "workflow_not_found",
			Message: "ワークフロー実行が見つかりませんでした。",
		}
	}

	fmt.Printf("実行 ID: %s の完了を待機しています...\n", runID)

	// gh run watch を実行
	watchCmd := exec.Command("gh", "run", "watch", runID)
	watchCmd.Stdout = os.Stdout
	watchCmd.Stderr = os.Stderr
	if err := watchCmd.Run(); err != nil {
		fmt.Printf("実行の監視中にエラーが発生しました: %s\n", err.Error())
	}

	// 実行結果を取得
	statusCmd = exec.Command("gh", "run", "view", runID, "--json", "conclusion", "--jq", ".conclusion")
	statusOutput, err = statusCmd.Output()
	if err != nil {
		return fmt.Errorf("実行結果の取得に失敗しました: %w", err)
	}

	status := string(statusOutput)
	if status == "success" || status == "\"success\"\n" {
		fmt.Println("CI が成功しました！")
		return nil
	} else {
		fmt.Println("---- CI Log ----")
		logCmd := exec.Command("gh", "run", "view", runID, "--log-failed")
		logCmd.Stdout = os.Stdout
		logCmd.Stderr = os.Stderr
		_ = logCmd.Run() // エラーは無視

		return &WaitCIError{
			Type:    "workflow_failed",
			Message: fmt.Sprintf("ワークフローが失敗しました: %s", status),
		}
	}
}

func main() {
	// コマンドライン引数を解析
	workflowName := ""
	branchName := ""

	for i := 1; i < len(os.Args); i++ {
		arg := os.Args[i]
		if arg == "-w" || arg == "--workflow" {
			if i+1 < len(os.Args) {
				workflowName = os.Args[i+1]
				i++
			}
		} else if arg == "-b" || arg == "--branch" {
			if i+1 < len(os.Args) {
				branchName = os.Args[i+1]
				i++
			}
		}
	}

	// git push を実行し、CI が完了するまで待機
	err := PushWithWaitCI(workflowName, branchName)
	if err != nil {
		if ciErr, ok := err.(*WaitCIError); ok {
			fmt.Fprintf(os.Stderr, "エラー: %s\n", ciErr.Message)
		} else {
			fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
		}
		os.Exit(1)
	}
}
