# @mizchi/zodcli

Type-safe command-line parser module using Zod

## Overview

ZodCLI is a Deno module for easily building type-safe command-line interfaces using [Zod](https://github.com/colinhacks/zod) schemas. With this module, you can parse command-line arguments, validate inputs, and generate help messages in a type-safe manner.

## Features

- **Type-Safe**: Type-safe CLI parser based on Zod schemas
- **Automatic Help Generation**: Automatically generates help text from command structures
- **Positional Arguments and Options Support**: Supports both positional and named arguments
- **Subcommand Support**: Supports subcommand structures like git
- **Default Values**: Leverages Zod features for setting default values
- **Validation**: Powerful input validation with Zod schemas
- **JSON Schema Conversion**: Convert Zod schemas to JSON schemas

## Installation

```bash
deno add jsr:@mizchi/zodcli
```

```typescript
// deno.json
{
  "imports": {
    "zodcli": "./zodcli/mod.ts"
  }
}
```

Or import directly:

```typescript
import { createCommand } from "jsr:@mizchi/zodcli";
```

## Basic Usage

```typescript
import { createCommand, run } from "./zodcli/mod.ts";
import { z } from "npm:zod";

// Define a command
const searchCommand = createCommand({
  name: "search",
  description: "Search with custom parameters",
  args: {
    query: {
      type: z.string().describe("search query"),
      positional: true,
    },
    count: {
      type: z.number().optional().default(5).describe("number of results"),
      short: "c",
    },
    format: {
      type: z.enum(["json", "text", "table"]).default("text"),
      short: "f",
    },
  },
});

// Parse arguments
const result = searchCommand.parse(Deno.args);

// Process results
run(result, (data) => {
  console.log(`Searching for: ${data.query}, count: ${data.count}, format: ${data.format}`);
  // Actual processing...
});
```

## Using Subcommands

```typescript
import { createSubCommandMap } from "./zodcli/mod.ts";
import { z } from "npm:zod";

// Define subcommands
const gitCommands = createSubCommandMap({
  add: {
    name: "git add",
    description: "Add files to git staging",
    args: {
      files: {
        type: z.string().array().describe("files to add"),
        positional: true,
      },
      all: {
        type: z.boolean().default(false).describe("add all files"),
        short: "a",
      },
    },
  },
  commit: {
    name: "git commit",
    description: "Commit staged changes",
    args: {
      message: {
        type: z.string().describe("commit message"),
        positional: true,
      },
      amend: {
        type: z.boolean().default(false).describe("amend previous commit"),
        short: "a",
      },
    },
  },
});

// Parse subcommands
const result = gitCommands.parse(Deno.args, "git", "Git command line tool");

// Process results including subcommands
run(result, (data, subCommandName) => {
  if (subCommandName) {
    console.log(`Running git ${subCommandName}`);
    // Process based on subcommand
    if (subCommandName === "add") {
      console.log(`Adding files: ${data.files.join(", ")}`);
    } else if (subCommandName === "commit") {
      console.log(`Committing with message: ${data.message}`);
    }
  }
});
```

## Supported Types

- `z.string()` - Strings
- `z.number()` - Numbers (automatically converted from strings)
- `z.boolean()` - Booleans
- `z.enum()` - Enumerations
- `z.array()` - Arrays (for positional arguments or multiple option values)
- `z.optional()` - Optional values
- `z.default()` - Fields with default values

## Testing

```bash
deno test .
```

## Usage Examples

```bash
# Display help
deno run -A zodcli/examples/cli.ts --help

# Run search command
deno run -A zodcli/examples/cli.ts "search query" --count 10 --format json

# Run subcommand
deno run -A zodcli/examples/cli.ts add file1.txt file2.txt --all
```

## License

MIT

## Localized Documentation

- [日本語版 (Japanese)](./README.ja.md)