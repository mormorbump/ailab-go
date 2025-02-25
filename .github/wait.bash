# リポジトリ名を取得（user/repo形式）
# repo_url=$(git config --get remote.origin.url)
# repo_name=$(echo $repo_url | sed -E 's/.*github.com[:/](.+)(\.git)?$/\1/')

# 最新のワークフローを取得して待機
# run_id=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
# echo "Waiting for workflow run ID: $run_id"
# gh run watch $run_id

#!/bin/bash

# 使用方法をチェック
if [ "$#" -lt 1 ]; then
    echo "使用方法: $0 <workflow_file.yml> [wait_seconds]"
    echo "例: $0 ci.yml 10"
    exit 1
fi

# 引数の取得
WORKFLOW_FILE="$1"
WAIT_SECONDS="${2:-10}"  # デフォルトは10秒

echo "リポジトリをプッシュしています..."
git push

echo "${WAIT_SECONDS}秒間待機しています..."
sleep $WAIT_SECONDS

# リポジトリ名を取得（user/repo形式）
REPO_URL=$(git config --get remote.origin.url)
REPO_NAME=$(echo $REPO_URL | sed -E 's/.*github.com[:/](.+)(\.git)?$/\1/')

if [ -z "$REPO_NAME" ]; then
    echo "リポジトリ名の取得に失敗しました。"
    exit 1
fi

echo "リポジトリ: $REPO_NAME"
echo "ワークフロー: $WORKFLOW_FILE"

# 指定されたワークフローの最新の実行を取得
echo "最新のワークフロー実行を検索しています..."
RUN_ID=$(gh run list --repo "$REPO_NAME" --workflow="$WORKFLOW_FILE" --limit 1 --json databaseId --jq '.[0].databaseId')

if [ -z "$RUN_ID" ]; then
    echo "ワークフロー実行が見つかりませんでした。"
    exit 1
fi

echo "ワークフロー実行 ID: $RUN_ID の完了を待機しています..."
gh run watch "$RUN_ID" --repo "$REPO_NAME"

STATUS=$(gh run view "$RUN_ID" --repo "$REPO_NAME" --json conclusion --jq '.conclusion')
echo "ワークフロー実行結果: $STATUS"

if [ "$STATUS" = "success" ]; then
    exit 0
else
    exit 1
fi