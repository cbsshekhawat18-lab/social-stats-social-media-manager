# Contributing to Social Stats

Thanks for your interest in improving **Social Stats**, an open-source social
media management and marketing platform. Contributions of all sizes are welcome
— bug reports, docs, tests, and features.

## Getting set up

Follow the **Self-hosting / installation** section in the [README](./README.md).
The fastest path to a working environment:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py demo_setup        # seeds demo accounts + 90 days of analytics
python manage.py runserver
```

In a second shell:

```bash
cd frontend && npm install && npm start
```

## Development workflow

1. Fork the repo and create a topic branch off `main`
   (`git checkout -b fix/short-description`).
2. Make your change. Keep it focused — one logical change per PR.
3. Run the tests (see below) and make sure they pass.
4. Open a pull request using the PR template. Describe **what** changed and
   **why**, and link any related issue.

## Tests must stay green

```bash
# Backend (267 tests)
cd backend && python manage.py test social_stats

# Frontend (Jest)
cd frontend && CI=true npm test
```

If you add backend functionality, add or update tests in `social_stats/tests`.
The React test suite is thin today — frontend test contributions are especially
welcome.

## Good areas to contribute

- **New platform integrations** — any of the major social or messaging APIs.
- **Translations** for the marketing pages (no i18n layer exists yet — wiring
  one up is a great larger contribution).
- **Accessibility (a11y)** improvements across the app shell and forms.
- **Frontend test coverage** — the React app has only a handful of tests today.
- **Notification delivery** — WhatsApp and browser push are stubbed/logged in
  `notification_dispatcher.py`; real delivery is wanted.

Check the [issues labeled `good first issue`](../../issues?q=label%3A%22good+first+issue%22)
to find something scoped for a first contribution.

## Coding conventions

- **Python** — follow the existing style; the repo ships a
  `.pre-commit-config.yaml`, so run `pre-commit install` once and let it format
  and lint your commits.
- **JavaScript/React** — match the surrounding code (functional components,
  hooks, TanStack Query for data fetching, Zustand for local state). Use the
  existing `ui/` primitives rather than introducing new component libraries.
- Keep claims in docs and marketing copy truthful to what the code actually does.

## Add a screenshot

The README references `docs/screenshot.png`. If you capture a clean screenshot or
GIF of the analytics dashboard or composer, a PR adding it to `docs/` is a
genuinely high-impact contribution — it's the first thing visitors see.

## Reporting bugs & requesting features

Use the issue templates (Bug report / Feature request). For **security** issues,
do **not** open a public issue — follow [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
