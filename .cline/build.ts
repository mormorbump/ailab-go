#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * プロンプトファイルを結合して .clinerules を生成するスクリプト
 */

import path from "node:path";
import fs from "node:fs";
import yaml from "npm:js-yaml";

const dirname = new URL(".", import.meta.url).pathname;
const RULES_DIR = path.join(dirname, "./rules");
const ROO_MODES_DIR = path.join(dirname, "./roomodes");
const OUTPUT_FILE = path.join(Deno.cwd(), ".clinerules");

function parseFrontMatter(content: string) {
  const frontMatter = content.match(/^---\n([\s\S]+?)\n---\n/);
  if (!frontMatter) {
    return [{}, content];
  }
  const parsed = yaml.load(frontMatter[1]);
  return [parsed, content.replace(frontMatter[0], "")];
}

type RooMode = {
  slug: string;
  name: string;
  roleDefinition: string;
  groups: string[];
  source: string;
  // additionalProperty
  __filename: string;
};

async function main() {
  const roomodes: { customModes: Array<RooMode> } = {
    customModes: [],
  };

  if (fs.existsSync(ROO_MODES_DIR)) {
    const modeFiles = fs.readdirSync(ROO_MODES_DIR);
    for (const file of modeFiles) {
      const content = fs.readFileSync(path.join(ROO_MODES_DIR, file), "utf-8");
      const slug = file.replace(".md", "");
      const [frontMatter, body] = parseFrontMatter(content);
      const results = {
        ...frontMatter,
        slug,
        roleDefinition: body,
        __filename: path.join(ROO_MODES_DIR, file),
      };
      // console.log(results);
      roomodes.customModes.push(results);
    }
  }
  // console.log(roomodes);
  // throw new Error("Not implemented");

  try {
    // プロンプトファイルを読み込む
    const files: string[] = [];
    for await (const entry of Deno.readDir(RULES_DIR)) {
      if (
        entry.isFile &&
        entry.name.endsWith(".md") &&
        !entry.name.startsWith("_")
      ) {
        files.push(entry.name);
      }
    }

    // ファイル名でソート
    files.sort();

    // 各ファイルの内容を結合
    const contents = [];
    for (const file of files) {
      const content = await Deno.readTextFile(`${RULES_DIR}/${file}`);
      contents.push(content);
    }

    // .clinerules に書き出し
    let result = contents.join("\n\n");
    if (roomodes.customModes.length > 0) {
      // result = `${modeOutput}${result}`;
      result += `このプロジェクトには以下のモードが定義されています:`;
      // console.log(roomodes.customModes);
      for (const mode of roomodes.customModes) {
        // const def = roomodes.customModes.find((m) => m.name === mode)!;
        result += `\n- ${mode.slug} ${mode.name} at ${
          path.relative(
            Deno.cwd(),
            mode.__filename,
          )
        }`;
      }
    }
    await Deno.writeTextFile(
      path.join(Deno.cwd(), ".roomodes"),
      JSON.stringify(roomodes, null, 2),
    );
    console.log(
      `Generated .roomodes from ${roomodes.customModes.length} mode files`,
    );

    await Deno.writeTextFile(OUTPUT_FILE, result);
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
