# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension built with WXT (Web Extension Tools) and Vue 3. The extension includes a popup UI, background script, and content script that targets Google pages.

## Development Commands

### Development
- `npm run dev` - Start development server for Chrome (default)
- `npm run dev:firefox` - Start development server for Firefox
- `npm run compile` - Type check without emitting files

### Build & Distribution
- `npm run build` - Build production version for Chrome
- `npm run build:firefox` - Build production version for Firefox
- `npm run zip` - Create distribution zip for Chrome
- `npm run zip:firefox` - Create distribution zip for Firefox

### Post-Install
- `npm run postinstall` - Runs automatically after npm install, prepares WXT environment

## Architecture

### Extension Entry Points

The extension uses WXT's convention-based file structure with three main entry points located in `entrypoints/`:

1. **Background Script** (`entrypoints/background.ts`)
   - Service worker/background process
   - Uses `defineBackground()` helper from WXT
   - Has access to full browser APIs

2. **Content Script** (`entrypoints/content.ts`)
   - Runs in web page context
   - Currently configured to match `*://*.google.com/*`
   - Uses `defineContentScript()` with matches configuration

3. **Popup** (`entrypoints/popup/`)
   - Vue 3 SPA mounted to popup UI
   - Entry point: `entrypoints/popup/main.ts`
   - Root component: `entrypoints/popup/App.vue`
   - Includes its own `index.html` and `style.css`

### Component Structure

- `components/` - Shared Vue components
  - `HelloWorld.vue` - Example component with reactive state

### Configuration

- `wxt.config.ts` - WXT configuration with Vue module enabled
- `tsconfig.json` - Extends auto-generated `.wxt/tsconfig.json`
- TypeScript definitions auto-generated in `.wxt/types/`

### Build Output

- `.output/` - Generated extension files (Chrome/Firefox specific builds)
- `.wxt/` - Auto-generated WXT types and internal files

## WXT Framework Specifics

This project uses the WXT framework, which provides:
- Auto-imports for Vue, browser APIs, and WXT utilities (see `.wxt/types/imports.d.ts`)
- Convention-based routing via the `entrypoints/` directory
- Built-in TypeScript support with generated types
- Multi-browser build targets (Chrome, Firefox)
- HMR (Hot Module Reload) for development

When adding new entry points (background scripts, content scripts, popups, options pages), place them in `entrypoints/` following WXT naming conventions.

## Key Dependencies

- **wxt** - Web extension framework
- **@wxt-dev/module-vue** - Vue 3 integration for WXT
- **vue** - UI framework (v3.5+)
- **typescript** - Type checking
- **vue-tsc** - Vue TypeScript compiler
