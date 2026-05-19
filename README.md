<p align="center">
  <img src="docs/logo.png" alt="Scribe.AI" width="320" />
</p>

<p align="center">
  <em>An interactive lecture viewer with AI assistants for every class.</em>
</p>

Scribe is a class-aware AI workspace. Students pick a course, drop in a
lecture (PDF, slides, recording), and chat with an AI assistant that
already knows the material — generating practice problems, visualizing
graphs and figures, explaining derivations, and reviewing notes. Sign
in with Microsoft (school email) and your enrolled classes show up
automatically.

![Scribe homepage](docs/homepage.png)

## Demos

Short walkthroughs (most are under a minute). Full-quality copies are
in [`docs/`](./docs).

**Professor demo** — setting up a class, uploading material, configuring the assistant.

https://github.com/user-attachments/assets/18f84f1a-3b44-4a2d-84cd-aa83d816d8d3

**Student demo** — the day-to-day flow: open a class, ask the assistant, get a generated answer.

https://github.com/user-attachments/assets/9f2bede0-21ff-4aaf-8bda-e49a1c4395f1

**Exam mode** — generating practice problems and step-by-step solutions, with show/hide answer toggles.

https://github.com/user-attachments/assets/5a75fb6e-2105-4d49-b23f-9e01663bc7ec

**Analytics** — usage and engagement dashboards for instructors.

https://github.com/user-attachments/assets/9623da30-0ced-485a-918d-bfe38063f17e

**Visualizations** — on-demand figure and graph generation (e.g. MST, derivations).

https://github.com/user-attachments/assets/10c3d392-a4c1-4df5-b13c-48c97d105c0b

**Ready-made content** — pre-built study material that ships with each class.

https://github.com/user-attachments/assets/dc0b09c6-a4bf-40e2-8f5d-f6e7633e69ff

**Privacy & security** — how lecture content and student data are handled.

https://github.com/user-attachments/assets/abf01f5f-2dad-4619-ab75-ec2e819dd678

**Developer mode** — building, configuring, and shipping new assistants.

https://github.com/user-attachments/assets/dac2251d-2944-4787-af16-d61928c5b7a3

## Screenshots

| Login (Microsoft SSO) | AI figure generation |
| --- | --- |
| ![Login](docs/login.png) | ![Figures](docs/figures-demo.png) |

## What's in here

- **`client/`** — Next.js 15 (App Router) + TypeScript frontend. Mantine
  UI, Supabase Auth + DB, Microsoft Graph for school SSO, KaTeX for math
  rendering, TanStack Query/Virtual for data + virtualization.
- **`server/`** — FastAPI (Python 3.12) backend. PDF/document ingest,
  the assistant pipeline, file uploads, served via Gunicorn + Uvicorn.
- **`docker-compose.yml`** — orchestrates client, server, and nginx.
- **`nginx.conf`** — reverse proxy / TLS termination for prod.

## Quick start

```bash
# server (FastAPI, Python 3.12)
cd server
make sync         # creates .venv, installs deps via uv
make run          # http://localhost:8000

# client (Next.js)
cd client
yarn
yarn dev          # http://localhost:3000
```

Or `docker compose up` to bring up the full stack with nginx in front.

A `.env` is required (Supabase project URL/keys, Microsoft Graph app
credentials, OpenAI key for the assistant runtime). No template is
committed; ping the maintainer.

## Branches

- `main` — default, where reviewed work lands
- `prod` — what's deployed

## Authors

Built by [@asarv2 / Ashok Saravanan](https://github.com/asarv2) and
collaborators (see `git log`).
