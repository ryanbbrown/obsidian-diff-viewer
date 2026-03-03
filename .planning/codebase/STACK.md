# Technology Stack

**Analysis Date:** 2026-03-03

## Languages

**Primary:**
- TypeScript 5.8.3 - All source code in `src/` directory

**Secondary:**
- JavaScript (Node.js) - Build configuration and tooling

## Runtime

**Environment:**
- Node.js (specified via package.json "type": "module")

**Package Manager:**
- npm (confirmed via package-lock.json)
- Lockfile: present

## Frameworks

**Core:**
- Obsidian Plugin API (latest) - Main framework for Obsidian.md plugin development
- CodeMirror 6 (@codemirror/merge 6.7.6) - Diff viewer UI and merge interface

**Build/Dev:**
- TypeScript (5.8.3) - Type checking and compilation
- esbuild (0.25.5) - Module bundling and minification
- ESLint (9.30.1) - Code linting
- typescript-eslint (8.35.1) - TypeScript-aware linting rules

## Key Dependencies

**Critical:**
- `obsidian` (latest) - Obsidian.md plugin API, provides App, Plugin, Editor, View abstractions
- `@codemirror/merge` (6.7.6) - CodeMirror merge/diff view component for displaying side-by-side diffs
- `@codemirror/view` - CodeMirror view rendering (external: not bundled)
- `@codemirror/state` - CodeMirror editor state management (external: not bundled)

**Infrastructure:**
- `tslib` (2.4.0) - Runtime library for TypeScript helpers
- `jiti` (2.6.1) - TypeScript runtime loader for ESM configuration
- `@types/node` (16.11.6) - Node.js type definitions for dev tooling

**Dev Tools:**
- `eslint-plugin-obsidianmd` (0.1.9) - ESLint rules specific to Obsidian plugin development
- `globals` (14.0.0) - Global variable definitions for linting
- `@eslint/js` (9.30.1) - ESLint recommended configuration

## Configuration

**Build Configuration:**
- Entry point: `src/main.ts`
- Output: `main.js` (CommonJS format)
- Target: ES2018
- Source maps: inline for development, disabled for production
- Tree shaking: enabled
- Minification: enabled in production mode

**TypeScript Configuration:**
- File: `tsconfig.json`
- Target: ES6
- Module: ESNext
- Lib: DOM, ES5, ES6, ES7
- Strict mode: enabled
  - noImplicitAny: true
  - noImplicitThis: true
  - noImplicitReturns: true
  - strictNullChecks: true
  - strictBindCallApply: true
  - noUncheckedIndexedAccess: true
  - useUnknownInCatchVariables: true
- Module resolution: node
- Import helpers: true (uses tslib)
- Inline source maps: true
- Base URL: `src` (enables `src/` as base for imports)

**ESLint Configuration:**
- File: `eslint.config.mts` (flat config format)
- Parser: TypeScript ESLint with projectService enabled
- Extends: eslint-plugin-obsidianmd recommended rules
- Ignores: node_modules, dist, main.js, version-bump.mjs, esbuild.config.mjs, eslint.config.js, versions.json

## External Dependencies (Not Bundled)

The following CodeMirror packages are marked as external in esbuild config and provided by Obsidian:
- `obsidian`
- `electron`
- `@codemirror/autocomplete`
- `@codemirror/collab`
- `@codemirror/commands`
- `@codemirror/language`
- `@codemirror/lint`
- `@codemirror/search`
- `@codemirror/state`
- `@codemirror/view`
- `@lezer/common`
- `@lezer/highlight`
- `@lezer/lr`

## Platform Requirements

**Development:**
- TypeScript compiler
- Node.js with npm
- Build tool (esbuild)

**Production:**
- Obsidian application (>= 0.15.0 from manifest.json minAppVersion)
- Desktop platform only (isDesktopOnly: true in manifest.json)

---

*Stack analysis: 2026-03-03*
