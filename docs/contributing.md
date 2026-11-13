---
title: "Contributing to Social Stats"
description: "How to contribute to Social Stats: run the backend and frontend test suites, good first areas such as platform integrations, translations, accessibility and React tests, and the code of conduct."
---

# Contributing

Social Stats is an open codebase and pull requests are welcome. Read
[CONTRIBUTING.md](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/CONTRIBUTING.md)
and the
[Code of Conduct](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/CODE_OF_CONDUCT.md)
before you start.

## Run the tests

```bash
# backend: 400 tests
cd backend && python manage.py test social_stats

# frontend: Jest + React Testing Library
cd frontend && CI=true npm test
```

Both suites should stay green.

## Good places to start

- **New platform integrations**, for any of the major social or messaging APIs.
- **Translations** for the marketing pages.
- **Accessibility** improvements.
- **Tests for the React app.** It has 39 test cases in 8 files against 400 on the
  backend, so new frontend tests are especially welcome.

## Report a problem

Open an [issue](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/issues)
for a bug or a rough edge. Security reports go through
[SECURITY.md](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/SECURITY.md)
instead, never a public issue.

Starring the repository helps other people find it.
