// Package types は go-pkg-summary で使用する型定義を提供します
package internal

// Package はGoパッケージの情報を表す構造体です
type Package struct {
	// パッケージ名
	Name string
	// インポートパス
	ImportPath string
	// バージョン
	Version string
	// 概要
	Synopsis string
	// ドキュメントURL
	DocURL string
	// リポジトリURL
	RepoURL string
}

// PackageFile はパッケージ内のファイル情報を表す構造体です
type PackageFile struct {
	// ファイル名
	Name string
	// ファイルパス
	Path string
	// ファイルの内容
	Content string
}

// TypeInfo はGoの型情報を表す構造体です
type TypeInfo struct {
	// 型名
	Name string
	// 型の種類（struct, interface, func, const, var）
	Kind string
	// 型の定義
	Definition string
	// コメント
	Comment string
}

// GetPackageOptions はパッケージ取得オプションを表す構造体です
type GetPackageOptions struct {
	// キャッシュを使用するかどうか
	UseCache bool
	// 出力ファイル
	OutputFile string
	// 含めるファイルパターン
	Include []string
	// ドライラン（実際に取得せずに情報のみ表示）
	DryRun bool
}

// DEFAULT_INCLUDE_PATTERNS はデフォルトで含めるファイルパターンです
var DEFAULT_INCLUDE_PATTERNS = []string{
	"README.md",
	"go.mod",
	"*.go",
}
