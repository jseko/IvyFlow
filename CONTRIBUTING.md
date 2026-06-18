# Contributing to IvyFlow

Thank you for considering contributing to IvyFlow! This document outlines the process for contributing to the project.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/liuzhupeng/ivyflow/issues)
2. If not, create a new issue using the Bug Report template
3. Include: description, reproduction steps, expected vs actual behavior, environment details

### Feature Requests

1. Open a Feature Request issue using the template
2. Describe the problem and proposed solution
3. For major changes, consider writing an RFC first (see `docs/rfc/`)

### Pull Requests

1. Fork the repository and create a branch from `main`
2. Follow the coding conventions
3. Add or update tests as needed
4. Ensure all tests pass: `npm test`
5. Ensure the build passes: `npm run build`
6. Update documentation if needed
7. Submit a PR using the PR template

## Development Setup

```bash
npm install
npm run build
npm test
```

## Coding Conventions

- TypeScript strict mode
- No `any` types (use `unknown` instead)
- No `require()` (use ESM `import`)
- Tests use Vitest
- Follow existing code style — files under `render/` ≤ 50 lines, `index.ts` ≤ 30 lines

## Commit Style

Use clear, concise commit messages in English. Reference issues when relevant.

## RFC Process

For significant changes (new features, schema changes, breaking changes), create an RFC in `docs/rfc/` before implementation. See `docs/rfc/template.md`.
