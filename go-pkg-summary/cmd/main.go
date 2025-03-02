// go-pkg-summary はGoパッケージの型定義、関数、構造体などを解析し、サマリーを生成するコマンドラインツールです
package main

import (
	"com.github/kazukimatsumoto/ailab-go/go-pkg-summary/internal"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var (
	// フラグ変数
	noCache    bool
	outputFile string
	debug      bool
	include    []string
	dryRun     bool
	autoSearch bool
)

// rootCmd はルートコマンドです
var rootCmd = &cobra.Command{
	Use:   "go-pkg-summary [package-path][@version]",
	Short: "Goパッケージの型定義、関数、構造体などを解析し、サマリーを生成するツール",
	Long: `go-pkg-summary はGoパッケージの型定義、関数、構造体などを解析し、サマリーを生成するコマンドラインツールです。
パッケージパスとオプションのバージョンを指定して実行します。
完全なインポートパス（例: go.uber.org/zap）を指定するか、--auto-search フラグを使用して短い名前（例: zap）から検索できます。`,
	Args: cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		// パッケージパスとバージョンを解析
		packagePath, version := parsePackageArg(args[0])

		// 自動検索が有効で、パッケージパスにスラッシュが含まれていない場合は検索を行う
		if autoSearch && !strings.Contains(packagePath, "/") {
			// Fetcherを作成
			f, err := internal.NewFetcher(debug)
			if err != nil {
				fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
				os.Exit(1)
			}

			// パッケージを検索
			results, err := f.SearchPackage(packagePath, 1)
			if err != nil {
				fmt.Fprintf(os.Stderr, "パッケージの検索に失敗しました: %v\n", err)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			if len(results) == 0 {
				fmt.Fprintf(os.Stderr, "パッケージ '%s' が見つかりませんでした。\n", packagePath)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			// 最初の検索結果を使用
			packagePath = results[0].ImportPath
			fmt.Printf("パッケージ '%s' を '%s' として解決しました。\n", args[0], packagePath)
		}

		// オプションを設定
		opts := internal.GetPackageOptions{
			UseCache:   !noCache,
			OutputFile: outputFile,
			Include:    include,
			DryRun:     dryRun,
		}

		// Fetcherを作成
		f, err := internal.NewFetcher(debug)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// パッケージ情報を取得
		content, err := f.GetPackage(packagePath, version, opts)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// 結果を出力
		if outputFile != "" {
			err := os.WriteFile(outputFile, []byte(content), 0644)
			if err != nil {
				fmt.Fprintf(os.Stderr, "ファイルの書き込みに失敗しました: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("結果を %s に保存しました\n", outputFile)
		} else {
			fmt.Println(content)
		}
	},
}

// lsCmd はファイル一覧を表示するコマンドです
var lsCmd = &cobra.Command{
	Use:   "ls [package-path][@version]",
	Short: "パッケージ内のファイル一覧を表示",
	Long:  `パッケージ内のファイル一覧を表示します。`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		// パッケージパスとバージョンを解析
		packagePath, version := parsePackageArg(args[0])

		// 自動検索が有効で、パッケージパスにスラッシュが含まれていない場合は検索を行う
		if autoSearch && !strings.Contains(packagePath, "/") {
			// Fetcherを作成
			f, err := internal.NewFetcher(debug)
			if err != nil {
				fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
				os.Exit(1)
			}

			// パッケージを検索
			results, err := f.SearchPackage(packagePath, 1)
			if err != nil {
				fmt.Fprintf(os.Stderr, "パッケージの検索に失敗しました: %v\n", err)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			if len(results) == 0 {
				fmt.Fprintf(os.Stderr, "パッケージ '%s' が見つかりませんでした。\n", packagePath)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			// 最初の検索結果を使用
			packagePath = results[0].ImportPath
			fmt.Printf("パッケージ '%s' を '%s' として解決しました。\n", args[0], packagePath)
		}

		// Fetcherを作成
		f, err := internal.NewFetcher(debug)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// ファイル一覧を取得
		files, err := f.ListPackageFiles(packagePath, version)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// 結果を出力
		if outputFile != "" {
			content := strings.Join(files, "\n")
			err := os.WriteFile(outputFile, []byte(content), 0644)
			if err != nil {
				fmt.Fprintf(os.Stderr, "ファイルの書き込みに失敗しました: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("結果を %s に保存しました\n", outputFile)
		} else {
			for _, file := range files {
				fmt.Println(file)
			}
		}
	},
}

// readCmd は特定のファイルを表示するコマンドです
var readCmd = &cobra.Command{
	Use:   "read [package-path][@version]/[file-path]",
	Short: "パッケージ内の特定ファイルを表示",
	Long:  `パッケージ内の特定ファイルを表示します。`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		// 引数を解析
		arg := args[0]
		slashIndex := strings.LastIndex(arg, "/")
		if slashIndex == -1 {
			fmt.Fprintf(os.Stderr, "エラー: 無効な形式です。[package-path][@version]/[file-path] の形式で指定してください\n")
			os.Exit(1)
		}

		// パッケージパスとバージョンを解析
		packageArg := arg[:slashIndex]
		filePath := arg[slashIndex+1:]
		packagePath, version := parsePackageArg(packageArg)

		// 自動検索が有効で、パッケージパスにスラッシュが含まれていない場合は検索を行う
		if autoSearch && !strings.Contains(packagePath, "/") {
			// Fetcherを作成
			f, err := internal.NewFetcher(debug)
			if err != nil {
				fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
				os.Exit(1)
			}

			// パッケージを検索
			results, err := f.SearchPackage(packagePath, 1)
			if err != nil {
				fmt.Fprintf(os.Stderr, "パッケージの検索に失敗しました: %v\n", err)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			if len(results) == 0 {
				fmt.Fprintf(os.Stderr, "パッケージ '%s' が見つかりませんでした。\n", packagePath)
				fmt.Fprintf(os.Stderr, "完全なインポートパスを指定してください。\n")
				os.Exit(1)
			}

			// 最初の検索結果を使用
			packagePath = results[0].ImportPath
			fmt.Printf("パッケージ '%s' を '%s' として解決しました。\n", packageArg, packagePath)
		}

		// Fetcherを作成
		f, err := internal.NewFetcher(debug)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// ファイルを取得
		content, err := f.ReadPackageFile(packagePath, version, filePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
			os.Exit(1)
		}

		// 結果を出力
		if outputFile != "" {
			err := os.WriteFile(outputFile, []byte(content), 0644)
			if err != nil {
				fmt.Fprintf(os.Stderr, "ファイルの書き込みに失敗しました: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("結果を %s に保存しました\n", outputFile)
		} else {
			fmt.Println(content)
		}
	},
}

// parsePackageArg はパッケージ引数を解析してパッケージパスとバージョンを返します
func parsePackageArg(arg string) (string, string) {
	// デフォルトバージョン
	version := "latest"

	// @でバージョンを分離
	parts := strings.Split(arg, "@")
	packagePath := parts[0]

	// バージョンが指定されている場合
	if len(parts) > 1 {
		version = parts[1]
	}

	return packagePath, version
}

func init() {
	// フラグを設定
	rootCmd.PersistentFlags().BoolVar(&noCache, "no-cache", false, "キャッシュを使用しない")
	rootCmd.PersistentFlags().StringVarP(&outputFile, "out", "o", "", "出力ファイル")
	rootCmd.PersistentFlags().BoolVar(&debug, "debug", false, "デバッグモード")
	rootCmd.PersistentFlags().StringSliceVar(&include, "include", nil, "含めるファイルパターン")
	rootCmd.PersistentFlags().BoolVar(&dryRun, "dry", false, "ドライラン")
	rootCmd.PersistentFlags().BoolVar(&autoSearch, "auto-search", true, "短いパッケージ名を自動的に検索して解決する")

	// サブコマンドを追加
	rootCmd.AddCommand(lsCmd)
	rootCmd.AddCommand(readCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "エラー: %v\n", err)
		os.Exit(1)
	}
}
