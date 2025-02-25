// import { command, run, string, number, positional, option } from "npm:cmd-ts";
// import { cdCommand } from "https://jsr.io/@david/dax/0.42.0/src/commands/cd.ts";
import * as Cmd from "npm:cmd-ts";

const hello = Cmd.command({
  name: "hello",
  description: "print something to the screen",
  version: "1.0.0",
  args: {
    number: Cmd.positional({
      type: Cmd.number,
      displayName: "num",
    }),
    message: Cmd.option({
      long: "greeting",
      type: Cmd.string,
      short: "g",
      description: "The message to print",
    }),
  },
  handler(args) {
    console.log(args);
  },
});

const nesting = Cmd.subcommands({
  name: "nesting",
  cmds: { hello },
});

Cmd.run(nesting, Deno.args);
