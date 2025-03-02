import { BraveSearch } from "jsr:@tyr/brave-search";
import { createParser } from "@mizchi/zodcli";
import { z } from "npm:zod";

const API_KEY = Deno.env.get("BRAVE_SEARCH_KEY");
if (!API_KEY) {
  console.error("Please set BRAVE_SEARCH_KEY environment variable");
  Deno.exit(0);
  // throw new Error("Please set BRAVE_SEARCH_KEY environment variable");
}

const cliSchema = {
  query: {
    positional: 0,
    type: z.string().describe("search query"),
  },
  count: {
    type: z.number().default(5).describe("number of results"),
    short: "c",
  },
  search_lang: {
    type: z.string().default("jp").describe("search language"),
    short: "l",
  },
  country: {
    type: z.string().default("JP").describe("country"),
  },
} as const;

const searchParser = createParser({
  name: "search",
  description: "Search files in directory",
  args: cliSchema,
});

const result = searchParser.safeParse(Deno.args);
if (!result.ok) {
  console.log(result.error);
  Deno.exit(1);
}

const braveSearch = new BraveSearch(API_KEY!);
const query = result.data.query;
const webSearchResults = await braveSearch.webSearch(query, {
  count: 5,
  search_lang: result.data.search_lang,
  country: result.data.country,
});
for (const result of webSearchResults.web?.results || []) {
  console.log("---------");
  console.log(result.title);
  console.log(result.url);
  console.log(result.description);
}
// console.log(webSearchResults);
