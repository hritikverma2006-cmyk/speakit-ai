# SpeakIT AI

A full-stack English communication practice app for students and early-career job seekers. It combines a Next.js app, a FastAPI API, PostgreSQL, Supabase Auth, OpenAI text feedback, and browser WebRTC voice practice. The product uses real provider integrations when configured; it does not return simulated AI answers.

## Project layout

```text
src/
  app/                 Next.js landing, account, dashboard, practice and notebook routes
  components/          Auth gate, navigation and WebRTC voice room
  lib/                 Supabase client and authenticated API helper
backend/
  app/                 FastAPI, JWT verification, SQLAlchemy models, API and AI prompts
  alembic/             PostgreSQL migration history
  tests/               Backend unit tests
  requirements.txt
Dockerfile             Next.js production image
docker-compose.yml     PostgreSQL + API + frontend
```

## Requirements

- Node.js 20.9 or newer and npm.
- Python 3.11 or newer.
- A Supabase project with email/password authentication enabled.
- An OpenAI API key with access to the configured Realtime and text models to use AI features.
- Docker Desktop is optional and recommended for a local PostgreSQL instance.

Provider model availability, pricing, free tiers, quotas, and retention policies can change. SpeakIT voice use is capped by `OPENAI_DAILY_VOICE_MINUTES`; OpenAI charges may still apply.

## Configure providers

1. Copy `.env.example` to `.env` for the backend and to `.env.local` for Next.js.

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item .env.example .env.local
   ```

   macOS/Linux:

   ```sh
   cp .env.example .env
   cp .env.example .env.local
   ```

2. In Supabase, enable email/password sign-in. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`; set `SUPABASE_URL` in `.env`. The browser key is the publishable/anon key, not the service-role key. Backend JWT verification uses the project's asymmetric JWKS endpoint. Use Supabase asymmetric JWT signing keys (ES256 or RS256) for this deployment.
3. Add your OpenAI API key only to backend `.env` as `OPENAI_API_KEY`. Never set it as a `NEXT_PUBLIC_*` variable. Check that your account can use the model names in `.env` (`gpt-realtime`, `gpt-4o-mini`, and transcription model `gpt-4o-mini-transcribe`) or change the server-side values to models enabled for your account. The current OpenAI API schema lists the realtime client-secret and SDP-call endpoints, short-lived `client_secret.value` response shape, `gpt-realtime` model, and `response.output_audio_transcript.done` event used by the client.
4. Set `SUPABASE_SERVICE_ROLE_KEY` only if you want the account-deletion endpoint enabled. Keep it private and backend-only. It is not used in frontend code.
5. Configure Supabase's Site URL and allowed redirect URLs for `http://localhost:3000`, `/onboarding`, and `/auth/update-password`.

Official provider references:

- [OpenAI Realtime API with WebRTC](https://platform.openai.com/docs/guides/realtime-webrtc)
- [OpenAI Realtime client secrets and API reference](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/jwts)

The app requests a short-lived Realtime client secret from the backend. The browser then sends its WebRTC SDP offer directly to OpenAI using that ephemeral credential. The permanent API key never enters browser code. Provider access is required for AI-generated feedback and voice sessions; without it, the daily challenge remains available as self-guided practice, and learners can add personal notes and compare against their own saved corrections. The app clearly distinguishes this mode from AI feedback and never invents a score or correction.

## Run locally

### Option A: Docker Compose

After configuring `.env` and `.env.local`, from the project root:

```powershell
docker compose up --build
```

Open `http://localhost:3000`. The API is at `http://localhost:8000`; OpenAPI docs are at `http://localhost:8000/docs`. Compose starts PostgreSQL and applies Alembic migrations before the API starts. Stop services with `Ctrl+C`; use `docker compose down` to stop and preserve the database volume. `docker compose down -v` deletes the local database volume.

### Option B: run services separately

Start PostgreSQL on port 5432 and ensure `DATABASE_URL` in `.env` points to it. Or start just the Compose database:

```powershell
docker compose up -d db
```

Install/start the API in PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
$env:PYTHONPATH = ".\backend"
alembic -c backend\alembic.ini upgrade head
uvicorn app.main:app --app-dir backend --reload
```

If PowerShell blocks venv activation, run the venv's executables directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
$env:PYTHONPATH = ".\backend"
.\.venv\Scripts\alembic.exe -c backend\alembic.ini upgrade head
.\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --reload
```

macOS/Linux:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
export PYTHONPATH=backend
alembic -c backend/alembic.ini upgrade head
uvicorn app.main:app --app-dir backend --reload
```

In a second terminal at the project root:

```sh
npm install
npm run dev
```

Next.js reads `.env.local`; the API reads root `.env`. Both use the values in `.env.example` as a starting point. A local SQLite fallback exists for development only; production runs require PostgreSQL and Alembic migrations.

## Tests and checks

```powershell
# From the project root
npm install
npm test
npm run build

# With the backend virtual environment active
$env:PYTHONPATH = ".\backend"
pytest backend\tests
```

The current tests cover prompt construction and the frontend's authenticated API helper. Provider integration tests require valid Supabase/OpenAI credentials and are not represented as passing without those credentials.

## API outline

- `GET /health`, `GET /api/me`, `GET/PUT /api/preferences`
- `POST /api/realtime-session` returns a short-lived client credential after verifying the current user
- `POST /api/feedback` returns schema-validated language feedback
- `POST/GET /api/sessions`, `GET /api/sessions/{id}`, and `POST /api/sessions/{id}/complete`
- `GET/POST /api/mistakes`, `PATCH/DELETE /api/mistakes/{id}`
- `GET /api/analytics/summary`, `GET /api/learning-plan`, `POST /api/practice/exercise`
- `GET /api/me/export`, `DELETE /api/me` (requires backend-only Supabase service-role key and explicit confirmation)

User-specific routes derive identity from a verified Supabase JWT; user IDs from request bodies are not trusted. Session duration is calculated by the API from server timestamps. Transcript turns are persisted only when the user opted in when starting the session. Raw audio is not stored by SpeakIT.

## Deployment checklist

- Use managed PostgreSQL, HTTPS, and environment secret storage. Never commit `.env`/`.env.local`.
- Set exact production `CORS_ORIGINS`, Supabase Site URL/redirect URLs, and `NEXT_PUBLIC_API_URL`.
- Build the frontend with the correct public Supabase URL/anon key and API URL; these `NEXT_PUBLIC_*` values are public by design.
- Configure `SUPABASE_URL`, the backend-only `SUPABASE_SERVICE_ROLE_KEY` (only if account deletion is enabled), `OPENAI_API_KEY`, model names, and daily voice caps on the API host.
- Apply `alembic upgrade head` during deployment; enable the API health check at `/health`.
- Monitor provider usage and configure budget alerts/quotas in the provider console. Review processor retention terms and replace the starter privacy page with your organization's compliant notice before public launch.
- Do not expose the service-role key or OpenAI key in browser builds, logs, screenshots, or client-side error messages.
- Free hosting/database tiers can sleep, have quotas, and change; realtime usage can incur provider charges.

## Manual voice smoke test

1. Sign up, verify email if enabled, then sign in.
2. Save an English level and practice goal on Learning preferences.
3. Open Voice practice in a supported desktop browser; allow microphone access.
4. Start a call, confirm the state becomes Connected, speak a response, and check that the AI replies out loud.
5. Mute and unmute, verify the microphone is disabled/enabled, then end the call.
6. Confirm session time appears in dashboard analytics. Repeat with transcript consent off and on; confirm turns are only saved when enabled.
7. Deny microphone permission, remove the OpenAI key, and simulate network/provider failures; verify visible errors and microphone cleanup.

## Current limitations

- Provider-backed sign-up, password reset, text feedback, and live voice have not been exercised against user credentials in this workspace. Supply valid provider settings and run the steps above.
- Voice transcription depends on the configured Realtime model/provider emitting supported transcription events; the app discloses when no transcript event is received.
- Analytics are based on completed sessions and saved corrections. Speaking quality, pronunciation, fluency scores, streaks, and technical answer correctness are not invented or scored.
- The learning plan is a deterministic starter based on the most frequent saved correction category, not a generated multi-week adaptive curriculum.
- A separate vocabulary library, spaced-repetition scheduler, achievement system, visual analytics charts, and detailed post-call strengths/improvement report are not implemented yet.
- Email confirmation and password recovery delivery depend on the Supabase project's email configuration and redirect allowlist.
- Configure production rate limiting and request-size limits at the API gateway/reverse proxy before public exposure; the API validates individual field sizes and caps session/transcript payload counts.
- The included privacy page is a starter notice, not legal advice or a substitute for a jurisdiction-specific privacy policy.
