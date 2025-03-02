/**
 * ユーザーに対して質問するユーティリティ関数を提供するモジュール
 */

// テキストエンコーダー/デコーダー
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * ユーザーに質問を表示して回答を取得する
 * @param question 表示する質問
 * @param defaultValue デフォルト値（Enterキーだけで入力された場合に使用）
 * @returns ユーザーの回答
 */
export async function ask(
  question: string,
  defaultValue = "",
): Promise<string> {
  // プロンプトを表示
  Deno.stdout.write(
    encoder.encode(`${question}${defaultValue ? ` (${defaultValue})` : ""}: `),
  );

  // 入力を読み込む
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) {
    // 入力がない場合はデフォルト値
    return defaultValue;
  }

  const answer = decoder.decode(buf.subarray(0, n)).trim();

  // 回答が空の場合はデフォルト値
  return answer || defaultValue;
}

/**
 * ユーザーに確認を求める（Yes/No質問）
 * @param question 表示する質問
 * @param defaultIsYes デフォルトの回答がYesかどうか
 * @returns ユーザーがYesと答えた場合はtrue、Noと答えた場合はfalse
 */
export async function confirm(
  question: string,
  defaultIsYes = true,
): Promise<boolean> {
  const defaultText = defaultIsYes ? "Y/n" : "y/N";
  const defaultValue = defaultIsYes ? "y" : "n";

  // プロンプトを表示
  Deno.stdout.write(encoder.encode(`${question} [${defaultText}]: `));

  // 入力を読み込む
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) {
    // 入力がない場合はデフォルト値
    return defaultIsYes;
  }

  const answer = decoder.decode(buf.subarray(0, n)).trim().toLowerCase();

  // 回答が空の場合はデフォルト値
  if (!answer) {
    return defaultIsYes;
  }

  // y, yes, trueのいずれかであればtrue
  return ["y", "yes", "true"].includes(answer);
}

/**
 * 複数の選択肢からユーザーに選択してもらう
 * @param question 表示する質問
 * @param choices 選択肢の配列
 * @param defaultIndex デフォルトの選択肢のインデックス
 * @returns 選択された選択肢
 */
export async function select<T extends string>(
  question: string,
  choices: readonly T[],
  defaultIndex = 0,
): Promise<T> {
  if (choices.length === 0) {
    throw new Error("選択肢がありません");
  }

  // 選択肢を表示
  console.log(`${question}`);
  choices.forEach((choice, index) => {
    const marker = index === defaultIndex ? ">" : " ";
    console.log(`${marker} ${index + 1}: ${choice}`);
  });

  // プロンプトを表示
  const defaultValue = String(defaultIndex + 1);
  Deno.stdout.write(
    encoder.encode(
      `選択してください (1-${choices.length}) [${defaultValue}]: `,
    ),
  );

  // 入力を読み込む
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) {
    // 入力がない場合はデフォルト値
    return choices[defaultIndex];
  }

  const answer = decoder.decode(buf.subarray(0, n)).trim();

  // 回答が空の場合はデフォルト値
  if (!answer) {
    return choices[defaultIndex];
  }

  // 数値をパース
  const selectedIndex = parseInt(answer, 10) - 1;

  // 有効な選択肢かチェック
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= choices.length
  ) {
    console.log(
      `無効な選択です。デフォルトの ${defaultIndex + 1} を使用します。`,
    );
    return choices[defaultIndex];
  }

  return choices[selectedIndex];
}

/**
 * 複数行のテキスト入力を取得する
 * @param prompt 表示するプロンプト
 * @returns 入力された複数行テキスト
 */
export async function multilineInput(prompt: string): Promise<string> {
  console.log(
    `${prompt} (入力を終了するには、新しい行で「.」または「END」と入力してください)`,
  );

  let result = "";
  let line = "";

  while (true) {
    // プロンプト表示
    Deno.stdout.write(encoder.encode("> "));

    // 1行読み込み
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);

    if (n === null) {
      break;
    }

    line = decoder.decode(buf.subarray(0, n)).trim();

    // 終了条件
    if (line === "." || line === "END") {
      break;
    }

    // 結果に追加
    result += line + "\n";
  }

  return result.trim();
}

/**
 * 入力内容を非表示にしてパスワードなどの機密情報を入力してもらう
 * 注意: Denoはエコーバックの無効化をネイティブにはサポートしていないため、
 * この実装では「*」を表示するエミュレーションを行います。
 *
 * @param prompt 表示するプロンプト
 * @returns 入力された文字列
 */
export async function secureInput(prompt: string): Promise<string> {
  Deno.stdout.write(encoder.encode(`${prompt}: `));

  let result = "";

  while (true) {
    // 1バイトずつ読み込む（CTRLキーとの組み合わせでも正しく動作するよう）
    const buf = new Uint8Array(1);
    const n = await Deno.stdin.read(buf);

    if (n === null) {
      break;
    }

    const char = decoder.decode(buf);

    // Enterキーで終了
    if (char === "\n" || char === "\r") {
      Deno.stdout.write(encoder.encode("\n"));
      break;
    }

    // バックスペースの処理
    if (char === "\b" || char === "\x7f") {
      if (result.length > 0) {
        result = result.slice(0, -1);
        // 一文字削除（バックスペース、スペース、再度バックスペース）
        Deno.stdout.write(encoder.encode("\b \b"));
      }
      continue;
    }

    // 通常の文字
    result += char;
    // 文字の代わりに * を表示
    Deno.stdout.write(encoder.encode("*"));
  }

  return result;
}

/**
 * TODOの優先度を選択するための関数
 * @returns 選択された優先度
 */
export async function selectPriority(): Promise<"高" | "中" | "低"> {
  const priorities = ["高", "中", "低"] as const;
  return await select("優先度を選択してください:", priorities, 1); // デフォルトは「中」
}

/**
 * TODOのカテゴリを選択または新規入力するための関数
 * @param existingCategories 既存のカテゴリ一覧
 * @returns 選択または入力されたカテゴリ
 */
export async function selectOrCreateCategory(
  existingCategories: string[] = [],
): Promise<string> {
  const uniqueCategories = [...new Set(existingCategories)].filter(Boolean);
  const choices = [...uniqueCategories, "新しいカテゴリを作成"];

  const selected = await select(
    "カテゴリを選択または新規作成してください:",
    choices,
    uniqueCategories.length > 0 ? 0 : choices.length - 1,
  );

  if (selected === "新しいカテゴリを作成") {
    return await ask("新しいカテゴリ名を入力してください");
  }

  return selected;
}
