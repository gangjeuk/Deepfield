# Deepfield

Vite + TypeScript + React Router + Fumadocs + fumadocs-obsidian 기반 문서 프로젝트입니다.

This project runs on Cloudflare workers, which means it's serverless.

## Commands

```bash
pnpm install
pnpm docs:sync
pnpm dev
pnpm format
pnpm format:check
```

## Structure

- `../Anecdote`: 문서 원본 Vault
- `content/docs`: Fumadocs MDX 입력 경로
- `app`: React Router + Fumadocs UI
- `scripts/generate.ts`: Vault를 문서로 변환하는 스크립트

## Notes

- 기본 Vault 경로는 `../Anecdote`입니다.
- `DOCS_VAULT_DIR=/path/to/vault pnpm docs:sync` 형태로 다른 Vault를 지정할 수 있습니다.
- `.git`, `.obsidian`, `.trash` 디렉터리는 문서 생성과 감시에서 제외됩니다.
- `pnpm docs:sync`는 serverless 배포를 위해 `app/lib/generated/doc-git-history.json`에 문서별 `git log`와 `git diff`를 함께 생성합니다.
