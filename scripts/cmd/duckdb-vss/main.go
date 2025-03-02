// duckdb-vss コマンドは DuckDB のベクトル類似性検索機能を使用するためのユーティリティです
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// DuckDBの実行結果を表す構造体
type QueryResult struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
}

// DuckDBクライアント
type DuckDBClient struct {
	dbPath string
}

// 新しいDuckDBクライアントを作成
func NewDuckDBClient(dbPath string) *DuckDBClient {
	if dbPath == "" {
		dbPath = ":memory:"
	}
	return &DuckDBClient{
		dbPath: dbPath,
	}
}

// SQLクエリを実行
func (c *DuckDBClient) Exec(sql string) error {
	// duckdb コマンドが利用可能か確認
	_, err := exec.LookPath("duckdb")
	if err != nil {
		return fmt.Errorf("DuckDB コマンドが見つかりません。インストールしてください: %w", err)
	}

	// クエリを実行
	cmd := exec.Command("duckdb", c.dbPath, "-c", sql)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// SQLクエリを実行して結果を取得
func (c *DuckDBClient) Query(sql string) (*QueryResult, error) {
	// duckdb コマンドが利用可能か確認
	_, err := exec.LookPath("duckdb")
	if err != nil {
		return nil, fmt.Errorf("DuckDB コマンドが見つかりません。インストールしてください: %w", err)
	}

	// JSON 形式でクエリを実行
	cmd := exec.Command("duckdb", c.dbPath, "-json", "-c", sql)
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("クエリの実行に失敗しました: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("クエリの実行に失敗しました: %w", err)
	}

	// JSON をパース
	var result QueryResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("結果のパースに失敗しました: %w", err)
	}

	return &result, nil
}

// 拡張機能をインストールして読み込む
func (c *DuckDBClient) InstallExtension(extensionName string) error {
	sql := fmt.Sprintf("INSTALL %s; LOAD %s;", extensionName, extensionName)
	return c.Exec(sql)
}

// ベクトル検索クライアント
type VectorSearchClient struct {
	client *DuckDBClient
}

// 新しいベクトル検索クライアントを作成
func NewVectorSearchClient(client *DuckDBClient) (*VectorSearchClient, error) {
	vsc := &VectorSearchClient{
		client: client,
	}

	// VSS 拡張機能をインストールして読み込む
	if err := client.InstallExtension("vss"); err != nil {
		return nil, fmt.Errorf("VSS 拡張機能のインストールに失敗しました: %w", err)
	}

	return vsc, nil
}

// ベクトル埋め込みを格納するテーブルを作成
func (c *VectorSearchClient) CreateEmbeddingsTable(tableName string, dimensions int, additionalColumns string) error {
	columns := ""
	if additionalColumns != "" {
		columns = additionalColumns + ", "
	}
	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (%svec FLOAT[%d]);", tableName, columns, dimensions)
	return c.client.Exec(sql)
}

// HNSWインデックスを作成
func (c *VectorSearchClient) CreateHNSWIndex(tableName, indexName, columnName string, metric string) error {
	if columnName == "" {
		columnName = "vec"
	}
	if metric == "" {
		metric = "l2sq"
	}
	sql := fmt.Sprintf("CREATE INDEX %s ON %s USING HNSW (%s) WITH (metric = '%s');", indexName, tableName, columnName, metric)
	return c.client.Exec(sql)
}

// ユークリッド距離を使用して類似ベクトルを検索
func (c *VectorSearchClient) SearchByEuclideanDistance(tableName string, queryVector []float64, limit int, columnName string) (*QueryResult, error) {
	if columnName == "" {
		columnName = "vec"
	}
	if limit <= 0 {
		limit = 10
	}

	// ベクトルを文字列に変換
	vectorStr := make([]string, len(queryVector))
	for i, v := range queryVector {
		vectorStr[i] = fmt.Sprintf("%f", v)
	}
	vectorQuery := strings.Join(vectorStr, ", ")

	sql := fmt.Sprintf(`
		SELECT *, array_distance(%s, [%s]::FLOAT[%d]) as distance
		FROM %s
		ORDER BY array_distance(%s, [%s]::FLOAT[%d])
		LIMIT %d;
	`, columnName, vectorQuery, len(queryVector), tableName, columnName, vectorQuery, len(queryVector), limit)

	return c.client.Query(sql)
}

// コサイン距離を使用して類似ベクトルを検索
func (c *VectorSearchClient) SearchByCosineDistance(tableName string, queryVector []float64, limit int, columnName string) (*QueryResult, error) {
	if columnName == "" {
		columnName = "vec"
	}
	if limit <= 0 {
		limit = 10
	}

	// ベクトルを文字列に変換
	vectorStr := make([]string, len(queryVector))
	for i, v := range queryVector {
		vectorStr[i] = fmt.Sprintf("%f", v)
	}
	vectorQuery := strings.Join(vectorStr, ", ")

	sql := fmt.Sprintf(`
		SELECT *, array_cosine_distance(%s, [%s]::FLOAT[%d]) as distance
		FROM %s
		ORDER BY array_cosine_distance(%s, [%s]::FLOAT[%d])
		LIMIT %d;
	`, columnName, vectorQuery, len(queryVector), tableName, columnName, vectorQuery, len(queryVector), limit)

	return c.client.Query(sql)
}

// 内積を使用して類似ベクトルを検索
func (c *VectorSearchClient) SearchByInnerProduct(tableName string, queryVector []float64, limit int, columnName string) (*QueryResult, error) {
	if columnName == "" {
		columnName = "vec"
	}
	if limit <= 0 {
		limit = 10
	}

	// ベクトルを文字列に変換
	vectorStr := make([]string, len(queryVector))
	for i, v := range queryVector {
		vectorStr[i] = fmt.Sprintf("%f", v)
	}
	vectorQuery := strings.Join(vectorStr, ", ")

	sql := fmt.Sprintf(`
		SELECT *, array_negative_inner_product(%s, [%s]::FLOAT[%d]) as distance
		FROM %s
		ORDER BY array_negative_inner_product(%s, [%s]::FLOAT[%d])
		LIMIT %d;
	`, columnName, vectorQuery, len(queryVector), tableName, columnName, vectorQuery, len(queryVector), limit)

	return c.client.Query(sql)
}

// サンプルデータを作成して検索するデモ
func runDemo() error {
	// DuckDBクライアントを作成
	client := NewDuckDBClient("")
	fmt.Println("DuckDBクライアントを作成しました")

	// テーブルを作成
	if err := client.Exec("CREATE TABLE test (id INTEGER, name VARCHAR);"); err != nil {
		return fmt.Errorf("テーブルの作成に失敗しました: %w", err)
	}
	fmt.Println("テストテーブルを作成しました")

	// データを挿入
	if err := client.Exec("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');"); err != nil {
		return fmt.Errorf("データの挿入に失敗しました: %w", err)
	}
	fmt.Println("テストデータを挿入しました")

	// クエリを実行
	result, err := client.Query("SELECT * FROM test;")
	if err != nil {
		return fmt.Errorf("クエリの実行に失敗しました: %w", err)
	}
	fmt.Println("クエリ結果:", result)

	// VSS拡張機能を使用した例
	// VectorSearchClientを作成
	vectorClient, err := NewVectorSearchClient(client)
	if err != nil {
		return fmt.Errorf("VectorSearchClientの作成に失敗しました: %w", err)
	}
	fmt.Println("VectorSearchClientを作成しました")

	// ベクトル埋め込みを格納するテーブルを作成
	if err := vectorClient.CreateEmbeddingsTable("embeddings", 3, "id INTEGER, description VARCHAR"); err != nil {
		return fmt.Errorf("埋め込みテーブルの作成に失敗しました: %w", err)
	}
	fmt.Println("埋め込みテーブルを作成しました")

	// データを挿入
	if err := client.Exec(`
		INSERT INTO embeddings VALUES
		(1, '赤色のベクトル', [1.0, 0.1, 0.1]),
		(2, '緑色のベクトル', [0.1, 1.0, 0.1]),
		(3, '青色のベクトル', [0.1, 0.1, 1.0]);
	`); err != nil {
		return fmt.Errorf("ベクトルデータの挿入に失敗しました: %w", err)
	}
	fmt.Println("ベクトルデータを挿入しました")

	// HNSWインデックスを作成
	if err := vectorClient.CreateHNSWIndex("embeddings", "emb_idx", "vec", "l2sq"); err != nil {
		return fmt.Errorf("インデックスの作成に失敗しました: %w", err)
	}
	fmt.Println("HNSWインデックスを作成しました")

	// ユークリッド距離を使用して類似ベクトルを検索
	queryVector := []float64{0.9, 0.2, 0.2}
	similarVectors, err := vectorClient.SearchByEuclideanDistance("embeddings", queryVector, 2, "vec")
	if err != nil {
		return fmt.Errorf("類似ベクトルの検索に失敗しました: %w", err)
	}
	fmt.Println("類似ベクトル:", similarVectors)

	return nil
}

func main() {
	// コマンドライン引数を解析
	if len(os.Args) > 1 && os.Args[1] == "demo" {
		if err := runDemo(); err != nil {
			fmt.Fprintf(os.Stderr, "デモの実行に失敗しました: %s\n", err.Error())
			os.Exit(1)
		}
		return
	}

	// 使用方法を表示
	fmt.Println("DuckDB ベクトル類似性検索 (VSS) ユーティリティ")
	fmt.Println("")
	fmt.Println("使用方法:")
	fmt.Println("  duckdb-vss demo                  デモを実行")
	fmt.Println("")
	fmt.Println("注意: このコマンドを使用するには、DuckDBがインストールされている必要があります。")
	fmt.Println("DuckDBのインストール方法: https://duckdb.org/docs/installation/")
}