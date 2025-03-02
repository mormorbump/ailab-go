# mdx-bundler チートシート

## 概要

MDXコンテンツとその依存関係を高速にコンパイル・バンドルするツール。MDX
v3とesbuildを使用し、MDXファイル内でのJavaScriptやReactコンポーネントのインポートをサポート。

```bash
# インストール
npm install mdx-bundler esbuild
# または
yarn add mdx-bundler esbuild
```

## 基本的な使い方

### サーバーサイド: MDXのバンドル

```ts
import { bundleMDX } from "mdx-bundler";

// MDXコンテンツをバンドルする
const result = await bundleMDX({
  source: `
    ---
    title: サンプル記事
    ---
    
    # こんにちは
    
    import Demo from './demo'
    
    <Demo />
  `,
  files: {
    "./demo.tsx": `
      export default function Demo() {
        return <div>デモコンポーネント</div>
      }
    `,
  },
});

// 結果を取得
const { code, frontmatter } = result;
```

### クライアントサイド: MDXのレンダリング

```tsx
import * as React from "react";
import { getMDXComponent } from "mdx-bundler/client";

function Post({ code, frontmatter }) {
  // コンポーネントをメモ化
  const Component = React.useMemo(() => getMDXComponent(code), [code]);

  return (
    <>
      <h1>{frontmatter.title}</h1>
      <Component />
    </>
  );
}
```

## 主な機能

| 機能                 | 説明                                                   |
| -------------------- | ------------------------------------------------------ |
| インポートのサポート | MDXファイル内でJSやReactコンポーネントをインポート可能 |
| フロントマター       | YAMLメタデータを抽出可能                               |
| 動的バンドリング     | ランタイムでのオンデマンドバンドリングをサポート       |
| コンポーネント置換   | MDX内のHTML要素をカスタムコンポーネントに置換可能      |
| 画像バンドル         | remarkプラグインを使用して画像もバンドル可能           |

## bundleMDX オプション

```ts
await bundleMDX({
  // 必須: source または file のどちらかを指定
  source: "# MDX コンテンツ", // MDXソースコード
  file: "./content/post.mdx", // またはMDXファイルパス

  // オプション
  files: { // インポート対象のファイル
    "./demo.tsx": "...", // キー: ファイルパス, 値: 内容
  },
  cwd: "./content", // カレントワーキングディレクトリ
  globals: { // グローバル変数（バンドル対象外）
    "react": "React",
  },

  // プラグインとカスタマイズ
  mdxOptions: (options, frontmatter) => {
    // remark/rehypeプラグインを追加
    options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkGfm];
    options.rehypePlugins = [...(options.rehypePlugins ?? []), rehypePrism];
    return options;
  },

  esbuildOptions: (options, frontmatter) => {
    // esbuildのオプションをカスタマイズ
    options.minify = false;
    options.target = ["es2020"];
    // 画像などのローダー設定
    options.loader = {
      ...options.loader,
      ".png": "dataurl",
    };
    return options;
  },

  // 出力関連
  bundleDirectory: "./public/mdx-assets",
  bundlePath: "/mdx-assets/",
});
```

## 戻り値

```ts
const result = await bundleMDX({ source });

// 主要な戻り値
const {
  code, // バンドルされたMDXコード (文字列)
  frontmatter, // 抽出されたフロントマター (オブジェクト)
  matter, // gray-matterからの完全な結果
} = result;
```

## コンポーネントの置き換え

```tsx
const Component = getMDXComponent(code);

// MDX内のHTML要素をカスタムコンポーネントに置き換え
<Component
  components={{
    h1: (props) => <Heading level={1} {...props} />,
    p: CustomParagraph,
    img: ResponsiveImage,
    pre: CodeBlock,
    // コンポーネント名でも指定可能
    Demo: CustomDemo,
  }}
/>;
```

## 画像バンドル

```ts
import { remarkMdxImages } from "remark-mdx-images";

const { code } = await bundleMDX({
  source: mdxSource,
  cwd: "./content",
  mdxOptions: (options) => {
    options.remarkPlugins = [
      ...(options?.remarkPlugins ?? []),
      remarkMdxImages,
    ];
    return options;
  },
  esbuildOptions: (options) => {
    options.loader = {
      ...options.loader,
      ".png": "dataurl", // または 'file'
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".svg": "dataurl",
    };
    return options;
  },
});
```

## Next.jsでの使用例

```ts
// lib/mdx.js
import fs from "fs";
import path from "path";
import { bundleMDX } from "mdx-bundler";

// esbuild バイナリパス問題の回避策
if (process.platform === "win32") {
  process.env.ESBUILD_BINARY_PATH = path.join(
    process.cwd(),
    "node_modules",
    "esbuild",
    "esbuild.exe",
  );
} else {
  process.env.ESBUILD_BINARY_PATH = path.join(
    process.cwd(),
    "node_modules",
    "esbuild",
    "bin",
    "esbuild",
  );
}

export async function getPostData(slug) {
  const source = fs.readFileSync(`./content/${slug}.mdx`, "utf8");

  const { code, frontmatter } = await bundleMDX({
    source,
    // プラグイン設定など
  });

  return { slug, frontmatter, code };
}
```

```jsx
// pages/blog/[slug].js
import { getMDXComponent } from "mdx-bundler/client";
import { useMemo } from "react";

export default function BlogPost({ code, frontmatter }) {
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <Component components={{/* カスタムコンポーネント */}} />
    </article>
  );
}

// getStaticProps, getStaticPaths は省略
```

## 名前付きエクスポートへのアクセス

```tsx
import { getMDXExport } from "mdx-bundler/client";

// 名前付きエクスポートにアクセス
const { frontmatter, Meta, getStaticProps } = getMDXExport(code);

// コンポーネントの取得
const Component = getMDXComponent(code);
```

## 型付け

```ts
// フロントマターの型を指定
interface Frontmatter {
  title: string;
  date: string;
  tags: string[];
}

const { frontmatter } = await bundleMDX<Frontmatter>({
  source: mdxContent,
});
// frontmatter.title, frontmatter.date, frontmatter.tags が型付けされる
```

## 注意点とトラブルシューティング

- **Cloudflare Workers での制限**: esbuildバイナリとevalが使えないため非対応
- **Next.js ENOENT問題**: esbuildバイナリパスを明示的に設定する必要がある
- **SSRでの使用**:
  `getMDXComponent`はクライアントサイドでのみ使用（サーバーでは`new Function`を使う）
- **バンドルサイズ**: MDXファイル数が多い場合、ビルド時間とバンドルサイズに注意

## 参考リンク

- [公式GitHub](https://github.com/kentcdodds/mdx-bundler)
- [MDX公式サイト](https://mdxjs.com/)
- [Next.jsでのMDX Bundler入門](https://www.peterlunch.com/blog/mdx-bundler-beginners)
