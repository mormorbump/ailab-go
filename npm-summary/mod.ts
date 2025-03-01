/**
 * npm-summary
 *
 * npmパッケージの型定義ファイルを取得し、解析するモジュール。
 *
 * @module npm-summary
 */

// 型定義のエクスポート
export type { GetPackageFilesOptions, Package } from "./types.ts";

// 主要な関数のエクスポート
export {
  convertToDefinitionPath,
  extractTypeInfo,
  findDtsFile,
  formatImportPath,
  generateSummary,
  getEntrypoints,
  getPackageFiles,
  listPackageFiles,
  normalizePath,
  readPackageFile,
} from "./lib.ts";
