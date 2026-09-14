# Contributing to Plethscape

Thanks for looking at the code. This is a small educational project; contributions are welcome but keep changes focused.

## Getting started

```sh
nvm use
npm ci
npm run dev
```

## Before you open a PR

1. Run the full checks locally:
   ```sh
   npm run build
   npm test
   npm run test:e2e
   npm run format
   ```
2. Keep changes scoped. Don't mix a feature with a formatting pass.
3. If you touch the PPG simulation (`src/simulation.ts`) or anatomy sourcing, explain the reasoning in the PR: this project prioritizes being an honest teaching model over "looking more impressive."
4. If you touch the anatomy pipeline (`scripts/`), note whether you regenerated `public/models/*.glb` and how you verified it.
5. E2E specs should reflect the actual UI. If a spec is stale, fix the spec to match the intended behavior, don't inflate timeouts to paper over a real regression.

## PR checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes locally
- [ ] `npm run format` was run
- [ ] No new dependencies unless discussed first
- [ ] No secrets, API keys, or internal URLs in the diff

## Discussion

Open a GitHub issue on this repo for bugs, questions or proposals before large changes.
