import * as Cmd from "npm:cmd-ts";

const bar = Cmd.command({
  name: "bar",
  description: "bar",
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
    console.log("bar", args);
  },
});

export default bar;

if (import.meta.main) {
  Cmd.run(bar, Deno.args);
}
