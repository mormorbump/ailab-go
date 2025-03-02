# Deno + TypeScript Development Guidelines

## Build Commands

- Run tests: `deno test -A`
- Run single test: `deno test -A path/to/file.test.ts`
- Run tests with coverage: `deno task test:cov`
- Lint: `deno lint`
- Format: `deno fmt`
- Check dependencies: `deno task check:deps`
- Run script: `deno run -A scripts/script.ts`

## Code Style

- **Imports**: Use JSR imports (`jsr:@std/expect`) or npm imports (`npm:zod`).
  Avoid deno.land/x URLs.
- **Modules**: Import from mod.ts only. Use relative paths within modules.
- **Testing**: Use `@std/expect` and `@std/testing/bdd`. Follow pattern:
  `expect(result, "description").toBe(expected)`.
- **Types**: Prefer specific types over `any`. Use `unknown` with type
  narrowing.
- **Error Handling**: Use Result type from neverthrow rather than exceptions.
- **Functions vs Classes**: Prefer functions when stateless. Use classes only
  when state is needed.
- **Pattern**: Use Adapter pattern to abstract external dependencies for
  testing.
- **Comments**: Describe file specs in comments. Document public interfaces.
- **Naming**: Use meaningful type names (UserId vs string).

## Implementation Modes

- **Script Mode**: Single file with tests included. Mark with `@script` comment.
- **Module Mode**: Multi-file structure with re-exports through mod.ts.
- **Test-First Mode**: Write types and tests before implementation.

Run `deno task build:prompt` to update rules from .cline directory.
