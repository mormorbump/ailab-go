// Package fetch はパッケージ情報の取得機能を提供します
package internal

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Scraper はpkg.go.devからパッケージ情報を取得するスクレイパーです
type Scraper struct {
	client *http.Client
	debug  bool
}

// NewScraper は新しいスクレイパーインスタンスを作成します
func NewScraper(debug bool) *Scraper {
	return &Scraper{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		debug: debug,
	}
}

// SearchPackage はpkg.go.devでパッケージを検索します
func (s *Scraper) SearchPackage(query string, limit int) ([]Package, error) {
	// 検索 URL を構築
	baseURL := "https://pkg.go.dev/search"
	params := url.Values{}
	params.Add("q", query)

	searchURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	if s.debug {
		fmt.Printf("検索 URL: %s\n", searchURL)
	}

	// HTTP リクエストを作成
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	if s.debug {
		fmt.Println("リクエストヘッダー:")
		for key, values := range req.Header {
			fmt.Printf("  %s: %s\n", key, strings.Join(values, ", "))
		}
	}

	// リクエストを実行
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	if s.debug {
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
	var results []Package

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
		pkg := Package{
			Name:       name,
			ImportPath: importPath,
			Synopsis:   synopsis,
			DocURL:     fmt.Sprintf("https://pkg.go.dev/%s", importPath),
		}

		results = append(results, pkg)
	})

	if s.debug {
		fmt.Printf("検索結果: %d 件\n", len(results))
	}

	return results, nil
}

// GetPackageInfo はパッケージの詳細情報を取得します
func (s *Scraper) GetPackageInfo(importPath string, version string) (*Package, error) {
	// パッケージURLを構築
	var pkgURL string
	if version != "" && version != "latest" {
		pkgURL = fmt.Sprintf("https://pkg.go.dev/%s@%s", importPath, version)
	} else {
		pkgURL = fmt.Sprintf("https://pkg.go.dev/%s", importPath)
	}

	if s.debug {
		fmt.Printf("パッケージ URL: %s\n", pkgURL)
	}

	// HTTP リクエストを作成
	req, err := http.NewRequest("GET", pkgURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	if s.debug {
		fmt.Println("リクエストヘッダー:")
		for key, values := range req.Header {
			fmt.Printf("  %s: %s\n", key, strings.Join(values, ", "))
		}
	}

	// リクエストを実行
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	if s.debug {
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

	// パッケージ情報を抽出
	pkg := &Package{
		ImportPath: importPath,
		DocURL:     pkgURL,
	}

	// パッケージ名
	pkg.Name = strings.TrimSpace(doc.Find("h1.go-Main-title").Text())
	if pkg.Name == "" {
		// 新しいセレクタを試す
		pkg.Name = strings.TrimSpace(doc.Find("h1").First().Text())
	}

	// バージョン
	versionText := doc.Find(".go-Main-headerDetails").Text()
	if strings.Contains(versionText, "v") {
		vParts := strings.Split(versionText, "v")
		if len(vParts) > 1 {
			// 改行や空白を削除
			version := strings.TrimSpace(vParts[1])
			// 最初の単語だけを取得（余分なテキストを除去）
			if spaceIndex := strings.Index(version, " "); spaceIndex > 0 {
				version = version[:spaceIndex]
			}
			if newlineIndex := strings.Index(version, "\n"); newlineIndex > 0 {
				version = version[:newlineIndex]
			}
			pkg.Version = version
		}
	}

	// 概要
	pkg.Synopsis = strings.TrimSpace(doc.Find(".Documentation-overview").Text())
	if pkg.Synopsis == "" {
		// 新しいセレクタを試す
		pkg.Synopsis = strings.TrimSpace(doc.Find("div.Documentation-content > p").First().Text())
	}
	// 改行を削除
	pkg.Synopsis = strings.ReplaceAll(pkg.Synopsis, "\n", " ")

	// リポジトリURL
	doc.Find("a").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if exists && (strings.Contains(href, "github.com") || strings.Contains(href, "gitlab.com")) {
			pkg.RepoURL = href
		}
	})

	if s.debug {
		fmt.Printf("パッケージ情報: %+v\n", pkg)
	}

	return pkg, nil
}
