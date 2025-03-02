# mdx-bundler

## 概要

mdx-bundlerは、MDXコンテンツとその依存関係を高速にコンパイル・バンドルするためのツールです。Kent C. Doddsによって開発され、MDX v3とesbuildを利用することで非常に高速な処理を実現しています。

このライブラリを使用すると、MDXファイル内でJavaScriptやReactコンポーネントをインポートし、それらを含めてバンドルすることができます。コンテンツの出所（ローカルファイル、リモートリポジトリ、CMS等）を問わず、必要なファイルとソースコードを提供するだけで、mdx-bundlerが全てのバンドル処理を行います。

## 基本的な使い方

### インストール

```bash
npm install --save mdx-bundler esbuild
# または
yarn add mdx-bundler esbuild
```

### サーバーサイドでのMDXのバンドル

```typescript
import { bundleMDX } from 'mdx-bundler';

const mdxSource = `
---
title: サンプル記事
published: 2021-02-13
description: これはサンプル説明です
---

# こんにちは

import Demo from './demo'

これは**素晴らしい**デモです:

<Demo />
`.trim();

const result = await bundleMDX({
  source: mdxSource,
  files: {
    './demo.tsx': `
import * as React from 'react'

function Demo() {
  return <div>素晴らしいデモ！</div>
}

export default Demo
    `,
  },
});

const { code, frontmatter } = result;
```

### クライアントサイドでのMDXのレンダリング

```tsx
import * as React from 'react';
import { getMDXComponent } from 'mdx-bundler/client';

function Post({ code, frontmatter }) {
  // コンポーネントを再作成するのを避けるためにuseMemoを使用
  const Component = React.useMemo(() => getMDXComponent(code), [code]);
  return (
    <>
      <header>
        <h1>{frontmatter.title}</h1>
        <p>{frontmatter.description}</p>
      </header>
      <main>
        <Component />
      </main>
    </>
  );
}
```

## 主な機能

### MDXファイル内でのインポートのサポート

mdx-bundlerの最も強力な機能の1つは、MDXファイル内でのインポートをサポートしていることです。以下のようなMDXファイルが処理できます：

```mdx
---
title: サンプル記事
published: 2021-02-13
---

# タイトル

import Demo from './demo'

これは**素晴らしい**デモです:

<Demo />
```

### フロントマターのサポート

MDXファイルの先頭にYAML形式でメタデータを記述することができます。このフロントマターは自動的に抽出され、`bundleMDX`関数の戻り値として取得できます。

### 動的なオンデマンドバンドリング

mdx-bundlerは、ビルド時だけでなく、ランタイムでのオンデマンドバンドリングも可能です。これにより、コンテンツの変更時に全サイトを再ビルドする必要がなくなります。

### コンポーネントの置き換え

MDXのコンポーネント置き換え機能をサポートしており、`getMDXComponent`から返されるコンポーネントに`components`プロパティを渡すことで、MDX内のHTML要素やコンポーネントをカスタム実装に置き換えることができます。

```tsx
const Paragraph: React.FC = (props) => {
  if (typeof props.children !== 'string' && props.children.type === 'img') {
    return <>{props.children}</>;
  }
  return <p {...props} />;
};

function MDXPage({ code }: { code: string }) {
  const Component = React.useMemo(() => getMDXComponent(code), [code]);
  return (
    <main>
      <Component components={{ p: Paragraph }} />
    </main>
  );
}
```

### 画像のバンドル

remarkプラグイン（remark-mdx-images）を使用して、MDX内の画像もバンドルすることができます。

```typescript
import { remarkMdxImages } from 'remark-mdx-images';

const { code } = await bundleMDX({
  source: mdxSource,
  cwd: '/users/you/site/_content/pages',
  mdxOptions: options => {
    options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkMdxImages];
    return options;
  },
  esbuildOptions: options => {
    options.loader = {
      ...options.loader,
      '.png': 'dataurl', // または 'file'
    };
    return options;
  },
});
```

## オプション

### source

MDXのソースコードを文字列で指定します。`file`オプションと一緒には使用できません。

### file

MDXファイルのパスを指定します。`source`オプションと一緒には使用できません。

### files

バンドルに含めるファイルを指定するオブジェクトです。キーはファイルパス（MDXソースからの相対パス）、値はファイルの内容（文字列）です。

### mdxOptions

MDX設定をカスタマイズするための関数です。remarkプラグインやrehypeプラグインを指定できます。

```typescript
bundleMDX({
  source: mdxSource,
  mdxOptions(options, frontmatter) {
    options.remarkPlugins = [...(options.remarkPlugins ?? []), myRemarkPlugin];
    options.rehypePlugins = [...(options.rehypePlugins ?? []), myRehypePlugin];
    return options;
  },
});
```

### esbuildOptions

esbuildの設定をカスタマイズするための関数です。

```typescript
bundleMDX({
  source: mdxSource,
  esbuildOptions(options, frontmatter) {
    options.minify = false;
    options.target = [
      'es2020',
      'chrome58',
      'firefox57',
      'safari11',
      'edge16',
      'node12',
    ];
    return options;
  },
});
```

### globals

外部モジュールをバンドルから除外し、グローバルに利用できることを指定します。

```typescript
bundleMDX({
  source: mdxSource,
  globals: { 'left-pad': 'myLeftPad' },
});
```

### cwd

カレントワーキングディレクトリを指定します。インポートを解決するために使用されます。

### grayMatterOptions

gray-matterのオプションをカスタマイズするための関数です。

### bundleDirectory & bundlePath

バンドルの出力ディレクトリと公開URL pathを指定します。

## 戻り値

`bundleMDX`関数は、以下のプロパティを持つオブジェクトを返すPromiseを返します：

- `code`: バンドルされたMDXコードを文字列で返します。
- `frontmatter`: gray-matterによって抽出されたフロントマターオブジェクトです。
- `matter`: gray-matterが返す完全なオブジェクト

## 型定義

mdx-bundlerは完全な型定義を提供しています。`bundleMDX`関数は、フロントマターの型を指定する型パラメータを1つ受け取ります。

```typescript
const { frontmatter } = bundleMDX<{ title: string }>({ source });
// frontmatter.title は string型
```

## Next.jsでの使用例

Next.jsでmdx-bundlerを使用する例を以下に示します：

```typescript
// lib/mdx.js
import fs from 'fs';
import path from 'path';
import { bundleMDX } from 'mdx-bundler';
import remarkGfm from 'remark-gfm';
import rehypePrism from 'rehype-prism-plus';

const blogDirectory = path.join(process.cwd(), 'blog');

export function getAllPostSlugs() {
  const fileNames = fs.readdirSync(blogDirectory);
  return fileNames.map(fileName => {
    return {
      params: {
        slug: fileName.replace(/\.mdx$/, '')
      }
    };
  });
}

export async function getPostData(slug) {
  const fullPath = path.join(blogDirectory, `${slug}.mdx`);
  const source = fs.readFileSync(fullPath, 'utf8');

  const { code, frontmatter } = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options?.remarkPlugins ?? []), remarkGfm];
      options.rehypePlugins = [...(options?.rehypePlugins ?? []), rehypePrism];
      return options;
    },
  });

  return {
    slug,
    frontmatter,
    code,
  };
}
```

```jsx
// pages/blog/[slug].js
import { getMDXComponent } from 'mdx-bundler/client';
import { useMemo } from 'react';
import { getAllPostSlugs, getPostData } from '../../lib/mdx';
import CustomImage from '../../components/CustomImage';
import CodeBlock from '../../components/CodeBlock';

export const getStaticProps = async ({ params }) => {
  const postData = await getPostData(params.slug);
  return {
    props: {
      ...postData,
    },
  };
};

export async function getStaticPaths() {
  const paths = getAllPostSlugs();
  return {
    paths,
    fallback: false,
  };
}

export default function BlogPost({ code, frontmatter }) {
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <>
      <h1>{frontmatter.title}</h1>
      <p>{frontmatter.description}</p>
      <p>{frontmatter.date}</p>
      <article>
        <Component components={{
          img: CustomImage,
          pre: CodeBlock,
        }} />
      </article>
    </>
  );
}
```

## 他のMDXツールとの比較

### next-mdx-remote との比較

- **mdx-bundler**: MDXファイル内でのインポートをサポートし、それらの依存関係もバンドルします。
- **next-mdx-remote**: インポートをサポートせず、コンパイラとしての機能のみを提供します。

### Contentlayer との比較

- **mdx-bundler**: MDXコンテンツのバンドルに特化しています。
- **Contentlayer**: MDXのサポートに加えて、コンテンツの解析、検証、自動的な型定義の生成を提供します。

## 注意点

### Cloudflare Workers での制限

Cloudflare Workersでは以下の制限があるため、mdx-bundlerが正常に動作しません：

1. バイナリを実行できない（esbuildはバイナリ）
2. `eval`や類似機能を実行できない（`getMDXComponent`は`new Function`を使用）

### Next.jsでのesbuild ENOENT問題

Next.jsとWebpackの使用時に、esbuildが自身の実行ファイルを見つけられないことがあります。その場合は、以下のコードを`bundleMDX`の前に追加することで解決できます：

```javascript
import path from 'path';

if (process.platform === 'win32') {
  process.env.ESBUILD_BINARY_PATH = path.join(
    process.cwd(),
    'node_modules',
    'esbuild',
    'esbuild.exe',
  );
} else {
  process.env.ESBUILD_BINARY_PATH = path.join(
    process.cwd(),
    'node_modules',
    'esbuild',
    'bin',
    'esbuild',
  );
}
```

## その他の特徴

- React以外のJSXライブラリもサポート（Hono等）
- 名前付きエクスポートへのアクセス（`getMDXExport`関数を使用）
- フロントマターとconstの参照

## まとめ

mdx-bundlerは、MDXコンテンツとその依存関係を高速にバンドルするための強力なツールです。Next.js、Remix、Gatsby、CRAなど様々なフレームワークでシームレスに動作し、MDXファイル内でのインポートやフロントマターなど、高度な機能をサポートしています。ビルド時のバンドルだけでなく、オンデマンドでのバンドルも可能なため、大規模なコンテンツサイトでも効率的に利用できます。

## 参考リンク

- [公式GitHub](https://github.com/kentcdodds/mdx-bundler)
- [MDX公式サイト](https://mdxjs.com/)
- [Next.jsでのMDX Bundler入門](https://www.peterlunch.com/blog/mdx-bundler-beginners)
