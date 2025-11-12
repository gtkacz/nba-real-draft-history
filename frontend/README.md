# Real Draft History - Frontend

A sleek, elegant Vue.js application for exploring NBA draft history with comprehensive player information and trade chains.

## Tech Stack

- **Vue 3** with Composition API
- **Vite** for fast development and optimized builds
- **TypeScript** with strict type checking
- **Vuetify 3** for Material Design components
- **Pinia** for state management
- **Vue Router** for navigation

## NBA Color Scheme

- **Primary (NBA Blue)**: `#1D428A`
- **Secondary (NBA Red)**: `#C8102E`
- Light and dark theme variants

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Features

- Comprehensive NBA draft history database
- Filter by team or draft year
- Sortable columns
- Draft trade chain visualization
- Team logos from GitHub API
- Light/dark theme support
- First-visit splash screen
- SEO optimized
- Fully responsive design

## Data Attribution

All draft data is sourced from [RealGM](https://basketball.realgm.com/) and used under fair use.

Team logos provided by [NBA Logo API](https://github.com/gtkacz/nba-logo-api).

## Copyright

Copyright 2025 Gabriel Mitelman Tkacz. All rights reserved.
