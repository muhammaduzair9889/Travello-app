# 🌍 Travello – AI-Powered Travel Platform

A full-stack travel application with AI recommendations, real-time hotel scraping, Stripe payments, and an intelligent chatbot — built with **React 18** and **Django REST Framework**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start (Local)](#quick-start-local)
- [Access from Mobile / Other Devices (LAN)](#access-from-mobile--other-devices-lan)
- [Docker Setup](#docker-setup)
- [Docker Architecture](#docker-architecture)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Key Workflows](#key-workflows)
- [Admin Panel](#admin-panel)
- [Deployment](#deployment)
- [Related Docs](#related-docs)

---

## Features

| Module | Highlights |
|--------|-----------|
| **Authentication** | JWT tokens, Email OTP verification, Google OAuth, reCAPTCHA, Admin login |
| **Hotel Search** | Real-time Booking.com scraping (Puppeteer), caching, 6+ Pakistani cities |
| **AI Recommendations** | FAISS vector search, sentence-transformers embeddings, semantic queries |
| **AI Chatbot** | Google Gemini integration with rate-limit circuit-breaker & fallback to Groq |
| **AI Itinerary** | Gemini-powered multi-day trip planner for Pakistani destinations |
| **Payments** | Stripe Checkout (online) + pay-on-arrival, webhook confirmation |
| **Reviews** | Star ratings, sentiment analysis, autocorrect, photo uploads (Cloudinary) |
| **Dashboard** | Responsive sidebar, mobile hamburger menu, dark mode, animated UI |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 · Tailwind CSS · Framer Motion · Recharts · Leaflet Maps · Three.js |
| **Backend** | Django 4.2 · DRF · SimpleJWT · Gunicorn · WhiteNoise |
| **Database** | SQLite (dev) · PostgreSQL 16 (prod / Docker) |
| **Cache** | Redis 7 |
| **AI / ML** | Sentence-Transformers · FAISS · Google Gemini · Groq (Llama 3) |
| **Payments** | Stripe Checkout + Webhooks |
| **Scraper** | Puppeteer + Stealth Plugin · Selenium (fallback) |
| **Infra** | Docker · nginx · Sentry |

---

## Project Structure

```
Travello/
├── docker-compose.yml           # Full-stack orchestration (4 services)
├── README.md                    # ← You are here
├── ARCHITECTURE_GUIDE.md        # ML, auth, payments, reviews deep-dive
├── SCRAPER_GUIDE.md             # Scraper system documentation
│
├── backend/
│   ├── Dockerfile               # Multi-stage: Python builder → Node builder → runtime
│   ├── .dockerignore
│   ├── .env.example             # Environment variable template
│   ├── manage.py
│   ├── requirements.txt
│   ├── authentication/          # JWT, OTP, OAuth, user management, chatbot
│   ├── hotels/                  # Hotel models, bookings, Stripe payments, ML views
│   ├── reviews/                 # Review CRUD, sentiment, autocorrect, Cloudinary
│   ├── itineraries/             # AI itinerary generation (Gemini)
│   ├── scraper/                 # Puppeteer + Selenium hotel scraping
│   ├── ml_system/               # Embeddings, FAISS index, vector retrieval
│   ├── data/                    # Datasets & ETL pipeline
│   └── travello_backend/        # Django settings, URLs, WSGI
│
└── frontend/
    ├── Dockerfile               # Multi-stage: Node deps → build → nginx serve
    ├── .dockerignore
    ├── .env.example
    ├── package.json
    ├── tailwind.config.js
    ├── src/
    │   ├── components/          # React components (Dashboard, Login, Hotels, etc.)
    │   ├── services/            # Axios API service layer
    │   ├── contexts/            # React context providers
    │   └── hooks/               # Custom React hooks
    └── public/
```

---

## Quick Start (Local)

### Prerequisites

- **Python 3.11+** and pip
- **Node.js 18+** and npm
- **Git**

### 1. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows PowerShell
# source venv/bin/activate           # macOS / Linux

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env               # Then edit .env with your API keys

# Run database migrations
python manage.py makemigrations
python manage.py migrate

# Create admin account
python manage.py createsuperuser

# Start backend server (0.0.0.0 = accessible from LAN)
python manage.py runserver 0.0.0.0:8000
```

### 2. Scraper Setup (optional)

```powershell
cd backend/scraper
npm install                           # Installs Puppeteer + stealth plugin
```

### 3. Frontend Setup

```powershell
cd frontend
npm install

# For local-only access:
npm start                            # → http://localhost:3000

# For LAN / mobile access (see next section):
# $env:HOST="0.0.0.0"; npm start    # PowerShell
# set HOST=0.0.0.0 && npm start     # CMD
```

### 4. Verify Everything Works

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Admin Panel | http://localhost:8000/admin/ |

---

## Access from Mobile / Other Devices (LAN)

Test the app on your **phone, tablet, or any device** on the same Wi-Fi network.

### Step 1 — Find Your PC's Local IP

```powershell
# Windows
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter → e.g. 192.168.1.105

# macOS / Linux
ip addr show | grep "inet "
```

### Step 2 — Start Backend on All Interfaces

```powershell
cd backend
python manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` makes Django listen on **all** network interfaces, not just localhost.

### Step 3 — Point Frontend at Your IP

Create or edit `frontend/.env`:

```env
REACT_APP_API_URL=http://192.168.1.105:8000
REACT_APP_API_BASE_URL=http://192.168.1.105:8000
```

> Replace `192.168.1.105` with **your** IPv4 address from Step 1.

### Step 4 — Start Frontend on All Interfaces

```powershell
cd frontend

# PowerShell
$env:HOST="0.0.0.0"; npm start

# CMD
set HOST=0.0.0.0 && npm start
```

React dev server will print:
```
Local:    http://localhost:3000
Network:  http://192.168.1.105:3000    ← use this on your phone
```

### Step 5 — Open on Your Phone

1. Connect your phone to the **same Wi-Fi** as your PC
2. Open the browser → go to `http://192.168.1.105:3000`
3. Done

### Troubleshooting LAN Access

| Problem | Solution |
|---------|----------|
| Can't connect from phone | Both devices must be on the **same Wi-Fi / LAN** |
| Connection refused | Windows Firewall — allow Node.js and Python through |
| API calls fail | Ensure `REACT_APP_API_URL` uses your **IP**, not `localhost` |
| Firewall rule (one-liner) | `netsh advfirewall firewall add rule name="Travello" dir=in action=allow protocol=TCP localport=3000,8000` |

### LAN Access with Docker

When running via Docker Compose, ports are already bound to `0.0.0.0`. Just open `http://<your-ip>:3000` on any LAN device — no extra config needed.

---

## Docker Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Docker Compose v2 (bundled with Docker Desktop)

### 1. Configure Environment

```powershell
cd backend
copy .env.example .env
# Edit .env — fill in: GEMINI_API_KEY, STRIPE keys, EMAIL creds, etc.
```

### 2. Build & Launch (one command)

```powershell
# From project root (where docker-compose.yml lives)
docker compose up --build
```

This starts **4 containers**:

| Container | Port | Image | Purpose |
|-----------|------|-------|---------|
| `travello-frontend` | **3000** → 80 | `nginx:1.27-alpine` | React SPA |
| `travello-backend` | **8000** | `python:3.11-slim` + Gunicorn | Django API |
| `travello-db` | (internal) | `postgres:16-alpine` | Database |
| `travello-redis` | (internal) | `redis:7-alpine` | Cache |

### 3. First-Time Setup (migrations + admin)

```powershell
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

### 4. Common Docker Commands

```powershell
# Start (detached)
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop everything
docker compose down

# Stop + DELETE all data (volumes)
docker compose down -v

# Rebuild one service
docker compose build backend
docker compose up -d backend

# Shell into backend
docker compose exec backend bash

# Run Django commands
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py collectstatic --noinput

# Open on mobile (same Wi-Fi)
# → http://<your-pc-ip>:3000
```

---

## Docker Architecture

```
                    ┌────────────────────────────────────────────────────┐
                    │             Docker Compose Stack                   │
                    │                                                    │
  :3000 (host)     │  ┌──────────────┐       ┌────────────────┐        │
  ─────────────────┼─▶│   Frontend   │──────▶│    Backend     │        │
                    │  │  nginx:80    │       │  gunicorn:8000 │        │
  :8000 (host)     │  └──────────────┘       └───────┬────────┘        │
  ─────────────────┼────────────────────────────────▶│                  │
                    │   frontend-net            backend-net              │
                    │                          ┌─────┴──────┐           │
                    │                     ┌────┴─────┐ ┌────┴────┐     │
                    │                     │ Postgres │ │  Redis  │     │
                    │                     │  :5432   │ │  :6379  │     │
                    │                     └──────────┘ └─────────┘     │
                    │                                                    │
                    │  Volumes: pgdata, redis, data, media, static      │
                    └────────────────────────────────────────────────────┘
```

**Network isolation (two-tier):**
- `backend-net` — Backend ↔ PostgreSQL ↔ Redis (frontend **cannot** reach DB directly)
- `frontend-net` — Frontend ↔ Backend only (public-facing tier)

**Named volumes** persist data across container restarts:
- `travello-pgdata` — PostgreSQL database files
- `travello-redis` — Redis RDB snapshots
- `travello-data` — Backend datasets / SQLite fallback
- `travello-media` — User-uploaded images
- `travello-static` — Django collected static files

**Multi-stage builds** keep images small:
- Backend: `python:3.11-slim` builder → `node:20-slim` scraper builder → slim runtime (~350 MB)
- Frontend: `node:20-alpine` builder → `nginx:1.27-alpine` runtime (~25 MB)

---

## Environment Variables

### Backend (`backend/.env`)

```env
# ── Django Core ──────────────────────────────────────
SECRET_KEY=change-me-to-a-long-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# ── AI / ML ──────────────────────────────────────────
GEMINI_API_KEY=                    # Required — chatbot + itinerary
GROQ_API_KEY=                      # Optional — fallback LLM

# ── Stripe Payments ──────────────────────────────────
STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…

# ── Email (Gmail SMTP) ──────────────────────────────
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=app-password

# ── reCAPTCHA ────────────────────────────────────────
RECAPTCHA_SECRET_KEY=

# ── Cloudinary (image uploads) ───────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── Google OAuth ─────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# ── Monitoring ───────────────────────────────────────
SENTRY_DSN=
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_BASE_URL=http://localhost:8000
```

> For LAN/mobile: replace `localhost` with your PC's IPv4 address.
> For Docker: docker-compose.yml passes these as build args automatically.

---

## API Reference

**Base URL:** `http://localhost:8000/api/`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup/` | No | Register (username, email, password, recaptcha_token) |
| POST | `/login/` | No | Login → JWT access + refresh tokens |
| POST | `/admin/login/` | No | Admin login |
| POST | `/verify-otp/` | No | Verify email OTP |
| POST | `/resend-otp/` | No | Resend OTP |
| POST | `/token/refresh/` | No | Refresh expired access token |
| GET | `/profile/` | Yes | Current user profile |
| PUT | `/profile/update/` | Yes | Update profile |
| POST | `/change-password/` | Yes | Change password |
| POST | `/google/login/` | No | Google OAuth login |

### Hotels & Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/hotels/` | Yes | List all hotels |
| GET | `/hotels/<id>/` | Yes | Hotel detail |
| POST | `/hotels/bookings/create/` | Yes | Create booking |
| GET | `/hotels/bookings/my-bookings/` | Yes | User's bookings |
| PUT | `/hotels/bookings/<id>/cancel/` | Yes | Cancel booking |
| GET | `/hotels/recommendations/` | Yes | ML-powered recommendations |
| POST | `/hotels/search/` | Yes | Semantic hotel search |

### Scraper

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scraper/scrape-hotels/` | Yes | Scrape hotels from Booking.com |
| GET | `/scraper/destinations/` | Yes | Supported city IDs |
| POST | `/scraper/test/` | Yes | Test scraper availability |

### AI / Chat / Itinerary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/` | Yes | AI chatbot (Gemini / Groq fallback) |
| POST | `/itinerary/generate/` | Yes | Generate AI itinerary |
| GET | `/itinerary/` | Yes | List saved itineraries |

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/create-session/` | Yes | Create Stripe checkout session |
| GET | `/payments/booking/<id>/status/` | Yes | Check payment status |
| POST | `/payments/webhook/` | No | Stripe webhook (signature-verified) |

### Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/reviews/hotels/<id>/reviews/` | Yes | List reviews for a hotel |
| POST | `/reviews/hotels/<id>/reviews/create/` | Yes | Create review |
| PUT | `/reviews/<id>/update/` | Yes | Update own review |
| DELETE | `/reviews/<id>/delete/` | Yes | Delete own review |

---

## Key Workflows

### Authentication Flow

```
Signup → OTP email sent → Verify OTP → Account active → Login → JWT tokens
```

- OTP: 6-digit code, valid 5 min, max 5 attempts
- JWT: access token (60 min) + refresh token (7 days)
- Google OAuth: one-click login, auto-creates account

### Payment Flow (Stripe)

```
Create booking → POST /payments/create-session/ → Redirect to Stripe
→ User pays → Webhook fires → Booking marked PAID → Success page
```

Two methods: **Online** (Stripe Checkout) or **Pay on arrival**.
**Test cards:** `4242 4242 4242 4242` (success) · `4000 0000 0000 0002` (decline)

### ML Recommendation Flow

```
User query → Sentence-Transformers (768D) → FAISS cosine search → Metadata filter → Top-K results
```

See [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) for the full ML pipeline.

### Scraper Flow

```
POST /scraper/scrape-hotels/ → Puppeteer launches → Booking.com search → JSON response
```

See [SCRAPER_GUIDE.md](SCRAPER_GUIDE.md) for full scraper docs.

---

## Admin Panel

**URL:** http://localhost:8000/admin/

Create admin with `python manage.py createsuperuser` (or via Docker: `docker compose exec backend python manage.py createsuperuser`).

Manage: Users, Hotels, Bookings, Payments, Reviews, Itineraries.

---

## Deployment

### Docker (Recommended)

See [Docker Setup](#docker-setup) above. For production, set in your `.env`:

```env
DEBUG=False
SECRET_KEY=<strong-random-key>
ALLOWED_HOSTS=your-domain.com
```

### Render (Backend)

```
web: gunicorn travello_backend.travello_backend.wsgi:application --bind 0.0.0.0:$PORT
```

### Vercel / Netlify (Frontend)

Config files included: `vercel.json`, `netlify.toml`.
Set `REACT_APP_API_URL` to your deployed backend URL.

---

## Related Docs

| Document | Contents |
|----------|----------|
| [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) | ML recommendation pipeline, auth internals (OTP + JWT + OAuth), Stripe payment flows, reviews system, AI chatbot, file structure |
| [SCRAPER_GUIDE.md](SCRAPER_GUIDE.md) | Puppeteer/Selenium scraper, bot detection bypass, CSS selectors, caching, rate limiting, troubleshooting |
| [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md) | Docker images, container setup, AWS EC2 deployment (step-by-step), environment variables, production checklist |

---

## License

This project is developed as a Final Year Project (FYP) for educational purposes.
