// lsp-client コマンドは Language Server Protocol (LSP) クライアントを実装したスクリプトです
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// LSP メッセージの型定義
type JsonRpcMessage struct {
	JsonRpc string          `json:"jsonrpc"`
	ID      *int            `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data,omitempty"`
	} `json:"error,omitempty"`
}

// 初期化パラメータ
type InitializeParams struct {
	ProcessID        int                    `json:"processId"`
	RootURI          string                 `json:"rootUri"`
	Capabilities     map[string]interface{} `json:"capabilities"`
	WorkspaceFolders []WorkspaceFolder      `json:"workspaceFolders"`
}

// ワークスペースフォルダ
type WorkspaceFolder struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}

// 位置情報
type Position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

// 範囲情報
type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

// ドキュメントシンボル
type DocumentSymbol struct {
	Name           string           `json:"name"`
	Detail         string           `json:"detail,omitempty"`
	Kind           int              `json:"kind"`
	Range          Range            `json:"range"`
	SelectionRange Range            `json:"selectionRange"`
	Children       []DocumentSymbol `json:"children,omitempty"`
}

// ホバーパラメータ
type HoverParams struct {
	TextDocument struct {
		URI string `json:"uri"`
	} `json:"textDocument"`
	Position Position `json:"position"`
}

// ドキュメントシンボルパラメータ
type DocumentSymbolParams struct {
	TextDocument struct {
		URI string `json:"uri"`
	} `json:"textDocument"`
}

// LSP クライアント
type LspClient struct {
	cmd             *exec.Cmd
	stdin           io.WriteCloser
	stdout          io.ReadCloser
	stderr          io.ReadCloser
	messageID       int
	pendingRequests map[int]chan JsonRpcMessage
	debug           bool
	serverReady     bool
	mu              sync.Mutex
}

// 新しい LSP クライアントを作成
func NewLspClient(debug bool) (*LspClient, error) {
	// Deno LSP サーバーを起動
	cmd := exec.Command("deno", "lsp")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin パイプの作成に失敗しました: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout パイプの作成に失敗しました: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("stderr パイプの作成に失敗しました: %w", err)
	}

	client := &LspClient{
		cmd:             cmd,
		stdin:           stdin,
		stdout:          stdout,
		stderr:          stderr,
		messageID:       0,
		pendingRequests: make(map[int]chan JsonRpcMessage),
		debug:           debug,
		serverReady:     false,
	}

	// コマンドを開始
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("LSP サーバーの起動に失敗しました: %w", err)
	}

	// デバッグモードの場合、stderr を監視
	if debug {
		go client.monitorStderr()
	}

	// レスポンスの監視を開始
	go client.startMessageLoop()

	return client, nil
}

// stderr を監視
func (c *LspClient) monitorStderr() {
	scanner := bufio.NewScanner(c.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Fprintf(os.Stderr, "LSP Server Error: %s\n", line)
		if strings.Contains(line, "Server ready") {
			c.serverReady = true
		}
	}
}

// デバッグログ
func (c *LspClient) log(format string, args ...interface{}) {
	if c.debug {
		fmt.Printf("[LSP Client] "+format+"\n", args...)
	}
}

// メッセージを読み込む
func (c *LspClient) readMessage() (JsonRpcMessage, error) {
	// ヘッダーを読み込む
	headerBytes := make([]byte, 0, 1024)
	headerBuf := bytes.NewBuffer(headerBytes)
	contentLength := -1

	// ヘッダーの終端を検出するための状態
	state := 0 // 0: 通常, 1: \r, 2: \r\n, 3: \r\n\r

	buf := make([]byte, 1)
	for {
		_, err := c.stdout.Read(buf)
		if err != nil {
			return JsonRpcMessage{}, fmt.Errorf("ヘッダーの読み込みに失敗しました: %w", err)
		}

		headerBuf.Write(buf)

		// ヘッダーの終端を検出
		if buf[0] == '\r' && state == 0 {
			state = 1
		} else if buf[0] == '\n' && state == 1 {
			state = 2
		} else if buf[0] == '\r' && state == 2 {
			state = 3
		} else if buf[0] == '\n' && state == 3 {
			// ヘッダーの終端を検出
			break
		} else {
			state = 0
		}
	}

	// Content-Length を解析
	header := headerBuf.String()
	matches := strings.Split(header, "Content-Length: ")
	if len(matches) > 1 {
		lengthStr := strings.Split(matches[1], "\r\n")[0]
		contentLength, _ = strconv.Atoi(lengthStr)
	}

	if contentLength <= 0 {
		return JsonRpcMessage{}, fmt.Errorf("無効な Content-Length: %d", contentLength)
	}

	// コンテンツを読み込む
	content := make([]byte, contentLength)
	_, err := io.ReadFull(c.stdout, content)
	if err != nil {
		return JsonRpcMessage{}, fmt.Errorf("コンテンツの読み込みに失敗しました: %w", err)
	}

	// JSON をパース
	var message JsonRpcMessage
	if err := json.Unmarshal(content, &message); err != nil {
		return JsonRpcMessage{}, fmt.Errorf("JSON のパースに失敗しました: %w", err)
	}

	return message, nil
}

// メッセージループを開始
func (c *LspClient) startMessageLoop() {
	for {
		message, err := c.readMessage()
		if err != nil {
			c.log("メッセージの読み込みに失敗しました: %s", err.Error())
			break
		}

		c.log("受信メッセージ: %+v", message)

		if message.ID != nil {
			// リクエストのレスポンス
			c.mu.Lock()
			resolver, ok := c.pendingRequests[*message.ID]
			c.mu.Unlock()
			if ok {
				resolver <- message
				close(resolver)
				c.mu.Lock()
				delete(c.pendingRequests, *message.ID)
				c.mu.Unlock()
			}
		} else if message.Method != "" {
			// サーバーからの通知
			c.log("サーバー通知: %s %s", message.Method, string(message.Params))
		}
	}
}

// サーバーの準備ができるまで待機
func (c *LspClient) waitForServerReady() {
	for !c.serverReady {
		// 100ms 待機
		<-time.After(100 * time.Millisecond)
	}
}

// リクエストを送信
func (c *LspClient) sendRequest(method string, params interface{}) (json.RawMessage, error) {
	c.mu.Lock()
	id := c.messageID
	c.messageID++
	c.mu.Unlock()

	// パラメータを JSON にエンコード
	var paramsJSON []byte
	var err error
	if params != nil {
		paramsJSON, err = json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("パラメータのエンコードに失敗しました: %w", err)
		}
	}

	// メッセージを作成
	message := JsonRpcMessage{
		JsonRpc: "2.0",
		ID:      &id,
		Method:  method,
	}
	if params != nil {
		message.Params = paramsJSON
	}

	c.log("リクエスト送信: %s %+v", method, params)

	// メッセージを JSON にエンコード
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return nil, fmt.Errorf("メッセージのエンコードに失敗しました: %w", err)
	}

	// レスポンスを待機するためのチャネルを作成
	responseChan := make(chan JsonRpcMessage)
	c.mu.Lock()
	c.pendingRequests[id] = responseChan
	c.mu.Unlock()

	// メッセージを送信
	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(messageJSON))
	if _, err := c.stdin.Write([]byte(header)); err != nil {
		return nil, fmt.Errorf("ヘッダーの送信に失敗しました: %w", err)
	}
	if _, err := c.stdin.Write(messageJSON); err != nil {
		return nil, fmt.Errorf("メッセージの送信に失敗しました: %w", err)
	}

	// レスポンスを待機
	response := <-responseChan

	if response.Error != nil {
		return nil, fmt.Errorf("LSP エラー: %s", response.Error.Message)
	}

	return response.Result, nil
}

// 通知を送信
func (c *LspClient) sendNotification(method string, params interface{}) error {
	// パラメータを JSON にエンコード
	var paramsJSON []byte
	var err error
	if params != nil {
		paramsJSON, err = json.Marshal(params)
		if err != nil {
			return fmt.Errorf("パラメータのエンコードに失敗しました: %w", err)
		}
	}

	// メッセージを作成
	message := JsonRpcMessage{
		JsonRpc: "2.0",
		Method:  method,
	}
	if params != nil {
		message.Params = paramsJSON
	}

	c.log("通知送信: %s %+v", method, params)

	// メッセージを JSON にエンコード
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("メッセージのエンコードに失敗しました: %w", err)
	}

	// メッセージを送信
	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(messageJSON))
	if _, err := c.stdin.Write([]byte(header)); err != nil {
		return fmt.Errorf("ヘッダーの送信に失敗しました: %w", err)
	}
	if _, err := c.stdin.Write(messageJSON); err != nil {
		return fmt.Errorf("メッセージの送信に失敗しました: %w", err)
	}

	return nil
}

// 初期化
func (c *LspClient) Initialize() (json.RawMessage, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("カレントディレクトリの取得に失敗しました: %w", err)
	}

	params := InitializeParams{
		ProcessID: os.Getpid(),
		RootURI:   fmt.Sprintf("file://%s", cwd),
		WorkspaceFolders: []WorkspaceFolder{
			{
				URI:  fmt.Sprintf("file://%s", cwd),
				Name: "workspace",
			},
		},
		Capabilities: map[string]interface{}{
			"textDocument": map[string]interface{}{
				"hover": map[string]interface{}{
					"dynamicRegistration": true,
					"contentFormat":       []string{"markdown", "plaintext"},
				},
				"synchronization": map[string]interface{}{
					"dynamicRegistration": true,
					"didSave":             true,
					"willSave":            true,
				},
				"documentSymbol": map[string]interface{}{
					"dynamicRegistration":               true,
					"hierarchicalDocumentSymbolSupport": true,
				},
			},
			"workspace": map[string]interface{}{
				"workspaceFolders": true,
			},
		},
	}

	return c.sendRequest("initialize", params)
}

// 初期化完了通知
func (c *LspClient) Initialized() error {
	err := c.sendNotification("initialized", struct{}{})
	if err != nil {
		return err
	}
	return nil
}

// ファイルを開く
func (c *LspClient) DidOpen(uri string, text string) error {
	params := struct {
		TextDocument struct {
			URI        string `json:"uri"`
			LanguageID string `json:"languageId"`
			Version    int    `json:"version"`
			Text       string `json:"text"`
		} `json:"textDocument"`
	}{
		TextDocument: struct {
			URI        string `json:"uri"`
			LanguageID string `json:"languageId"`
			Version    int    `json:"version"`
			Text       string `json:"text"`
		}{
			URI:        uri,
			LanguageID: "typescript",
			Version:    1,
			Text:       text,
		},
	}

	return c.sendNotification("textDocument/didOpen", params)
}

// ドキュメントシンボルを取得
func (c *LspClient) GetDocumentSymbols(uri string) ([]DocumentSymbol, error) {
	params := DocumentSymbolParams{
		TextDocument: struct {
			URI string `json:"uri"`
		}{
			URI: uri,
		},
	}

	result, err := c.sendRequest("textDocument/documentSymbol", params)
	if err != nil {
		return nil, err
	}

	var symbols []DocumentSymbol
	if err := json.Unmarshal(result, &symbols); err != nil {
		return nil, fmt.Errorf("シンボル情報のデコードに失敗しました: %w", err)
	}

	return symbols, nil
}

// ホバー情報を取得
func (c *LspClient) GetHoverByRange(uri string, position Position) (json.RawMessage, error) {
	params := HoverParams{
		TextDocument: struct {
			URI string `json:"uri"`
		}{
			URI: uri,
		},
		Position: position,
	}

	return c.sendRequest("textDocument/hover", params)
}

// クライアントを閉じる
func (c *LspClient) Close() error {
	// シャットダウンリクエストを送信
	if _, err := c.sendRequest("shutdown", nil); err != nil {
		return fmt.Errorf("シャットダウンリクエストの送信に失敗しました: %w", err)
	}

	// 終了通知を送信
	if err := c.sendNotification("exit", nil); err != nil {
		return fmt.Errorf("終了通知の送信に失敗しました: %w", err)
	}

	// プロセスを終了
	if err := c.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("プロセスの終了に失敗しました: %w", err)
	}

	return nil
}

func main() {
	// デバッグモードを有効化
	debug := true

	// LSP クライアントを作成
	client, err := NewLspClient(debug)
	if err != nil {
		fmt.Fprintf(os.Stderr, "LSP クライアントの作成に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}
	defer client.Close()

	// 初期化
	fmt.Println("LSP クライアントを初期化しています...")
	_, err = client.Initialize()
	if err != nil {
		fmt.Fprintf(os.Stderr, "初期化に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}

	fmt.Println("初期化完了通知を送信しています...")
	if err := client.Initialized(); err != nil {
		fmt.Fprintf(os.Stderr, "初期化完了通知の送信に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}

	// test.ts のパスを取得
	testPath := filepath.Join("scripts", "test.ts")
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "カレントディレクトリの取得に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}
	testURI := fmt.Sprintf("file://%s/%s", filepath.Clean(cwd), testPath)
	testContent, err := os.ReadFile(testPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "test.ts の読み込みに失敗しました: %s\n", err.Error())
		os.Exit(1)
	}

	fmt.Println("test.ts を開いています...")
	if err := client.DidOpen(testURI, string(testContent)); err != nil {
		fmt.Fprintf(os.Stderr, "ファイルを開くのに失敗しました: %s\n", err.Error())
		os.Exit(1)
	}

	// シンボル情報を取得
	fmt.Println("ドキュメントシンボルを取得しています...")
	symbols, err := client.GetDocumentSymbols(testURI)
	if err != nil {
		fmt.Fprintf(os.Stderr, "シンボル情報の取得に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}
	fmt.Println("[lsp] ドキュメントシンボル:", symbols)

	// double 関数のシンボルを探す
	var doubleSymbol *DocumentSymbol
	for i := range symbols {
		if symbols[i].Name == "double" {
			doubleSymbol = &symbols[i]
			break
		}
	}

	if doubleSymbol == nil {
		fmt.Println("double 関数のシンボルが見つかりませんでした")
		os.Exit(1)
	}

	// 関数の位置でホバー情報を取得
	fmt.Println("ホバー情報を取得しています...")
	hoverResult, err := client.GetHoverByRange(testURI, doubleSymbol.SelectionRange.Start)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ホバー情報の取得に失敗しました: %s\n", err.Error())
		os.Exit(1)
	}
	fmt.Println("[lsp] 'double' 関数:", string(hoverResult))
}
