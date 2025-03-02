// Package parser はGoコードの解析機能を提供します
package internal

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
)

// Parser はGoコードを解析する構造体です
type Parser struct {
	debug bool
}

// NewParser は新しいParserインスタンスを作成します
func NewParser(debug bool) *Parser {
	return &Parser{
		debug: debug,
	}
}

// ParseFile はGoファイルを解析して型情報を抽出します
func (p *Parser) ParseFile(filename string, src string) ([]TypeInfo, error) {
	// ファイルセットを作成
	fset := token.NewFileSet()

	// ソースコードを解析
	f, err := parser.ParseFile(fset, filename, src, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("ファイルの解析に失敗しました: %w", err)
	}

	// 型情報を抽出
	var typeInfos []TypeInfo

	// 宣言を処理
	for _, decl := range f.Decls {
		switch d := decl.(type) {
		case *ast.GenDecl:
			// 型宣言、変数宣言、定数宣言を処理
			typeInfos = append(typeInfos, p.processGenDecl(d, fset)...)
		case *ast.FuncDecl:
			// 関数宣言を処理
			if ti := p.processFuncDecl(d, fset); ti != nil {
				typeInfos = append(typeInfos, *ti)
			}
		}
	}

	return typeInfos, nil
}

// processGenDecl は一般的な宣言（型、変数、定数）を処理します
func (p *Parser) processGenDecl(decl *ast.GenDecl, fset *token.FileSet) []TypeInfo {
	var typeInfos []TypeInfo

	// コメントを取得
	comment := ""
	if decl.Doc != nil {
		comment = decl.Doc.Text()
	}

	// 宣言の種類に応じて処理
	switch decl.Tok {
	case token.TYPE:
		// 型宣言を処理
		for _, spec := range decl.Specs {
			if ts, ok := spec.(*ast.TypeSpec); ok {
				kind := "type"
				definition := ""

				// 型の種類を判定
				switch ts.Type.(type) {
				case *ast.StructType:
					kind = "struct"
				case *ast.InterfaceType:
					kind = "interface"
				case *ast.FuncType:
					kind = "func"
				}

				// 型の定義を取得
				definition = fmt.Sprintf("type %s %s", ts.Name.Name, kind)

				// 型情報を追加
				typeInfos = append(typeInfos, TypeInfo{
					Name:       ts.Name.Name,
					Kind:       kind,
					Definition: definition,
					Comment:    comment,
				})
			}
		}
	case token.CONST:
		// 定数宣言を処理
		for _, spec := range decl.Specs {
			if vs, ok := spec.(*ast.ValueSpec); ok {
				for _, name := range vs.Names {
					// 定数情報を追加
					typeInfos = append(typeInfos, TypeInfo{
						Name:       name.Name,
						Kind:       "const",
						Definition: fmt.Sprintf("const %s", name.Name),
						Comment:    comment,
					})
				}
			}
		}
	case token.VAR:
		// 変数宣言を処理
		for _, spec := range decl.Specs {
			if vs, ok := spec.(*ast.ValueSpec); ok {
				for _, name := range vs.Names {
					// 変数情報を追加
					typeInfos = append(typeInfos, TypeInfo{
						Name:       name.Name,
						Kind:       "var",
						Definition: fmt.Sprintf("var %s", name.Name),
						Comment:    comment,
					})
				}
			}
		}
	}

	return typeInfos
}

// processFuncDecl は関数宣言を処理します
func (p *Parser) processFuncDecl(decl *ast.FuncDecl, fset *token.FileSet) *TypeInfo {
	// エクスポートされていない関数はスキップ
	if !decl.Name.IsExported() {
		return nil
	}

	// コメントを取得
	comment := ""
	if decl.Doc != nil {
		comment = decl.Doc.Text()
	}

	// メソッドかどうかを判定
	isMethod := decl.Recv != nil

	// 関数/メソッド名
	name := decl.Name.Name
	kind := "func"
	definition := fmt.Sprintf("func %s()", name)

	// メソッドの場合はレシーバーを追加
	if isMethod {
		kind = "method"
		recv := ""
		if len(decl.Recv.List) > 0 {
			// レシーバーの型を取得
			recvType := ""
			switch rt := decl.Recv.List[0].Type.(type) {
			case *ast.StarExpr:
				// ポインタレシーバー (*Type)
				if ident, ok := rt.X.(*ast.Ident); ok {
					recvType = "*" + ident.Name
				}
			case *ast.Ident:
				// 値レシーバー (Type)
				recvType = rt.Name
			}
			recv = recvType
		}
		definition = fmt.Sprintf("func (%s) %s()", recv, name)
	}

	return &TypeInfo{
		Name:       name,
		Kind:       kind,
		Definition: definition,
		Comment:    comment,
	}
}

// ExtractTypeInfo はGoコードから型情報を抽出します
func (p *Parser) ExtractTypeInfo(src string) []TypeInfo {
	typeInfos, err := p.ParseFile("", src)
	if err != nil && p.debug {
		fmt.Printf("コードの解析に失敗しました: %v\n", err)
		return nil
	}
	return typeInfos
}
