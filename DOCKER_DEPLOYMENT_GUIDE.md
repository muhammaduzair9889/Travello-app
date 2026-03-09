# Travello — Docker & AWS EC2 Deployment Guide

Complete guide to build Docker images, run containers, and deploy on AWS EC2 (or any Linux server).

---

## Table of Contents

1. [What You Get After Cloning](#1-what-you-get-after-cloning)
2. [What You Still Need (Not in the Repo)](#2-what-you-still-need-not-in-the-repo)
3. [Local Docker Setup (Windows / Mac / Linux)](#3-local-docker-setup)
4. [AWS EC2 Deployment (Step-by-Step)](#4-aws-ec2-deployment)
5. [Container Architecture](#5-container-architecture)
6. [Common Commands](#6-common-commands)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Troubleshooting](#8-troubleshooting)
9. [Production Checklist](#9-production-checklist)

---

## 1. What You Get After Cloning

```
Travello/
├── backend/
│   ├── Dockerfile              # Multi-stage: Python deps → Node/Puppeteer → Runtime
│   ├── .dockerignore           # Excludes venv, __pycache__, .env, etc.
│   ├── .env.example            # Template — copy to .env and fill in secrets
│   ├── requirements.txt        # Python dependencies
│   └── ...                     # Django app code
├── frontend/
│   ├── Dockerfile              # Multi-stage: npm install → React build → nginx
│   ├── .dockerignore           # Excludes node_modules, build/, etc.
│   ├── .env.example            # Frontend env template
│   └── ...                     # React app code
├── docker-compose.yml          # Orchestrates all 4 services
└── README.md
```

**Included:** Dockerfiles, docker-compose.yml, .env.example templates, all app source code.

**NOT included (you must create these):** `.env` files with your actual API keys and secrets.

---

## 2. What You Still Need (Not in the Repo)

### 2.1 Software

| Tool | Version | Why |
|------|---------|-----|
| Docker Engine | 24+ | Container runtime |
| Docker Compose | v2+ | Multi-container orchestration (bundled with Docker Desktop) |
| Git | 2.30+ | Clone the repo |

### 2.2 API Keys & Secrets (fill in `.env`)

These are **never** stored in the repo. You must obtain them yourself:

| Key | Required? | Where to Get |
|-----|-----------|-------------|
| `SECRET_KEY` | **Yes** | Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `GEMINI_API_KEY` | **Yes** | [Google AI Studio](https://aistudio.google.com/apikey) — Free tier available |
| `STRIPE_SECRET_KEY` | For payments | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) — Use test keys |
| `STRIPE_PUBLISHABLE_KEY` | For payments | Same Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | For payments | `stripe listen --forward-to localhost:8000/api/stripe/webhook/` |
| `EMAIL_HOST_USER` | For OTP emails | Your Gmail address |
| `EMAIL_HOST_PASSWORD` | For OTP emails | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `GOOGLE_OAUTH_CLIENT_ID` | For Google login | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Google login | Same Google Cloud Console |
| `CLOUDINARY_CLOUD_NAME` | For image uploads | [Cloudinary Console](https://console.cloudinary.com/) — Free tier |
| `CLOUDINARY_API_KEY` | For image uploads | Same Cloudinary Console |
| `CLOUDINARY_API_SECRET` | For image uploads | Same Cloudinary Console |
| `RECAPTCHA_SITE_KEY` | For form protection | [Google reCAPTCHA](https://www.google.com/recaptcha/admin) |
| `RECAPTCHA_SECRET_KEY` | For form protection | Same reCAPTCHA admin |
| `OPENAI_API_KEY` | Optional | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GROQ_API_KEY` | Optional (fallback LLM) | [Groq Console](https://console.groq.com/) — Free |
| `SENTRY_DSN` | Optional (monitoring) | [Sentry.io](https://sentry.io/) — Free tier |
| `DB_PASSWORD` | Optional | Defaults to `travello_secret` for local dev |

### 2.3 Minimum Hardware (EC2)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Instance type | t3.small (2 vCPU, 2 GB) | t3.medium (2 vCPU, 4 GB) |
| Storage | 20 GB gp3 | 30 GB gp3 |
| OS | Ubuntu 22.04 / Amazon Linux 2023 | Ubuntu 22.04 LTS |

---

## 3. Local Docker Setup

### 3.1 Clone & Configure

```bash
# Clone the repository
git clone https://github.com/muhammaduzair9889/travello-site.git
cd travello-site

# Create backend .env from template
cp backend/.env.example backend/.env

# Edit and fill in your actual API keys
nano backend/.env    # or use any text editor
```

**Minimum `.env` for the app to start** (without payments/email):
```env
SECRET_KEY=your-random-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
GEMINI_API_KEY=your-gemini-key
```

### 3.2 Build & Run

```bash
# Build images and start all 4 containers
docker compose up --build

# Or run in background (detached)
docker compose up -d --build
```

First build takes 5-10 minutes (downloads base images + npm/pip install). Subsequent builds use Docker cache and are much faster.

### 3.3 Post-Start Setup

```bash
# Run database migrations
docker compose exec backend python manage.py migrate

# Create admin user (set ADMIN_PASSWORD in .env or pass via flag)
docker compose exec backend python manage.py setup_admin --password YourStrongPassword123

# Or use Django's built-in command
docker compose exec backend python manage.py createsuperuser
```

### 3.4 Access the App

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health Check | http://localhost:8000/health/ |
| Admin Panel | http://localhost:8000/admin/ |

---

## 4. AWS EC2 Deployment

### Step 1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Ubuntu 22.04 LTS** AMI
3. Instance type: **t3.small** (minimum) or **t3.medium** (recommended)
4. Storage: **20-30 GB gp3**
5. Security Group — open these ports:

   | Port | Protocol | Source | Purpose |
   |------|----------|--------|---------|
   | 22 | TCP | Your IP | SSH access |
   | 80 | TCP | 0.0.0.0/0 | Frontend (HTTP) |
   | 443 | TCP | 0.0.0.0/0 | Frontend (HTTPS, optional) |
   | 8000 | TCP | 0.0.0.0/0 | Backend API (or restrict to frontend only) |
   | 3000 | TCP | 0.0.0.0/0 | Frontend alt port (optional, for testing) |

6. Create/select a **key pair** (.pem file) for SSH access
7. Launch the instance

### Step 2: SSH into EC2

```bash
# Make the key file read-only (required)
chmod 400 your-key.pem

# Connect
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

### Step 3: Install Docker on EC2

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to the docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# IMPORTANT: Log out and log back in for group change to take effect
exit
```

```bash
# Reconnect
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>

# Verify
docker --version
docker compose version
```

### Step 4: Clone & Configure on EC2

```bash
# Clone the project
git clone https://github.com/muhammaduzair9889/travello-site.git
cd travello-site

# Create the .env file
cp backend/.env.example backend/.env
nano backend/.env
```

**Production `.env` settings** — update these values:
```env
# ── CRITICAL: Change these for production ──
SECRET_KEY=<generate-a-strong-50-char-random-string>
DEBUG=False
ALLOWED_HOSTS=<your-ec2-public-ip>,<your-domain.com>,localhost,127.0.0.1,backend,0.0.0.0

# ── Database password (change from default!) ──
# Also set DB_PASSWORD in docker-compose or as env var
# DB_PASSWORD=a-strong-database-password

# ── Your API keys ──
GEMINI_API_KEY=your-actual-gemini-key
STRIPE_PUBLISHABLE_KEY=pk_live_or_test_xxx
STRIPE_SECRET_KEY=sk_live_or_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# ── Production URLs (use your EC2 IP or domain) ──
CORS_ALLOWED_ORIGINS=http://<your-ec2-ip>:3000,http://<your-domain>
FRONTEND_PAYMENT_SUCCESS_URL=http://<your-ec2-ip>:3000/payment-success
FRONTEND_PAYMENT_CANCEL_URL=http://<your-ec2-ip>:3000/payment-cancel
```

### Step 5: Build & Launch on EC2

```bash
# Set the API URL to your EC2 public IP (frontend needs this at build time)
export REACT_APP_API_URL=http://<your-ec2-public-ip>:8000

# Build and start (detached mode)
docker compose up -d --build

# Watch the logs
docker compose logs -f
```

### Step 6: Post-Deploy Setup

```bash
# Run migrations
docker compose exec backend python manage.py migrate

# Create admin user
docker compose exec backend python manage.py setup_admin --password YourStrongAdminPass

# Verify all containers are healthy
docker compose ps
```

Expected output:
```
NAME                STATUS              PORTS
travello-backend    Up (healthy)        0.0.0.0:8000->8000/tcp
travello-db         Up (healthy)        5432/tcp
travello-frontend   Up (healthy)        0.0.0.0:3000->80/tcp
travello-redis      Up (healthy)        6379/tcp
```

### Step 7: Verify

```bash
# Health check
curl http://localhost:8000/health/
# → {"status": "ok"}

# API root
curl http://localhost:8000/
# → {"message": "Welcome to Travello API", ...}
```

Open in browser: `http://<your-ec2-public-ip>:3000`

---

## 5. Container Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │              Docker Compose Network             │
                    │                                                 │
  Browser ──3000──▶ │  ┌──────────┐       ┌──────────┐               │
                    │  │ Frontend │──────▶│ Backend  │               │
                    │  │  nginx   │ :8000  │ Gunicorn │               │
                    │  │  :80     │       │  Django  │               │
                    │  └──────────┘       └────┬─────┘               │
                    │  frontend-net        │    │    backend-net      │
                    │                      │    │                     │
                    │                      │    ├────▶ ┌──────────┐   │
                    │                      │    │      │ Postgres │   │
                    │                      │    │      │  :5432   │   │
                    │                      │    │      └──────────┘   │
                    │                      │    │                     │
                    │                      │    └────▶ ┌──────────┐   │
                    │                      │           │  Redis   │   │
                    │                      │           │  :6379   │   │
                    │                      │           └──────────┘   │
                    └─────────────────────────────────────────────────┘
```

| Container | Image | Size | Purpose |
|-----------|-------|------|---------|
| `travello-frontend` | node:20-alpine → nginx:1.27-alpine | ~25 MB | Serves React SPA |
| `travello-backend` | python:3.11-slim + node:20 | ~500 MB | Django API + Puppeteer scraper |
| `travello-db` | postgres:16-alpine | ~80 MB | PostgreSQL database |
| `travello-redis` | redis:7-alpine | ~15 MB | Caching (scraper results, sessions) |

### Network Isolation

- **backend-net**: Backend ↔ DB ↔ Redis (frontend CANNOT access DB/Redis)
- **frontend-net**: Frontend ↔ Backend (public-facing tier)

### Volumes (Persistent Data)

| Volume | Mount Path | Purpose |
|--------|-----------|---------|
| `travello-pgdata` | `/var/lib/postgresql/data` | Database files |
| `travello-redis` | `/data` | Redis persistence |
| `travello-data` | `/app/data` | Datasets / scraper cache |
| `travello-media` | `/app/media` | User-uploaded images |
| `travello-static` | `/app/staticfiles` | Django static files |

---

## 6. Common Commands

### Building

```bash
# Build all images (fresh)
docker compose build --no-cache

# Build only backend
docker compose build backend

# Build only frontend with custom API URL
REACT_APP_API_URL=http://your-domain.com:8000 docker compose build frontend
```

### Running

```bash
# Start all services
docker compose up -d --build

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and DELETE all data (volumes)
docker compose down -v
```

### Database

```bash
# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Django shell
docker compose exec backend python manage.py shell

# Database shell (psql)
docker compose exec db psql -U travello -d travello_db
```

### Debugging

```bash
# Enter a running container
docker compose exec backend bash
docker compose exec frontend sh

# Check container health
docker compose ps
docker inspect travello-backend | grep -A 10 Health

# Resource usage
docker stats
```

### Updating (After Code Changes)

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Run new migrations if any
docker compose exec backend python manage.py migrate
```

---

## 7. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | insecure default | Django secret key |
| `DEBUG` | No | `True` | Set `False` in production |
| `ALLOWED_HOSTS` | Yes | `localhost,127.0.0.1` | Comma-separated hostnames |
| `DATABASE_URL` | No | Auto-set by docker-compose | PostgreSQL connection string |
| `REDIS_URL` | No | Auto-set by docker-compose | Redis connection string |
| `GEMINI_API_KEY` | Yes | — | Google Gemini AI API key |
| `OPENAI_API_KEY` | No | — | OpenAI API key (optional) |
| `GROQ_API_KEY` | No | — | Groq API key (fallback LLM) |
| `STRIPE_SECRET_KEY` | For payments | — | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | For payments | — | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | For payments | — | Stripe webhook signing secret |
| `EMAIL_HOST_USER` | For emails | — | Gmail address for SMTP |
| `EMAIL_HOST_PASSWORD` | For emails | — | Gmail app password |
| `CLOUDINARY_CLOUD_NAME` | For uploads | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For uploads | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | For uploads | — | Cloudinary API secret |

### Docker Compose (set in shell or `.env` at project root)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PASSWORD` | `travello_secret` | PostgreSQL password |
| `DEBUG` | `True` | Passed to backend |
| `REACT_APP_API_URL` | `http://localhost:8000` | Backend URL for frontend build |
| `EXTRA_HOSTS` | — | Additional ALLOWED_HOSTS entries |

---

## 8. Troubleshooting

### Container won't start

```bash
# Check logs for the failing container
docker compose logs backend
docker compose logs db

# Check if ports are already in use
sudo lsof -i :8000
sudo lsof -i :3000
sudo lsof -i :5432
```

### Backend health check fails (401 Unauthorized)

This was fixed — the health check now hits `/health/` (unauthenticated) instead of `/api/`.

If you still see this, rebuild:
```bash
docker compose down
docker compose up -d --build
```

### Worker timeout / OOM

Symptoms: `WORKER TIMEOUT`, `SIGKILL`, workers restarting constantly.

**Fix:** Increase container memory or reduce workers. The Dockerfile uses 2 workers by default. For a 2GB machine:
```bash
# Override in docker-compose environment:
WEB_CONCURRENCY=1
```

### Database connection refused

```bash
# Check if db container is healthy
docker compose ps db

# Wait for it to be healthy, then restart backend
docker compose restart backend
```

### Frontend shows "Network Error"

The frontend build bakes in `REACT_APP_API_URL`. If you deployed to EC2 but built with `localhost`:
```bash
# Rebuild frontend with correct URL
REACT_APP_API_URL=http://<your-ec2-ip>:8000 docker compose up -d --build frontend
```

### Permission denied on volumes

```bash
# Fix ownership (run on host)
sudo chown -R 1000:1000 /var/lib/docker/volumes/travello-*
```

### Rebuilding from scratch

```bash
# Nuclear option — removes ALL containers, images, volumes
docker compose down -v --rmi all
docker system prune -af
docker compose up -d --build
```

---

## 9. Production Checklist

Before going live, ensure:

- [ ] **`DEBUG=False`** in `backend/.env`
- [ ] **`SECRET_KEY`** is a strong, unique random string (not the default)
- [ ] **`DB_PASSWORD`** is changed from the default `travello_secret`
- [ ] **`ALLOWED_HOSTS`** includes your domain / EC2 IP
- [ ] **`CORS_ALLOWED_ORIGINS`** is set to your frontend URL (not `*`)
- [ ] **All API keys** are set in `backend/.env`
- [ ] **`REACT_APP_API_URL`** points to your production backend URL
- [ ] **Migrations** have been run: `docker compose exec backend python manage.py migrate`
- [ ] **Admin user** has been created
- [ ] **Firewall** (Security Group) only exposes necessary ports
- [ ] **HTTPS** is configured (use a reverse proxy like Caddy or nginx with certbot)
- [ ] **Backups** are scheduled for the PostgreSQL volume

### Optional: HTTPS with Caddy (Recommended)

For production, put a reverse proxy in front to handle SSL:

```bash
# Install Caddy on EC2
sudo apt install -y caddy

# Edit /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}

api.your-domain.com {
    reverse_proxy localhost:8000
}

# Restart Caddy (auto-obtains Let's Encrypt cert)
sudo systemctl restart caddy
```

Then update `REACT_APP_API_URL=https://api.your-domain.com` and rebuild the frontend.

---

## Quick Reference Card

```bash
# ── Clone & Setup ──
git clone https://github.com/muhammaduzair9889/travello-site.git
cd travello-site
cp backend/.env.example backend/.env
nano backend/.env              # Fill in your API keys

# ── Build & Run ──
docker compose up -d --build   # Build images + start containers
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py setup_admin --password YourPass

# ── Verify ──
docker compose ps              # All containers should show "healthy"
curl http://localhost:8000/health/

# ── View Logs ──
docker compose logs -f

# ── Stop ──
docker compose down

# ── Update After Code Changes ──
git pull
docker compose up -d --build
docker compose exec backend python manage.py migrate
```
