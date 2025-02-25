import * as Cmd from "npm:cmd-ts";

const foo = Cmd.command({
  name: "foo",
  description: "foo",
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
    console.log("foo", args);
  },
});

export default foo;

if (import.meta.main) {
  Cmd.run(foo, Deno.args);
}
