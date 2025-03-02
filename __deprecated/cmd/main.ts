// sub command host
import { run, subcommands } from "npm:cmd-ts";
import fs from "node:fs";

const currentDir = new URL(".", import.meta.url).pathname;
const files = fs
  .readdirSync(currentDir)
  .filter((file) => file.endsWith(".ts") && file !== "main.ts")
  .map((file) => file.replace(/\.ts$/, ""));
const cmds: Record<string, any> = {};
for (const file of files) {
  const fullpath = new URL(`./${file}.ts`, import.meta.url).pathname;
  const mod = await import(fullpath);
  cmds[file] = mod.default;
}

const nesting = subcommands({
  name: "lab",
  cmds: cmds,
});

if (import.meta.main) {
  run(nesting, Deno.args);
}

export default nesting;
