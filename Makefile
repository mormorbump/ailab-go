test:
	go test -race ./...

coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "カバレッジレポートを coverage.html に生成しました"

lint:
	golangci-lint run --enable=gocognit,gocritic,gocyclo,godot,godox,misspell

check: test coverage lint