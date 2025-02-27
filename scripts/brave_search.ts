import { BraveSearch } from "jsr:@tyr/brave-search";

const API_KEY = Deno.env.get("BRAVE_SEARCH_KEY");
if (!API_KEY) {
  throw new Error("Please set BRAVE_SEARCH_KEY environment variable");
}

import * as Cmd from "npm:cmd-ts";
const foo = Cmd.command({
  name: "foo",
  description: "foo",
  args: {
    number: Cmd.positional({
      type: Cmd.string,
      displayName: "search query",
    }),
    message: Cmd.option({
      long: "greeting",
      type: Cmd.string,
      short: "g",
      description: "The message to print",
    }),
  },
  async handler(args) {
    console.log("foo", args);
    const braveSearch = new BraveSearch(API_KEY!);
    const query = "zod 使い方";
    const webSearchResults = await braveSearch.webSearch(query, {
      count: 5,
      search_lang: "jp",
      country: "JP",
    });
    console.log(webSearchResults);
  },
});

export default foo;

if (import.meta.main) {
  Cmd.run(foo, Deno.args);
}
