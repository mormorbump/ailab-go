package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// RooMode は roomode の構造を表す
type RooMode struct {
	Slug           string   `json:"slug"`
	Name           string   `json:"name"`
	RoleDefinition string   `json:"roleDefinition"`
	Groups         []string `json:"groups,omitempty"`
	Source         string   `json:"source,omitempty"`
	Filename       string   `json:"__filename"`
}

// RooModes は複数の RooMode を含む構造体
type RooModes struct {
	CustomModes []RooMode `json:"customModes"`
}

// マークダウンファイルの内容を解析して、フロントマターと本文に分離
// フロントマターとは、多くのマークダウンファイルの先頭に記述される YAML 形式のメタデータで、--- で囲まれた部分
// parseFrontMatter 関数は、ファイルの内容を受け取り、フロントマター部分を YAML として解析し、その結果と残りの本文テキストを返す
func parseFrontMatter(content string) (map[string]interface{}, string) {
	frontMatterRegex := regexp.MustCompile(`(?s)^---\n(.*?)\n---\n`)
	matches := frontMatterRegex.FindStringSubmatch(content)

	if len(matches) == 0 {
		return map[string]interface{}{}, content
	}

	frontMatterContent := matches[1]
	var parsed map[string]interface{}

	err := yaml.Unmarshal([]byte(frontMatterContent), &parsed)
	if err != nil {
		fmt.Printf("Error parsing YAML front matter: %v\n", err)
		return map[string]interface{}{}, content
	}

	// フロントマターを除去したコンテンツを返す
	bodyContent := frontMatterRegex.ReplaceAllString(content, "")
	return parsed, bodyContent
}

func main() {
	// 実行中のファイルのディレクトリを取得
	execDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current directory: %v\n", err)
		os.Exit(1)
	}

	// ディレクトリのパスを設定
	rulesDir := filepath.Join(execDir, ".cline", "rules")
	roomodesDir := filepath.Join(execDir, ".cline", "roomodes")
	outputFile := filepath.Join(execDir, ".clinerules")

	// roomodes の処理
	roomodes := RooModes{
		CustomModes: []RooMode{},
	}

	// roomodes ディレクトリが存在するか確認
	if _, err := os.Stat(roomodesDir); err == nil {
		// ディレクトリ内のファイルを読み込む
		files, err := os.ReadDir(roomodesDir)
		if err != nil {
			fmt.Printf("Error reading roomodes directory: %v\n", err)
			os.Exit(1)
		}

		for _, file := range files {
			if file.IsDir() {
				continue
			}

			filePath := filepath.Join(roomodesDir, file.Name())
			content, err := os.ReadFile(filePath)
			if err != nil {
				fmt.Printf("Error reading file %s: %v\n", filePath, err)
				continue
			}

			// slug はmodeの識別子として使用
			slug := strings.TrimSuffix(file.Name(), ".md")
			frontMatter, body := parseFrontMatter(string(content))

			// RooMode を作成
			rooMode := RooMode{
				Slug:           slug,
				RoleDefinition: body,
				Filename:       filePath,
			}

			// frontMatter からフィールドを設定
			if name, ok := frontMatter["name"].(string); ok {
				rooMode.Name = name
			}

			if groups, ok := frontMatter["groups"].([]interface{}); ok {
				for _, group := range groups {
					if groupStr, ok := group.(string); ok {
						rooMode.Groups = append(rooMode.Groups, groupStr)
					}
				}
			}

			if source, ok := frontMatter["source"].(string); ok {
				rooMode.Source = source
			}

			roomodes.CustomModes = append(roomodes.CustomModes, rooMode)
		}
	}

	// rules ディレクトリの処理
	var files []string

	err = filepath.WalkDir(rulesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() && strings.HasSuffix(d.Name(), ".md") && !strings.HasPrefix(d.Name(), "_") {
			files = append(files, d.Name())
		}

		return nil
	})

	if err != nil {
		fmt.Printf("Error walking rules directory: %v\n", err)
		os.Exit(1)
	}

	// ファイル名でソート
	sort.Strings(files)

	// 各ファイルの内容を結合
	var contents []string

	for _, file := range files {
		filePath := filepath.Join(rulesDir, file)
		content, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("Error reading file %s: %v\n", filePath, err)
			continue
		}

		contents = append(contents, string(content))
	}

	// .clinerules に書き出し
	result := strings.Join(contents, "\n\n")

	if len(roomodes.CustomModes) > 0 {
		result += "\nこのプロジェクトには以下のモードが定義されています:"

		for _, mode := range roomodes.CustomModes {
			relPath, _ := filepath.Rel(execDir, mode.Filename)
			result += fmt.Sprintf("\n- %s %s at %s", mode.Slug, mode.Name, relPath)
		}
	}

	// .roomodes ファイルの書き出し
	roomodesContent, err := json.MarshalIndent(roomodes, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling roomodes: %v\n", err)
		os.Exit(1)
	}

	err = os.WriteFile(filepath.Join(execDir, ".roomodes"), roomodesContent, 0644)
	if err != nil {
		fmt.Printf("Error writing .roomodes file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Generated .roomodes from %d mode files\n", len(roomodes.CustomModes))

	// .clinerules ファイルの書き出し
	err = os.WriteFile(outputFile, []byte(result), 0644)
	if err != nil {
		fmt.Printf("Error writing .clinerules file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Generated %s from %d prompt files\n", outputFile, len(files))
}
