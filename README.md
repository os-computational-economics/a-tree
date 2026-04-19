# A-Tree

Gen-AI powered experimental economics research platform.

A-Tree lets researchers design and run experimental economics studies that involve generative AI. Researchers define experiments via JSON configuration; participants join with a 6-digit code and progress through trials, rounds, and steps. The platform also includes a general LLM chat product, admin tools for managing users, experiments, and content, and built-in support for OTP and passkey authentication.

## Repository structure

```
a-tree/
├── client/    # Next.js application (UI, API routes, business logic)
└── server/    # Small FastAPI service (currently a WebSocket demo, ancillary)
```

The `client/` directory contains the main application. The `server/` directory is a separate Python service used for local experimentation.

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19, TypeScript
- **UI:** HeroUI, Tailwind CSS 4, Framer Motion
- **State:** Redux Toolkit
- **Database:** PostgreSQL via Drizzle ORM
- **Auth:** JWT (jose) + WebAuthn passkeys (@simplewebauthn) + OTP (email)
- **LLM:** OpenAI SDK (Anthropic provider also wired in)
- **Storage:** AWS S3 (chat history)
- **i18n:** next-intl (en, zh-CN)
- **Server (ancillary):** FastAPI (Python 3.12+)

## Getting started

### Prerequisites

- Node.js 24 (matches the Dockerfile base image)
- A PostgreSQL database (local or hosted)
- AWS credentials with S3 access (for chat history storage)
- An OpenAI API key
- An SMTP account for sending OTP emails (Gmail with an app password works)

### 1. Clone and install

```bash
git clone https://github.com/os-computational-economics/a-tree.git
cd a-tree/client
npm install
```

### 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

Required variables (see `client/.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | OTP email delivery |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET_NAME` | S3 access for chat history |
| `LLM_API_KEY` | OpenAI API key |
| `MAINTENANCE_MODE` | `true` to enable maintenance redirect |

The `.env` file is gitignored. Collaborators need to obtain it through a secure channel (not via the repo).

### 3. Set up the database

```bash
npm run db:create     # create the database (if it does not exist)
npm run db:migrate    # apply migrations
```

Optional: open a database GUI with `npm run db:studio`.

### 4. Run the dev server

```bash
npm run dev
```

The app starts on the port configured by Next.js (default `http://localhost:3000`).

## Available scripts

Run from `client/`:

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run db:create` | Create the database |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly to the database (dev only) |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

## Development workflow

This project uses a `main` / `dev` branching model:

- **`main`** — production-ready, deployable. Protected; changes only land via pull request.
- **`dev`** — default integration branch. Day-to-day work happens here or on short-lived feature branches.
- **`feature/*`** — for non-trivial changes; branch off `dev`, PR back into `dev`.

Typical flow:

```bash
git checkout dev && git pull
git checkout -b feature/my-change
# ...work, commit...
git push -u origin feature/my-change
# Open PR into dev, review, squash-merge, branch is auto-deleted
```

When `dev` is stable and ready to release, open a PR from `dev` into `main`.

## Deployment

Production deployment lives outside this repo and is currently performed manually. CI/CD automation is planned. Until then, deployment requires coordination with whoever maintains the production environment.

## Server (Python, ancillary)

The `server/` directory contains a small FastAPI service used for WebSocket experimentation. It is not part of the main application and is not required to run the client.

```bash
cd server
uv sync
uv run fastapi dev app.py
```

## License

Internal / unspecified. See repository owner before redistributing.
