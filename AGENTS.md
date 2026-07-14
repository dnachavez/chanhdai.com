# AI agent guidelines for chanhdai.com

Next.js 16 (App Router) portfolio and blog website.

**Stack**: TypeScript, React 19, Tailwind CSS v4, shadcn/ui, MDX, Vitest, pnpm, Vercel

## Project structure

| Directory                              | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `src/app/`                             | App Router pages, layouts, API routes                  |
| `src/components/`                      | Shared UI components                                   |
| `src/features/`                        | Feature modules: `doc`, `blog`, `portfolio`            |
| `src/config/`                          | Site (`site.ts`), JSON-LD config                       |
| `src/hooks/`, `src/lib/`, `src/utils/` | Hooks, libraries, utilities                            |

**Key files**: `components.json` (shadcn config), `src/features/portfolio/data/` (portfolio data), `.env.example` (env vars)

## Content system

All content lives in `src/features/doc/content/` as MDX files under the `blog/` folder. The category is derived from the immediate subfolder name (not declared in frontmatter), so a file's location determines its category.

- **Data layer**: `src/features/doc/data/documents.ts` (`getAllDocs`, `getDocBySlug`, `getDocsByCategory`, `getBlogPosts`)
- **Blog UI**: `src/features/blog/` (rendering only, imports data from `features/doc`)

## Coding guidelines

- TypeScript strict mode; explicit types when necessary
- kebab-case file naming
- Descriptive names; comments only for "why", not "what"
- No emojis in code, comments, or commit messages
- Tailwind CSS v4 syntax; support dark/light modes
- Follow SOLID principles
- Headings in sentence-case (capitalize only the first word and proper nouns), applies to Markdown/MDX docs and prose

## Commands

```bash
pnpm dev                # Dev server
pnpm build              # Production build (runs registry:build first)
pnpm test               # Vitest (watch)
pnpm test:run           # Vitest (single run)
pnpm lint               # ESLint
pnpm lint:fix           # ESLint with --fix
pnpm format:write       # Prettier
pnpm check-types        # Type checking (tsc --noEmit)
```
