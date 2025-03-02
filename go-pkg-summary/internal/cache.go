// Package cache はパッケージ情報のキャッシュ機能を提供します
package internal

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// CacheDirName はキャッシュディレクトリ名です
	CacheDirName = ".gopkgsummary"
)

// Cache はパッケージキャッシュを管理する構造体です
type Cache struct {
	// キャッシュのベースディレクトリ
	baseDir string
}

// NewCache は新しいキャッシュインスタンスを作成します
func NewCache() (*Cache, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("ホームディレクトリの取得に失敗しました: %w", err)
	}

	baseDir := filepath.Join(homeDir, CacheDirName)
	return &Cache{baseDir: baseDir}, nil
}

// GetCacheDir はパッケージのキャッシュディレクトリを取得します
func (c *Cache) GetCacheDir(pkgPath string, version string) string {
	// パッケージパスを正規化（github.com/user/repo → github.com-user-repo）
	normalizedPkgPath := strings.ReplaceAll(pkgPath, "/", "-")
	return filepath.Join(c.baseDir, normalizedPkgPath, version)
}

// EnsureDir はディレクトリが存在することを確認し、存在しない場合は作成します
func (c *Cache) EnsureDir(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// GetContentFromCache はキャッシュからコンテンツを取得します
func (c *Cache) GetContentFromCache(pkgPath string, version string) (string, error) {
	cacheDir := c.GetCacheDir(pkgPath, version)
	contentPath := filepath.Join(cacheDir, "content.md")

	data, err := os.ReadFile(contentPath)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// SaveContentToCache はコンテンツをキャッシュに保存します
func (c *Cache) SaveContentToCache(pkgPath string, version string, content string) error {
	cacheDir := c.GetCacheDir(pkgPath, version)
	if err := c.EnsureDir(cacheDir); err != nil {
		return err
	}

	contentPath := filepath.Join(cacheDir, "content.md")
	return os.WriteFile(contentPath, []byte(content), 0644)
}

// GenerateHash は文字列からハッシュを生成します
func GenerateHash(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])[:8] // 最初の8文字だけを使用
}
