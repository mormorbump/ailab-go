// gh-search コマンドは GitHub リポジトリをクローンして検索するスクリプトです
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// RepoInfo はリポジトリ情報を表す構造体です
type RepoInfo struct {
	Owner  string
	Repo   string
	Branch string
	Dir    string
}

// RepoReference はリポジトリの参照情報を表す構造体です
type RepoReference struct {
	Path         string    `json:"path"`
	LastAccessed time.Time `json:"lastAccessed"`
}

// デフォルトのクローンディレクトリ
var defaultCloneDir string

func init() {
	// ホームディレクトリを取得
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ホームディレクトリの取得に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}
	defaultCloneDir = filepath.Join(homeDir, ".tmpsrc")
}

// GitHub URL からリポジトリ情報を抽出
func parseRepoURL(url string) RepoInfo {
	if strings.HasPrefix(url, "https") {
		u := strings.TrimSuffix(url, "/")
		parts := strings.Split(u, "/")
		if len(parts) < 5 {
			return RepoInfo{
				Owner:  parts[3],
				Repo:   parts[4],
				Branch: "main",
				Dir:    "",
			}
		}

		// tree/branch/path 形式の URL の場合
		if len(parts) > 6 && parts[5] == "tree" {
			return RepoInfo{
				Owner:  parts[3],
				Repo:   parts[4],
				Branch: parts[6],
				Dir:    strings.Join(parts[7:], "/"),
			}
		}

		return RepoInfo{
			Owner:  parts[3],
			Repo:   parts[4],
			Branch: "main",
			Dir:    "",
		}
	}

	if strings.HasPrefix(url, "git@") {
		parts := strings.Split(url, ":")
		if len(parts) < 2 {
			return RepoInfo{}
		}

		repoParts := strings.Split(parts[1], "/")
		return RepoInfo{
			Owner:  repoParts[0],
			Repo:   strings.TrimSuffix(repoParts[1], ".git"),
			Branch: "main",
			Dir:    "",
		}
	}

	// owner/repo 形式
	parts := strings.Split(url, "/")
	if len(parts) < 2 {
		return RepoInfo{}
	}

	return RepoInfo{
		Owner:  parts[0],
		Repo:   parts[1],
		Branch: "main",
		Dir:    strings.Join(parts[2:], "/"),
	}
}

// ファイルやディレクトリが存在するか確認
func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ディレクトリが存在することを確認し、存在しなければ作成
func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// リポジトリの参照情報ファイルのパス
func getReferencesFilePath() string {
	return filepath.Join(defaultCloneDir, ".references.json")
}

// リポジトリの参照情報を読み込む
func loadReferences() (map[string]RepoReference, error) {
	path := getReferencesFilePath()
	references := make(map[string]RepoReference)

	if exists(path) {
		data, err := ioutil.ReadFile(path)
		if err != nil {
			return references, fmt.Errorf("参照情報の読み込みに失敗しました: %w", err)
		}

		if err := json.Unmarshal(data, &references); err != nil {
			return references, fmt.Errorf("参照情報の解析に失敗しました: %w", err)
		}
	}

	return references, nil
}

// リポジトリの参照情報を保存する
func saveReferences(references map[string]RepoReference) error {
	path := getReferencesFilePath()
	if err := ensureDir(filepath.Dir(path)); err != nil {
		return fmt.Errorf("ディレクトリの作成に失敗しました: %w", err)
	}

	data, err := json.MarshalIndent(references, "", "  ")
	if err != nil {
		return fmt.Errorf("参照情報のエンコードに失敗しました: %w", err)
	}

	if err := ioutil.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("参照情報の保存に失敗しました: %w", err)
	}

	return nil
}

// リポジトリの参照情報を更新する
func updateReferences(repoKey string, cloneDir string) error {
	references, err := loadReferences()
	if err != nil {
		return err
	}

	references[repoKey] = RepoReference{
		Path:         cloneDir,
		LastAccessed: time.Now(),
	}

	return saveReferences(references)
}

// 3日以上前のリポジトリを掃除する
func vacuumOldRepositories() error {
	fmt.Println("古いリポジトリを掃除しています...")
	references, err := loadReferences()
	if err != nil {
		return err
	}

	now := time.Now()
	threeDaysInMs := 3 * 24 * 60 * 60 * 1000 * time.Millisecond
	removedCount := 0

	for repoKey, reference := range references {
		ageInMs := now.Sub(reference.LastAccessed)
		if ageInMs > threeDaysInMs {
			if exists(reference.Path) {
				if err := os.RemoveAll(reference.Path); err != nil {
					fmt.Fprintf(os.Stderr, "リポジトリの削除に失敗しました: %s %s\n", repoKey, err.Error())
					continue
				}
				fmt.Printf("古いリポジトリを削除しました: %s (最終アクセス: %s)\n", repoKey, reference.LastAccessed.Format("2006-01-02 15:04:05"))
				removedCount++
			}
			delete(references, repoKey)
		}
	}

	if err := saveReferences(references); err != nil {
		return err
	}

	fmt.Printf("掃除完了: %d個のリポジトリを削除しました\n", removedCount)
	return nil
}

// リポジトリを準備する共通処理
func prepareRepository(repoURL, branch string, temp bool) (string, string, string, bool, bool, func() error, error) {
	info := parseRepoURL(repoURL)
	repoKey := fmt.Sprintf("%s/%s/%s", info.Owner, info.Repo, branch)
	if branch == "" {
		repoKey = fmt.Sprintf("%s/%s/%s", info.Owner, info.Repo, info.Branch)
	}

	// クローン先ディレクトリの決定
	var cloneDir string
	var useExisting bool
	var skipFetch bool

	if temp {
		// 一時ディレクトリを作成
		var err error
		cloneDir, err = ioutil.TempDir("", "gh-search-")
		if err != nil {
			return "", "", "", false, false, nil, fmt.Errorf("一時ディレクトリの作成に失敗しました: %w", err)
		}
		fmt.Printf("一時ディレクトリにクローン: %s\n", cloneDir)
	} else {
		// デフォルトは ~/.tmpsrc/owner-repo-branch
		branchToUse := branch
		if branchToUse == "" {
			branchToUse = info.Branch
		}
		dirName := fmt.Sprintf("%s-%s-%s", info.Owner, info.Repo, branchToUse)
		cloneDir = filepath.Join(defaultCloneDir, dirName)

		// ディレクトリが既に存在するか確認
		if exists(cloneDir) {
			useExisting = true

			// 参照情報を確認して、最後のアクセス時刻をチェック
			references, err := loadReferences()
			if err != nil {
				return "", "", "", false, false, nil, err
			}

			reference, ok := references[repoKey]
			if ok {
				lastAccessed := reference.LastAccessed
				now := time.Now()
				oneHourInMs := time.Hour
				ageInMs := now.Sub(lastAccessed)

				// 1時間以内にアクセスがあれば、fetchをスキップ
				if ageInMs < oneHourInMs {
					fmt.Printf("最近（%d分前）にアクセスしたリポジトリです。fetchをスキップします。\n", int(ageInMs.Minutes()))
					skipFetch = true
				} else {
					fmt.Printf("既存のクローンを使用（最終アクセス: %s）: %s\n", lastAccessed.Format("2006-01-02 15:04:05"), cloneDir)
				}
			} else {
				fmt.Printf("既存のクローンを使用: %s\n", cloneDir)
			}
		} else {
			if err := ensureDir(filepath.Dir(cloneDir)); err != nil {
				return "", "", "", false, false, nil, err
			}
			fmt.Printf("クローン先: %s\n", cloneDir)
		}
	}

	// クリーンアップ関数を定義
	cleanup := func() error {
		if temp {
			return os.RemoveAll(cloneDir)
		}
		return nil
	}

	// ディレクトリが指定されていれば、そのディレクトリのみ検索
	searchDir := cloneDir
	if info.Dir != "" {
		searchDir = filepath.Join(cloneDir, info.Dir)
	}

	return cloneDir, searchDir, repoKey, useExisting, skipFetch, cleanup, nil
}

// ファイル一覧を表示する（git ls-files を使用）
func listFiles(searchDir, glob string) error {
	var cmd *exec.Cmd

	// git ls-files でファイル一覧を取得
	if glob != "" {
		// グロブパターンがある場合はパイプでgrepを使用
		pattern := strings.Replace(glob, "*", ".*", -1)
		pattern = strings.Replace(pattern, "?", ".", -1)

		// ファイルが存在するかチェック
		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git ls-files | grep -q -E \"%s\"", searchDir, pattern))
		if err := cmd.Run(); err != nil {
			fmt.Printf("パターン \"%s\" に一致するファイルはありませんでした。\n", glob)
			return nil
		}

		// ファイルが存在する場合は表示
		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git ls-files | grep -E \"%s\"", searchDir, pattern))
	} else {
		// グロブパターンがない場合はそのまま表示
		// ファイル数をカウントして判定
		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git ls-files | wc -l", searchDir))
		output, err := cmd.Output()
		if err != nil {
			return fmt.Errorf("ファイル数の取得に失敗しました: %w", err)
		}

		count := strings.TrimSpace(string(output))
		if count == "0" {
			fmt.Println("リポジトリにファイルが見つかりません。")
			return nil
		}

		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git ls-files", searchDir))
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ファイル内を検索する
func searchFiles(searchDir, pattern, glob string, ignoreCase, smartCase, wordRegexp bool, maxCount, context int, filesOnly, linesMode bool) error {
	// ripgrep コマンドの存在確認
	_, err := exec.LookPath("rg")
	hasRg := err == nil

	var cmd *exec.Cmd
	var args []string

	if hasRg {
		// ripgrep コマンドオプションの構築
		args = []string{"-c", fmt.Sprintf("cd %s && rg", searchDir)}

		// オプションによる表示モードの決定
		if filesOnly && !linesMode {
			// ファイル名のみ表示モード
			args[1] += " --files-with-matches"
		} else {
			// 通常の検索時の設定またはlinesMode
			// オプションの追加
			if maxCount > 0 {
				args[1] += fmt.Sprintf(" --max-count %d", maxCount)
			}

			if context > 0 && !linesMode {
				args[1] += fmt.Sprintf(" --context %d", context)
			}

			// 行番号表示（通常モードまたはlinesModeの場合）
			args[1] += " --line-number"
		}

		if ignoreCase {
			args[1] += " --ignore-case"
		}

		if smartCase {
			args[1] += " --smart-case"
		}

		if wordRegexp {
			args[1] += " --word-regexp"
		}

		// globパターンがあれば追加
		if glob != "" {
			args[1] += fmt.Sprintf(" --glob \"%s\"", glob)
		}

		// 検索パターンを追加
		args[1] += fmt.Sprintf(" \"%s\"", pattern)

		// 検索の実行
		// まず検索結果があるかチェック
		checkCmd := exec.Command("sh", "-c", fmt.Sprintf("cd %s && rg --quiet \"%s\"", searchDir, pattern))
		if err := checkCmd.Run(); err != nil {
			fmt.Printf("パターン \"%s\" に一致する結果は見つかりませんでした。\n", pattern)
			return nil
		}

		cmd = exec.Command("sh", args...)
	} else {
		// ripgrep がなければ grep を使用
		fmt.Println("ripgrep (rg) が見つからないため grep を使用します")

		args = []string{"-c", fmt.Sprintf("cd %s && grep", searchDir)}

		if ignoreCase {
			args[1] += " -i"
		}

		// --files オプションが指定されている場合はファイル名のみ表示（grepの場合は-l）
		if filesOnly {
			args[1] += " -l"
		} else {
			// 通常の検索時の設定
			if context > 0 {
				args[1] += fmt.Sprintf(" -C %d", context)
			}

			// 行番号を表示（ファイル名のみモードでない場合）
			args[1] += " -n"
		}

		// 再帰的に検索
		args[1] += " -r"

		// globパターンによるファイル絞り込み（簡易的な実装）
		if glob != "" {
			args[1] += fmt.Sprintf(" --include=\"%s\"", glob)
		}

		// 検索パターンを追加
		args[1] += fmt.Sprintf(" \"%s\" .", pattern)

		// 検索の実行
		// まず検索結果があるかチェック
		checkCmd := exec.Command("sh", "-c", fmt.Sprintf("cd %s && grep -q -r \"%s\" .", searchDir, pattern))
		if err := checkCmd.Run(); err != nil {
			fmt.Printf("パターン \"%s\" に一致する結果は見つかりませんでした。\n", pattern)
			return nil
		}

		cmd = exec.Command("sh", args...)
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ファイル一覧を表示するコマンド
func runFilesCommand(repoURL, branch, glob string, temp bool) error {
	cloneDir, searchDir, repoKey, useExisting, skipFetch, cleanup, err := prepareRepository(repoURL, branch, temp)
	if err != nil {
		return err
	}
	defer cleanup()

	// リポジトリ準備
	if !useExisting {
		// 新しくクローン
		fmt.Printf("リポジトリをクローン中: %s\n", repoURL)
		info := parseRepoURL(repoURL)
		branchToUse := branch
		if branchToUse == "" {
			branchToUse = info.Branch
		}

		cmd := exec.Command("git", "clone", fmt.Sprintf("https://github.com/%s/%s", info.Owner, info.Repo), cloneDir, "--depth", "1", "--branch", branchToUse)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリのクローンに失敗しました: %w", err)
		}
	} else if !skipFetch {
		// 既存のリポジトリを更新（1時間以内のアクセスでなければ）
		fmt.Println("リポジトリを最新の状態に更新中...")

		cmd := exec.Command("sh", "-c", fmt.Sprintf("cd %s && git fetch --depth 1", cloneDir))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリの更新に失敗しました: %w", err)
		}

		info := parseRepoURL(repoURL)
		branchToUse := branch
		if branchToUse == "" {
			branchToUse = info.Branch
		}

		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git reset --hard origin/%s", cloneDir, branchToUse))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリのリセットに失敗しました: %w", err)
		}
	}

	// 参照情報を更新（一時ディレクトリでない場合のみ）
	if !temp {
		if err := updateReferences(repoKey, cloneDir); err != nil {
			return err
		}
	}

	fmt.Println("ファイル一覧を表示します...")
	return listFiles(searchDir, glob)
}

// 検索を実行するコマンド
func runSearchCommand(repoURL, pattern, branch, glob string, ignoreCase, smartCase, wordRegexp, filesOnly, linesMode bool, maxCount, context int, temp, vacuum bool) error {
	// vacuumオプションが指定されていれば古いリポジトリを掃除する
	if vacuum {
		if err := vacuumOldRepositories(); err != nil {
			return err
		}
	}

	// パターンが必要
	if pattern == "" {
		return fmt.Errorf("エラー: 検索パターンが必要です")
	}

	cloneDir, searchDir, repoKey, useExisting, skipFetch, cleanup, err := prepareRepository(repoURL, branch, temp)
	if err != nil {
		return err
	}
	defer cleanup()

	// リポジトリ準備
	if !useExisting {
		// 新しくクローン
		fmt.Printf("リポジトリをクローン中: %s\n", repoURL)
		info := parseRepoURL(repoURL)
		branchToUse := branch
		if branchToUse == "" {
			branchToUse = info.Branch
		}

		cmd := exec.Command("git", "clone", fmt.Sprintf("https://github.com/%s/%s", info.Owner, info.Repo), cloneDir, "--depth", "1", "--branch", branchToUse)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリのクローンに失敗しました: %w", err)
		}
	} else if !skipFetch {
		// 既存のリポジトリを更新（1時間以内のアクセスでなければ）
		fmt.Println("リポジトリを最新の状態に更新中...")

		cmd := exec.Command("sh", "-c", fmt.Sprintf("cd %s && git fetch --depth 1", cloneDir))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリの更新に失敗しました: %w", err)
		}

		info := parseRepoURL(repoURL)
		branchToUse := branch
		if branchToUse == "" {
			branchToUse = info.Branch
		}

		cmd = exec.Command("sh", "-c", fmt.Sprintf("cd %s && git reset --hard origin/%s", cloneDir, branchToUse))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("リポジトリのリセットに失敗しました: %w", err)
		}
	}

	// 参照情報を更新（一時ディレクトリでない場合のみ）
	if !temp {
		if err := updateReferences(repoKey, cloneDir); err != nil {
			return err
		}
	}

	fmt.Printf("パターン \"%s\" で検索中...\n", pattern)
	return searchFiles(searchDir, pattern, glob, ignoreCase, smartCase, wordRegexp, maxCount, context, filesOnly, linesMode)
}

// vacuum のみを実行
func runVacuum() error {
	return vacuumOldRepositories()
}

func main() {
	// コマンドライン引数を解析
	if len(os.Args) < 2 {
		fmt.Println("使用法:")
		fmt.Println("  gh-search <github-url> <search-pattern> [options]")
		fmt.Println("  gh-search <github-url> --list-files [options]")
		fmt.Println("  gh-search vacuum")
		fmt.Println("")
		fmt.Println("例:")
		fmt.Println("  gh-search github/Spoon-Knife \"README\"")
		fmt.Println("  gh-search https://github.com/golang/go \"fmt.Println\" --glob=\"*.go\"")
		fmt.Println("  gh-search golang/go --list-files --glob=\"*.md\" --branch=master")
		fmt.Println("  gh-search golang/go \"func\" --files  # ファイル名のみ表示")
		fmt.Println("")
		fmt.Println("オプション:")
		fmt.Println("  --list-files, -l     ファイル一覧を表示")
		fmt.Println("  --branch, -b         ブランチを指定 (デフォルト: main)")
		fmt.Println("  --temp, -t           一時ディレクトリを使用")
		fmt.Println("  --glob, -g           ファイルパターン (例: \"*.go\")")
		fmt.Println("  --files, -f          ファイル名のみ表示")
		fmt.Println("  --lines, -L          行番号付きで表示")
		fmt.Println("  --max-count, -m      ファイルごとの最大マッチ数")
		fmt.Println("  --context, -C        マッチの前後の行数")
		fmt.Println("  --ignore-case, -i    大文字小文字を区別しない")
		fmt.Println("  --smart-case, -S     スマートケース検索")
		fmt.Println("  --word-regexp, -w    単語境界で検索")
		fmt.Println("  --vacuum, -v         古いリポジトリを掃除")
		os.Exit(1)
	}

	// vacuum コマンドの処理
	if os.Args[1] == "vacuum" {
		if err := runVacuum(); err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
			os.Exit(1)
		}
		os.Exit(0)
	}

	// 引数が足りない場合
	if len(os.Args) < 3 {
		fmt.Println("エラー: GitHub URL と検索パターンまたは --list-files オプションが必要です")
		os.Exit(1)
	}

	// 基本パラメータ
	repoURL := os.Args[1]
	var pattern string
	var listFiles bool
	var branch string
	var temp bool
	var glob string
	var filesOnly bool
	var linesMode bool
	var maxCount int
	var context int
	var ignoreCase bool
	var smartCase bool
	var wordRegexp bool
	var vacuum bool

	// 第2引数が --list-files または -l の場合
	if os.Args[2] == "--list-files" || os.Args[2] == "-l" {
		listFiles = true
		// 残りの引数を解析
		for i := 3; i < len(os.Args); i++ {
			arg := os.Args[i]
			if arg == "--branch" || arg == "-b" {
				if i+1 < len(os.Args) {
					branch = os.Args[i+1]
					i++
				}
			} else if arg == "--temp" || arg == "-t" {
				temp = true
			} else if arg == "--glob" || arg == "-g" {
				if i+1 < len(os.Args) {
					glob = os.Args[i+1]
					i++
				}
			} else if arg == "--vacuum" || arg == "-v" {
				vacuum = true
			}
		}
	} else {
		// 第2引数が検索パターン
		pattern = os.Args[2]
		// 残りの引数を解析
		for i := 3; i < len(os.Args); i++ {
			arg := os.Args[i]
			if arg == "--branch" || arg == "-b" {
				if i+1 < len(os.Args) {
					branch = os.Args[i+1]
					i++
				}
			} else if arg == "--temp" || arg == "-t" {
				temp = true
			} else if arg == "--glob" || arg == "-g" {
				if i+1 < len(os.Args) {
					glob = os.Args[i+1]
					i++
				}
			} else if arg == "--files" || arg == "-f" {
				filesOnly = true
			} else if arg == "--lines" || arg == "-L" {
				linesMode = true
			} else if arg == "--max-count" || arg == "-m" {
				if i+1 < len(os.Args) {
					fmt.Sscanf(os.Args[i+1], "%d", &maxCount)
					i++
				}
			} else if arg == "--context" || arg == "-C" {
				if i+1 < len(os.Args) {
					fmt.Sscanf(os.Args[i+1], "%d", &context)
					i++
				}
			} else if arg == "--ignore-case" || arg == "-i" {
				ignoreCase = true
			} else if arg == "--smart-case" || arg == "-S" {
				smartCase = true
			} else if arg == "--word-regexp" || arg == "-w" {
				wordRegexp = true
			} else if arg == "--vacuum" || arg == "-v" {
				vacuum = true
			}
		}
	}

	var err error
	if listFiles {
		err = runFilesCommand(repoURL, branch, glob, temp)
	} else {
		err = runSearchCommand(repoURL, pattern, branch, glob, ignoreCase, smartCase, wordRegexp, filesOnly, linesMode, maxCount, context, temp, vacuum)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
		os.Exit(1)
	}
}
