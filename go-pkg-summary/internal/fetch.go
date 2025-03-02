// Package fetch はパッケージ情報の取得機能を提供します
package internal

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// Fetcher はパッケージ情報を取得する構造体です
type Fetcher struct {
	scraper *Scraper
	cache   *Cache
	client  *http.Client
	debug   bool
}

// NewFetcher は新しいFetcherインスタンスを作成します
func NewFetcher(debug bool) (*Fetcher, error) {
	c, err := NewCache()
	if err != nil {
		return nil, err
	}

	return &Fetcher{
		scraper: NewScraper(debug),
		cache:   c,
		client: &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		debug: debug,
	}, nil
}

// SearchPackage はpkg.go.devでパッケージを検索します
func (f *Fetcher) SearchPackage(query string, limit int) ([]Package, error) {
	return f.scraper.SearchPackage(query, limit)
}

// GetPackage はパッケージ情報を取得します
func (f *Fetcher) GetPackage(importPath string, version string, opts GetPackageOptions) (string, error) {
	// キャッシュから取得を試みる
	if opts.UseCache {
		content, err := f.cache.GetContentFromCache(importPath, version)
		if err == nil {
			if f.debug {
				fmt.Printf("キャッシュからパッケージ情報を取得しました: %s@%s\n", importPath, version)
			}
			return content, nil
		}
	}

	// パッケージ情報を取得
	pkg, err := f.scraper.GetPackageInfo(importPath, version)
	if err != nil {
		return "", fmt.Errorf("パッケージ情報の取得に失敗しました: %w", err)
	}

	// 実際のバージョンを使用
	actualVersion := pkg.Version
	if actualVersion == "" {
		actualVersion = "latest"
	}

	// 出力を構築
	var output strings.Builder

	// パッケージ情報
	output.WriteString(fmt.Sprintf("# %s\n\n", pkg.Name))
	output.WriteString(fmt.Sprintf("インポートパス: %s\n", pkg.ImportPath))
	if pkg.Version != "" {
		output.WriteString(fmt.Sprintf("バージョン: %s\n", pkg.Version))
	}
	if pkg.Synopsis != "" {
		output.WriteString(fmt.Sprintf("概要: %s\n", pkg.Synopsis))
	}
	output.WriteString(fmt.Sprintf("ドキュメントURL: %s\n", pkg.DocURL))
	if pkg.RepoURL != "" {
		output.WriteString(fmt.Sprintf("リポジトリURL: %s\n", pkg.RepoURL))
	}
	output.WriteString("\n")

	// ファイル一覧を取得
	files, err := f.ListPackageFiles(importPath, actualVersion)
	if err != nil {
		return "", fmt.Errorf("ファイル一覧の取得に失敗しました: %w", err)
	}

	// ファイル一覧を出力
	output.WriteString("## ファイル一覧\n\n")
	for _, file := range files {
		output.WriteString(fmt.Sprintf("- %s\n", file))
	}
	output.WriteString("\n")

	// 主要なファイルの内容を取得
	output.WriteString("## 主要なファイル\n\n")

	// go.mod ファイルを取得
	goModContent, err := f.ReadPackageFile(importPath, actualVersion, "go.mod")
	if err == nil {
		output.WriteString("### go.mod\n\n")
		output.WriteString("```go\n")
		output.WriteString(goModContent)
		output.WriteString("\n```\n\n")
	}

	// README.md ファイルを取得
	readmeContent, err := f.ReadPackageFile(importPath, actualVersion, "README.md")
	if err == nil {
		output.WriteString("### README.md\n\n")
		output.WriteString(readmeContent)
		output.WriteString("\n\n")
	}

	// 結果をキャッシュに保存
	if opts.UseCache {
		err = f.cache.SaveContentToCache(importPath, actualVersion, output.String())
		if err != nil && f.debug {
			fmt.Printf("キャッシュへの保存に失敗しました: %v\n", err)
		}
	}

	return output.String(), nil
}

// ListPackageFiles はパッケージ内のファイル一覧を取得します
func (f *Fetcher) ListPackageFiles(importPath string, version string) ([]string, error) {
	// パッケージ情報を取得
	pkg, err := f.scraper.GetPackageInfo(importPath, version)
	if err != nil {
		return nil, fmt.Errorf("パッケージ情報の取得に失敗しました: %w", err)
	}

	// リポジトリURLが取得できない場合はエラー
	if pkg.RepoURL == "" {
		return nil, fmt.Errorf("リポジトリURLが見つかりません: %s", importPath)
	}

	// バージョン情報を正規化
	normalizedVersion := version
	if version != "latest" {
		// セマンティックバージョンの形式に変換（v1.2.3 -> 1.2.3）
		if strings.HasPrefix(version, "v") {
			normalizedVersion = version[1:]
		}
		// 数字とドットのみを含むバージョン文字列に変換
		versionParts := strings.Split(normalizedVersion, ".")
		var cleanParts []string
		for _, part := range versionParts {
			// 数字部分のみを抽出
			numPart := ""
			for _, c := range part {
				if c >= '0' && c <= '9' {
					numPart += string(c)
				} else {
					break
				}
			}
			if numPart != "" {
				cleanParts = append(cleanParts, numPart)
			}
		}
		if len(cleanParts) > 0 {
			normalizedVersion = strings.Join(cleanParts, ".")
		} else {
			normalizedVersion = "latest"
		}
	}

	if f.debug {
		fmt.Printf("正規化されたバージョン: %s -> %s\n", version, normalizedVersion)
	}

	// リポジトリURLからファイル一覧を取得
	repoURL := pkg.RepoURL
	if strings.Contains(repoURL, "github.com") {
		// GitHubリポジトリの場合
		return f.listGitHubFiles(repoURL, normalizedVersion)
	} else if strings.Contains(repoURL, "gitlab.com") {
		// GitLabリポジトリの場合
		return f.listGitLabFiles(repoURL, normalizedVersion)
	}

	return nil, fmt.Errorf("サポートされていないリポジトリタイプです: %s", repoURL)
}

// listGitHubFiles はGitHubリポジトリからファイル一覧を取得します
func (f *Fetcher) listGitHubFiles(repoURL string, version string) ([]string, error) {
	// GitHubのURLからユーザー名とリポジトリ名を抽出
	// 例: https://github.com/spf13/cobra -> spf13/cobra
	parts := strings.Split(repoURL, "github.com/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("無効なGitHub URL: %s", repoURL)
	}

	repoPath := strings.TrimSuffix(parts[1], "/")
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/contents", repoPath)

	// バージョンが指定されている場合はrefパラメータを追加
	if version != "" && version != "latest" {
		apiURL += fmt.Sprintf("?ref=%s", version)
	}

	if f.debug {
		fmt.Printf("GitHub API URL: %s\n", apiURL)
	}

	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// レスポンスをJSONとしてパース
	var contents []struct {
		Name string `json:"name"`
		Path string `json:"path"`
		Type string `json:"type"`
		URL  string `json:"url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&contents); err != nil {
		return nil, fmt.Errorf("JSONのパースに失敗しました: %w", err)
	}

	// ファイル一覧を抽出
	var files []string
	for _, item := range contents {
		if item.Type == "file" {
			files = append(files, item.Path)
		} else if item.Type == "dir" {
			// ディレクトリの場合は再帰的に取得
			subFiles, err := f.listGitHubDirFiles(item.URL)
			if err != nil {
				if f.debug {
					fmt.Printf("ディレクトリ %s の取得に失敗しました: %v\n", item.Path, err)
				}
				continue
			}
			for _, subFile := range subFiles {
				files = append(files, filepath.Join(item.Path, subFile))
			}
		}
	}

	return files, nil
}

// listGitHubDirFiles はGitHubディレクトリ内のファイル一覧を取得します
func (f *Fetcher) listGitHubDirFiles(dirURL string) ([]string, error) {
	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", dirURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// レスポンスをJSONとしてパース
	var contents []struct {
		Name string `json:"name"`
		Path string `json:"path"`
		Type string `json:"type"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&contents); err != nil {
		return nil, fmt.Errorf("JSONのパースに失敗しました: %w", err)
	}

	// ファイル名のみを抽出
	var files []string
	for _, item := range contents {
		if item.Type == "file" {
			files = append(files, item.Name)
		}
	}

	return files, nil
}

// listGitLabFiles はGitLabリポジトリからファイル一覧を取得します
func (f *Fetcher) listGitLabFiles(repoURL string, version string) ([]string, error) {
	// GitLabのURLからユーザー名とリポジトリ名を抽出
	parts := strings.Split(repoURL, "gitlab.com/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("無効なGitLab URL: %s", repoURL)
	}

	repoPath := strings.TrimSuffix(parts[1], "/")
	apiURL := fmt.Sprintf("https://gitlab.com/api/v4/projects/%s/repository/tree", url.PathEscape(repoPath))

	// バージョンが指定されている場合はrefパラメータを追加
	if version != "" && version != "latest" {
		apiURL += fmt.Sprintf("?ref=%s", version)
	}

	if f.debug {
		fmt.Printf("GitLab API URL: %s\n", apiURL)
	}

	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitLab API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// レスポンスをJSONとしてパース
	var contents []struct {
		Name string `json:"name"`
		Path string `json:"path"`
		Type string `json:"type"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&contents); err != nil {
		return nil, fmt.Errorf("JSONのパースに失敗しました: %w", err)
	}

	// ファイル一覧を抽出
	var files []string
	for _, item := range contents {
		if item.Type == "blob" {
			files = append(files, item.Path)
		}
	}

	return files, nil
}

// ReadPackageFile はパッケージ内の特定ファイルを読み込みます
func (f *Fetcher) ReadPackageFile(importPath string, version string, filePath string) (string, error) {
	// パッケージ情報を取得
	pkg, err := f.scraper.GetPackageInfo(importPath, version)
	if err != nil {
		return "", fmt.Errorf("パッケージ情報の取得に失敗しました: %w", err)
	}

	// リポジトリURLが取得できない場合はエラー
	if pkg.RepoURL == "" {
		return "", fmt.Errorf("リポジトリURLが見つかりません: %s", importPath)
	}

	// バージョン情報を正規化
	normalizedVersion := version
	if version != "latest" {
		// セマンティックバージョンの形式に変換（v1.2.3 -> 1.2.3）
		if strings.HasPrefix(version, "v") {
			normalizedVersion = version[1:]
		}
		// 数字とドットのみを含むバージョン文字列に変換
		versionParts := strings.Split(normalizedVersion, ".")
		var cleanParts []string
		for _, part := range versionParts {
			// 数字部分のみを抽出
			numPart := ""
			for _, c := range part {
				if c >= '0' && c <= '9' {
					numPart += string(c)
				} else {
					break
				}
			}
			if numPart != "" {
				cleanParts = append(cleanParts, numPart)
			}
		}
		if len(cleanParts) > 0 {
			normalizedVersion = strings.Join(cleanParts, ".")
		} else {
			normalizedVersion = "latest"
		}
	}

	if f.debug {
		fmt.Printf("正規化されたバージョン: %s -> %s\n", version, normalizedVersion)
	}

	// リポジトリURLからファイルを取得
	repoURL := pkg.RepoURL
	if strings.Contains(repoURL, "github.com") {
		// GitHubリポジトリの場合
		return f.readGitHubFile(repoURL, normalizedVersion, filePath)
	} else if strings.Contains(repoURL, "gitlab.com") {
		// GitLabリポジトリの場合
		return f.readGitLabFile(repoURL, normalizedVersion, filePath)
	}

	return "", fmt.Errorf("サポートされていないリポジトリタイプです: %s", repoURL)
}

// readGitHubFile はGitHubリポジトリから特定のファイルを取得します
func (f *Fetcher) readGitHubFile(repoURL string, version string, filePath string) (string, error) {
	// GitHubのURLからユーザー名とリポジトリ名を抽出
	parts := strings.Split(repoURL, "github.com/")
	if len(parts) != 2 {
		return "", fmt.Errorf("無効なGitHub URL: %s", repoURL)
	}

	repoPath := strings.TrimSuffix(parts[1], "/")
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/contents/%s", repoPath, filePath)

	// バージョンが指定されている場合はrefパラメータを追加
	if version != "" && version != "latest" {
		apiURL += fmt.Sprintf("?ref=%s", version)
	}

	if f.debug {
		fmt.Printf("GitHub API URL: %s\n", apiURL)
	}

	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("GitHub API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// レスポンスをJSONとしてパース
	var content struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&content); err != nil {
		return "", fmt.Errorf("JSONのパースに失敗しました: %w", err)
	}

	// Base64エンコードされたコンテンツをデコード
	if content.Encoding == "base64" {
		decoded, err := base64.StdEncoding.DecodeString(content.Content)
		if err != nil {
			return "", fmt.Errorf("Base64デコードに失敗しました: %w", err)
		}
		return string(decoded), nil
	}

	return content.Content, nil
}

// readGitLabFile はGitLabリポジトリから特定のファイルを取得します
func (f *Fetcher) readGitLabFile(repoURL string, version string, filePath string) (string, error) {
	// GitLabのURLからユーザー名とリポジトリ名を抽出
	parts := strings.Split(repoURL, "gitlab.com/")
	if len(parts) != 2 {
		return "", fmt.Errorf("無効なGitLab URL: %s", repoURL)
	}

	repoPath := strings.TrimSuffix(parts[1], "/")
	apiURL := fmt.Sprintf("https://gitlab.com/api/v4/projects/%s/repository/files/%s/raw",
		url.PathEscape(repoPath), url.PathEscape(filePath))

	// バージョンが指定されている場合はrefパラメータを追加
	if version != "" && version != "latest" {
		apiURL += fmt.Sprintf("?ref=%s", version)
	}

	if f.debug {
		fmt.Printf("GitLab API URL: %s\n", apiURL)
	}

	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("リクエストの作成に失敗しました: %w", err)
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("API リクエストに失敗しました: %w", err)
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("GitLab API リクエストに失敗しました: %s - %s", resp.Status, string(body))
	}

	// レスポンスの内容を読み取り
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("レスポンスの読み取りに失敗しました: %w", err)
	}

	return string(body), nil
}

// DownloadFile はURLからファイルをダウンロードします
func (f *Fetcher) DownloadFile(url string, destPath string) error {
	// ディレクトリを作成
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// ファイルを作成
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	// HTTPリクエストを作成
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	// User-Agent ヘッダーを設定
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36")

	// リクエストを実行
	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// レスポンスをチェック
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ダウンロードに失敗しました: %s", resp.Status)
	}

	// ファイルに書き込み
	_, err = io.Copy(out, resp.Body)
	return err
}
