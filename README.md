# Codesetu Monorepo

Welcome to the **Codesetu** development monorepo. This workspace contains a clean, pre-configured frontend and backend using **Turborepo** and **pnpm workspaces**.

## Monorepo Structure

```text
├── apps/
│   ├── web/      # Frontend app (Next.js 16 with App Router)
│   └── server/   # Backend app (Express.js API server in TypeScript)
├── packages/
│   ├── ui/       # Shared UI components package
│   ├── eslint-config/      # Shared ESLint configuration
│   └── typescript-config/  # Shared TypeScript configuration
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Installation

Install workspace dependencies from the root directory:

```bash
pnpm install
```

### Development

Start the development server for all projects concurrently:

```bash
pnpm dev
```

This commands spins up:
- The frontend Next.js app at [http://localhost:3000](http://localhost:3000)
- The backend Express.js server at [http://localhost:5001](http://localhost:5001)

### Utility Commands

- **Build all applications**: `pnpm build`
- **Lint all workspaces**: `pnpm lint`
- **Check types**: `pnpm check-types`
- **Format codebase**: `pnpm format`
