// search-gopkg コマンドは pkg.go.dev を検索して Go パッケージを検索します
package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// SearchResult は検索結果の各アイテムを表す構造体です
type SearchResult struct {
	Name        string
	ImportPath  string
	Synopsis    string
	Stars       int
	Version     string
	CommitTime  string
	NumImported int
}

// SearchGoPkg は pkg.go.dev を検索します
func SearchGoPkg(query string, limit int, debug bool) ([]SearchResult, error) {
	// 検索 URL を構築
	baseURL := "https://pkg.go.dev/search"
	params := url.Values{}
	params.Add("q", query)

	searchURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	if debug {
		fmt.Printf("検索 URL: %s\n", searchURL)
	}

	// HTTP リクエストを作成
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	if debug {
		fmt.Println("リクエストヘッダー:")
		for key, values := range req.Header {
			fmt.Printf("  %s: %s\n", key, strings.Join(values, ", "))
		}
	}

	// HTTP クライアントを作成
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// リクエストを実行
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	if debug {
		fmt.Println("レスポンスヘッダー:")
		for key, values := range resp.Header {
			fmt.Printf("  %s: %s\n", key, strings.Join(values, ", "))
		}
	}

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// HTML をパース
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("HTML のパースに失敗しました: %w", err)
	}

	// 検索結果を抽出
	var results []SearchResult

	// 検索結果の各アイテムを処理
	doc.Find(".SearchSnippet").Each(func(i int, s *goquery.Selection) {
		// 最大件数に達したら処理を終了
		if limit > 0 && i >= limit {
			return
		}

		// インポートパス（括弧内のテキストを抽出）
		headerText := s.Find(".SearchSnippet-headerContainer").Text()
		importPath := ""
		if start := strings.Index(headerText, "("); start != -1 {
			if end := strings.Index(headerText[start:], ")"); end != -1 {
				importPath = strings.TrimSpace(headerText[start+1 : start+end])
			}
		}

		// パッケージ名（インポートパスの最後の部分）
		name := ""
		if importPath != "" {
			parts := strings.Split(importPath, "/")
			name = parts[len(parts)-1]
		}

		// 概要
		synopsis := strings.TrimSpace(s.Find(".SearchSnippet-synopsis").Text())

		// 結果に追加
		result := SearchResult{
			Name:       name,
			ImportPath: importPath,
			Synopsis:   synopsis,
		}

		results = append(results, result)
	})

	if debug {
		fmt.Printf("検索結果: %d 件\n", len(results))
	}

	return results, nil
}

// パッケージの詳細情報を表示する関数
func displayPackageDetails(pkg SearchResult) {
	fmt.Printf("📦 %s\n", pkg.Name)
	fmt.Printf("   インポートパス: %s\n", pkg.ImportPath)
	if pkg.Synopsis != "" {
		fmt.Printf("   概要: %s\n", pkg.Synopsis)
	}
	fmt.Println()
}

func main() {
	// コマンドライン引数を解析
	args := os.Args[1:]
	if len(args) < 1 {
		fmt.Println("使用法: search-gopkg <検索クエリ> [--limit=N] [--debug]")
		fmt.Println("例: search-gopkg zap --limit=5")
		os.Exit(1)
	}

	// 引数を解析
	query := args[0]
	limit := 10
	debug := false

	for i := 1; i < len(args); i++ {
		arg := args[i]
		if strings.HasPrefix(arg, "--limit=") {
			fmt.Sscanf(strings.TrimPrefix(arg, "--limit="), "%d", &limit)
		} else if arg == "--debug" {
			debug = true
		}
	}

	// pkg.go.dev を検索
	results, err := SearchGoPkg(query, limit, debug)
	if err != nil {
		fmt.Fprintf(os.Stderr, "エラー: %s\n", err.Error())
		os.Exit(1)
	}

	// 結果を表示
	if len(results) == 0 {
		fmt.Printf("クエリ '%s' に一致するパッケージは見つかりませんでした。\n", query)
		os.Exit(0)
	}

	fmt.Printf("クエリ '%s' の検索結果 (%d 件):\n\n", query, len(results))
	for _, result := range results {
		displayPackageDetails(result)
	}
}
