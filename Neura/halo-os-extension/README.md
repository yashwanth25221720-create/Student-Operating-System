# Halo OS

Halo OS is a Manifest V3 Chrome extension that replaces the New Tab page with a productivity command center.

## Stack

- React + TypeScript + Vite
- Chrome Extension Manifest V3
- Chrome Storage API with localStorage fallback for dev
- Chrome Bookmarks, Tabs, and Tab Groups permissions
- Modular dashboard, search, AI, bookmarks, notes, tasks, workspaces, tab group, and settings components

## Run Locally

```bash
npm install
npm run dev
```

Open the printed Vite URL for browser-based development.

## Build Extension

```bash
npm run build
```

Load `dist` as an unpacked extension from `chrome://extensions`.

## MVP Features

- Collapsible left sidebar with Home, Bookmarks, Notes, Tasks, Tab Groups, AI Hub, Workspaces, and Settings.
- Top universal search across bookmarks, notes, tasks, workspaces, and saved tab groups.
- Scrollable AI provider dock for ChatGPT, Claude, Gemini, Grok, DeepSeek, Perplexity, and custom providers.
- Query launching with `{query}` URL template replacement.
- Chrome bookmark import and favorite cards.
- Quick, Markdown, and website-domain notes with auto-save.
- Task tracking with due dates, priorities, categories, and completion state.
- Workspace switching and custom workspace creation.
- Save and restore current Chrome tabs as named groups.
- Draggable dashboard widget ordering and widget visibility settings.

## Architecture Notes

The app state is intentionally centralized in `src/state/HaloStateContext.tsx`, while Chrome-specific behavior stays behind `src/lib/chromeApi.ts`. Persisted data is typed in `src/types/halo.ts` and version-friendly defaults live in `src/storage/defaultState.ts`.

Future integrations such as Notion sync, AI APIs, cloud sync, browser history, calendar, Gmail, and a sidebar assistant can be added as services without rewriting the view modules.
