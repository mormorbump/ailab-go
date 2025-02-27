import { BraveSearch } from "jsr:@tyr/brave-search";

const API_KEY = Deno.env.get("BRAVE_SEARCH_KEY");
if (!API_KEY) {
  throw new Error("Please set BRAVE_SEARCH_KEY environment variable");
}

type QueryBase<R, T extends number | undefined> = {
  type: R;
  positional?: number;
  short?: string;
  default?: T;
  optional?: boolean;
  description?: string;
};

const SearchQueryDef = {
  query: {
    positional: 0,
    type: "string",
  },
  count: {
    type: "number",
    default: 5,
  },
  search_lang: {
    type: "string",
    default: "en",
  },
  // search_lang: string;
  // country: string;
} as const satisfies Record<string, QueryBase<any, any>>;

type Query = {
  query: {
    positional: 0;
    type: string;
  };
  count: number;
  search_lang: string;
  country: string;
};

// import { BraveSearch } from "jsr:@tyr/brave-search";

import * as Cmd from "npm:cmd-ts";
const foo = Cmd.command({
  name: "foo",
  description: "foo",
  args: {
    query: Cmd.positional({
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
    // console.log("foo", args);
    const braveSearch = new BraveSearch(API_KEY!);
    const query = args.query;
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
