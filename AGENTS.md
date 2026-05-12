# Repository Guidelines

## Project Structure & Module Organization

This is a WXT Manifest V3 Chrome extension. Extension entrypoints live in `entrypoints/`: `background.ts` owns Chrome API side effects, `options/` contains the full settings dashboard, and `popup/` contains quick controls. Pure, testable logic lives in `src/core/`; Chrome API wrappers live in `src/platform/`; shared React components live in `src/ui/`. Static extension assets are in `public/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies and generate WXT types.
- `npm run dev`: start WXT development mode.
- `npm test`: run Vitest unit tests.
- `npm run typecheck`: run TypeScript checks.
- `npm run build`: build `.output/chrome-mv3` for loading in Chrome.
- `npm run zip`: package the built extension.

## Coding Style & Naming Conventions

Use TypeScript with strict settings. Keep domain logic in `src/core` free of React and Chrome globals. Prefer small, focused files with explicit exported types. React components use PascalCase; functions and variables use camelCase. Keep UI light-only and enterprise-focused: white surfaces, gray panels, compact spacing, and clear validation states.

## Testing Guidelines

Use Vitest for core behavior. Add tests before changing parser, validation, import/export, or proxy config logic. Test files use `*.test.ts` beside the source file, for example `src/core/bypassRules.test.ts`. Run `npm test` and `npm run typecheck` before committing.

## Commit & Pull Request Guidelines

Use concise conventional commit messages such as `feat: add proxy popup controls` or `docs: add usage guide`. Keep commits at useful rollback points: scaffold, core logic, background behavior, UI, and docs. Pull requests should include a summary, verification commands, linked issue if relevant, and screenshots for dashboard or popup UI changes.

## Security & Configuration Tips

Proxy credentials are stored in `chrome.storage.local`, not an OS keychain. Do not log credentials or include them in exported JSON. Keep requested permissions limited to the current Manifest V3 proxy/auth requirements.
