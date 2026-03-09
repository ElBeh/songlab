# Conventions – SongLab

## Code Style
- **Formatter**: Prettier (default config)
- **Linter**: ESLint with typescript-eslint
- **Quotes**: Single quotes
- **Semicolons**: Yes
- **Indent**: 2 spaces
- **Max line length**: 100 characters (soft limit)
- **Trailing commas**: ES5-style

## Naming Conventions
- **Files**: PascalCase for components (`WaveformPlayer.tsx`), camelCase for utilities (`formatTime.ts`)
- **Components**: PascalCase (`SectionMarker`)
- **Hooks**: camelCase with `use` prefix (`useAudioPlayer`)
- **Types/Interfaces**: PascalCase with no prefix (`SongData`, not `ISongData`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PLAYBACK_RATE`)
- **CSS classes**: Tailwind utilities only, no custom CSS unless unavoidable

## Project Structure Rules
- One component per file
- Co-locate component-specific types in the same file (extract to `types/` only if shared)
- Keep components under 150 lines; extract logic into hooks if larger
- No default exports except for page-level components

## Language
- All code comments in English
- All UI labels in English
- All console/log output in English
- Variable and function names in English

## State Management
- Local state: React `useState` / `useReducer`
- Shared state: Zustand (lightweight, minimal boilerplate)
- No Redux

## Error Handling
- User-facing errors: Toast notification (non-blocking)
- Console errors: `console.error()` with context message
- Audio loading failures: Fallback UI with retry option

## Testing (later phases)
- Framework: Vitest + React Testing Library
- Focus on integration tests over unit tests
- Test file naming: `ComponentName.test.tsx`

## Git
- Commit messages: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- Branch naming: `feat/short-description`, `fix/short-description`
- Main branch: `main`
