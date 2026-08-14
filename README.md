# Portfolio Frontend

React and TypeScript frontend built with Vite.

## Local Development

Requirements: Node.js 24 and npm.

```bash
npm install
npm run dev
```

Before pushing, verify the production build:

```bash
npm run lint
npm run build
```

## GitHub Pages

Pushes to `main` automatically deploy through `.github/workflows/deploy-pages.yml`.

Site: https://zorionten.github.io/portfolio-frontend/

The Vite `base` setting matches the repository name. Change it if the repository is renamed or a custom domain is added.
