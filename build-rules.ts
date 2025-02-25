#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * プロンプトファイルを結合して .clinerules を生成するスクリプト
 */

const PROMPTS_DIR = ".cline/rules";
const OUTPUT_FILE = ".clinerules";

async function main() {
  try {
    // プロンプトファイルを読み込む
    const files = [];
    for await (const entry of Deno.readDir(PROMPTS_DIR)) {
      if (entry.isFile && entry.name.endsWith(".md")) {
        files.push(entry.name);
      }
    }

    // ファイル名でソート
    files.sort();

    // 各ファイルの内容を結合
    const contents = [];
    for (const file of files) {
      const content = await Deno.readTextFile(`${PROMPTS_DIR}/${file}`);
      contents.push(content);
    }

    // .clinerules に書き出し
    await Deno.writeTextFile(OUTPUT_FILE, contents.join("\n\n"));
    console.log(`Generated ${OUTPUT_FILE} from ${files.length} prompt files`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
