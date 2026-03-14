# 🏗️ Travello – Architecture & Technical Reference

Deep-dive into the ML recommendation engine, system architecture, payment flows, review system internals, and deployment infrastructure.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [ML Recommendation System](#ml-recommendation-system)
  - [Pipeline Overview](#pipeline-overview)
  - [ETL Pipeline](#1-etl-pipeline)
  - [Embedding Generator](#2-embedding-generator)
  - [FAISS Vector Index](#3-faiss-vector-index)
  - [Search Process](#search-process)
  - [Performance](#performance)
  - [Scaling Guide](#scaling-guide)
- [Authentication System Detail](#authentication-system-detail)
  - [OTP Flow](#otp-email-verification)
  - [JWT Configuration](#jwt-configuration)
  - [Google OAuth](#google-oauth-flow)
- [Payment System Detail](#payment-system-detail)
  - [Stripe Integration](#stripe-integration)
  - [Webhook Events](#webhook-events)
  - [Payment Status Codes](#payment-status-codes)
- [Reviews System Detail](#reviews-system-detail)
  - [Review Features](#review-features)
  - [Permissions](#review-permissions)
- [AI Chatbot & Itinerary](#ai-chatbot--itinerary)
- [Technology Stack](#technology-stack)
- [File Structure Reference](#file-structure-reference)

---

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        TRAVELLO PLATFORM                          │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────────────┐         ┌──────────────────────────┐      │
│   │   React Frontend │────────▶│   Django REST Backend    │      │
│   │   (Tailwind CSS  │  JWT    │   (Gunicorn + WSGI)      │      │
│   │    Framer Motion) │◀────────│                          │      │
│   │   Port 3000      │         │   Port 8000              │      │
│   └──────────────────┘         └──────────┬───────────────┘      │
│                                           │                       │
│                          ┌────────────────┼────────────────┐      │
│                          ▼                ▼                ▼      │
│                   ┌───────────┐   ┌─────────────┐  ┌──────────┐ │
│                   │ PostgreSQL│   │    Redis     │  │ Stripe   │ │
│                   │ (SQLite   │   │   Cache      │  │ API      │ │
│                   │  for dev) │   │              │  │          │ │
│                   └───────────┘   └─────────────┘  └──────────┘ │
│                                                                   │
│   ┌──────────────────┐   ┌───────────────┐   ┌───────────────┐  │
│   │  ML System       │   │  Scraper      │   │  AI Services  │  │
│   │  FAISS +         │   │  Puppeteer +  │   │  Gemini API + │  │
│   │  Transformers    │   │  Selenium     │   │  Groq API     │  │
│   └──────────────────┘   └───────────────┘   └───────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## ML Recommendation System

### Pipeline Overview

```
Raw CSV Data → ETL Pipeline → Processed Data → Embedding Generator → FAISS Index → Semantic Search API
```

### Data Flow Diagram

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Raw CSV    │ ───▶ │ ETL Pipeline │ ───▶ │  Processed   │
│  hotels_     │      │  Normalize   │      │   Data CSV   │
│  pois.csv    │      │  Deduplicate │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
                                                    │
                                                    ▼
                      ┌──────────────────────────────────────┐
                      │   Embedding Generator                │
                      │   all-mpnet-base-v2 (768D vectors)   │
                      │   Batch encode → L2 normalize        │
                      └──────────────────────────────────────┘
                                                    │
                                                    ▼
                      ┌──────────────────────────────────────┐
                      │   FAISS Index (Flat / IVF / HNSW)    │
                      │   + Metadata mapping (city, price…)  │
                      └──────────────────────────────────────┘
                                                    │
                                                    ▼
                      ┌──────────────────────────────────────┐
                      │   Persistent Storage                 │
                      │   faiss_index.bin  +  metadata.pkl   │
                      └──────────────────────────────────────┘
```

### 1. ETL Pipeline

**File:** `backend/data/ingest/etl_pipeline.py`

```
INPUT: data/datasets/hotels_pois.csv
  ↓
  1. Load CSV with pandas
  2. Validate schema (required + optional columns)
  3. Normalize text (Unicode, lowercase, whitespace)
  4. Generate geohashes for coordinates
  5. Create search text (name + description + tags + city)
  6. Deduplicate (MD5 hash of name + location)
  7. Add processing metadata & timestamps
  ↓
OUTPUT: data/processed/hotels_pois_processed.csv
        data/processed/hotels_pois_metadata.json
```

### 2. Embedding Generator

**File:** `backend/ml_system/embeddings/embedding_generator.py`

| Model | Dimensions | Speed | Quality | Best For |
|-------|-----------|-------|---------|----------|
| `all-mpnet-base-v2` | 768 | Slower | Best | < 10k items (production) |
| `all-MiniLM-L6-v2` | 384 | 3× faster | Good | > 10k items (large datasets) |

Process:
1. Load sentence-transformers model
2. Combine all text fields per item
3. Batch encode with progress bar
4. L2 normalize vectors (for cosine similarity)
5. Save as `.npy` + metadata CSV + config JSON

### 3. FAISS Vector Index

**File:** `backend/ml_system/retrieval/vector_index.py`

| Index Type | Search Time | Recall | Best For |
|-----------|------------|--------|----------|
| **Flat** | O(N) | 100% | < 10k items (exact search) |
| **IVF** | O(√N) | ~95% | 10k–100k items |
| **HNSW** | O(log N) | ~97% | > 100k items |

Features:
- Metadata filtering (city, category, price range, rating threshold)
- Geo-spatial filtering (Haversine distance)
- Top-K retrieval with similarity scores
- Save/load persistence (`.bin` + `.pkl` files)

### Search Process

```
Query: "luxury hotel with pool near Badshahi Mosque"
  │
  ├─ 1. Encode query → 768D vector (100ms)
  ├─ 2. FAISS cosine similarity search (5ms)
  ├─ 3. Filter by city=Lahore, price<35000, rating>8.0 (1ms)
  └─ 4. Return top-K ranked results
  
Results:
  1. Pearl Continental Lahore  → Score: 0.82, PKR 35,000
  2. Marriott Hotel Lahore     → Score: 0.79, PKR 32,000
  3. Luxus Grand Hotel         → Score: 0.76, PKR 30,000
```

### Performance

| Operation | Time (15 items) | Time (10k items) |
|-----------|----------------|-------------------|
| ETL Pipeline | 0.5s | ~30s |
| Embedding Generation | 3s | 30 min (CPU) / 5 min (GPU) |
| Index Building | 0.1s | 10s |
| Query Embedding | 100ms | 100ms |
| Vector Search | 5ms | 50ms (Flat) / 5ms (IVF) |
| **Total Search Latency** | **~106ms** | **~106ms (IVF)** |

### Scaling Guide

- **< 10k items**: Use Flat index, `all-mpnet-base-v2`, CPU is fine
- **10k–100k items**: Switch to IVF index, consider `all-MiniLM-L6-v2`
- **> 100k items**: Use HNSW index, GPU for embedding generation, smaller model

Memory usage: ~6MB per 1,000 items (768D) for embeddings + ~3MB for FAISS index.

---

## Authentication System Detail

### OTP Email Verification

```
1. User signs up → backend generates 6-digit OTP
2. OTP sent via Gmail SMTP to user's email
3. User enters OTP on verification page
4. Backend validates: correct code + not expired (5 min) + attempts < 5
5. Account activated → JWT tokens issued
```

**Settings:**
- `OTP_EXPIRY_MINUTES = 5` — OTP validity window
- `OTP_MAX_ATTEMPTS = 5` — Max wrong attempts before lockout
- Email: Gmail SMTP with app password (TLS on port 587)

### JWT Configuration

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),    # 1 hour
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),       # 1 week
    'ROTATE_REFRESH_TOKENS': True,                     # New refresh on each use
    'BLACKLIST_AFTER_ROTATION': True,                  # Old refresh invalidated
    'ALGORITHM': 'HS256',
}
```

### Google OAuth Flow

```
1. User clicks "Sign in with Google" → Google consent screen
2. Google returns ID token to frontend
3. Frontend sends token to POST /api/google/login/
4. Backend verifies token with Google → creates/finds user
5. Backend returns JWT tokens
```

---

## Payment System Detail

### Stripe Integration

**Keys needed** (from [Stripe Dashboard](https://dashboard.stripe.com/)):
- `STRIPE_PUBLISHABLE_KEY` — Frontend (pk_test_...)
- `STRIPE_SECRET_KEY` — Backend (sk_test_...)
- `STRIPE_WEBHOOK_SECRET` — Webhook signature (whsec_...)

### Complete Online Payment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend │     │ Backend  │     │  Stripe  │     │ Webhook  │
├──────────┤     ├──────────┤     ├──────────┤     ├──────────┤
│ Create   │────▶│ Create   │────▶│ Checkout │     │          │
│ booking  │     │ session  │     │ Session  │     │          │
│          │◀────│ url      │     │          │     │          │
│ Redirect │────▶│          │     │ Payment  │     │          │
│ to Stripe│     │          │     │ Page     │     │          │
│          │     │          │     │ User pays│────▶│ Event    │
│          │     │          │◀────│          │     │ received │
│          │     │ Update   │     │          │     │          │
│ Success  │◀────│ booking  │     │          │     │          │
│ page     │     │ = PAID   │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Mark booking as **PAID**, payment as **SUCCEEDED** |
| `payment_intent.succeeded` | Backup confirmation (if webhook fires late) |
| `payment_intent.payment_failed` | Mark payment as **FAILED**, keep booking PENDING |
| `charge.refunded` | Mark payment as **REFUNDED**, revert booking to PENDING |

### Payment Status Codes

| Status | Meaning |
|--------|---------|
| `PAY_ON_ARRIVAL` | Arrival payment method selected (no Stripe) |
| `NOT_INITIATED` | Online selected but checkout not started |
| `PROCESSING` | Stripe session created, awaiting payment |
| `SUCCEEDED` | Payment confirmed ✅ |
| `FAILED` | Payment declined |
| `REFUNDED` | Payment refunded |

---

## Reviews System Detail

### Review Features

| Feature | Description |
|---------|-------------|
| Star Ratings | 1–5 stars with half-star support |
| Text Reviews | Free-text with minimum length validation |
| Photo Uploads | Via Cloudinary (max 5 per review) |
| Auto-correct | Spelling correction suggestions |
| Sentiment Analysis | Positive/negative/neutral classification |
| Aggregation | Auto-calculated hotel average rating |
| Sorting | By date, rating, helpfulness |
| Pagination | Server-side with configurable page size |

### Review Permissions

| Action | Who Can Do It |
|--------|--------------|
| Create review | Any authenticated user (one per hotel per user) |
| Edit review | Review author only |
| Delete review | Review author or admin |
| View reviews | Any authenticated user |

---

## AI Chatbot & Itinerary

### Chatbot (Gemini)

- Powered by Google Gemini API (`gemini-pro`)
- Rate-limit handling with retry + exponential backoff + circuit-breaker
- Fallback to Groq (Llama 3) if Gemini is unavailable
- Context-aware: knows about Pakistani destinations, hotels, travel tips

### AI Itinerary Generator

- Generates multi-day trip plans for Pakistani cities
- Includes: daily schedule, activities, restaurants, travel tips, estimated costs
- Powered by Gemini with structured JSON output
- Saved itineraries can be viewed/managed

---

## Technology Stack

### Core Libraries

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.2 |
| Styling | Tailwind CSS | 3.2 |
| Animation | Framer Motion | 12.x |
| Charts | Recharts | 2.x |
| Maps | Leaflet + React-Leaflet | 1.9 / 4.2 |
| 3D | Three.js + R3F | 0.180 |
| Backend | Django | 4.2 |
| REST API | DRF | 3.14 |
| Auth Tokens | SimpleJWT | 5.3 |
| WSGI Server | Gunicorn | 21.2 |
| Static Files | WhiteNoise | 6.6 |
| Database | PostgreSQL / SQLite | 16 / 3 |
| Payments | Stripe | Latest |
| Images | Cloudinary | Latest |

### ML Libraries (Optional)

| Library | Purpose |
|---------|---------|
| sentence-transformers | Text → vector embeddings |
| transformers | Hugging Face model loading |
| torch | PyTorch backend |
| faiss-cpu | Vector similarity search |
| pandas | Data processing |
| numpy | Array operations |
| scikit-learn | ML utilities |

### Infrastructure

| Component | Image / Tool |
|-----------|-------------|
| Backend Container | `python:3.11-slim` (multi-stage) |
| Frontend Container | `node:20-alpine` → `nginx:1.27-alpine` |
| Database | `postgres:16-alpine` |
| Cache | `redis:7-alpine` |
| Orchestration | Docker Compose v2 |

---

## File Structure Reference

```
backend/
├── authentication/
│   ├── models.py              # Custom User model (email-based)
│   ├── views.py               # Signup, Login, OTP, OAuth, Profile
│   ├── serializers.py         # DRF serializers
│   ├── chat_service.py        # Gemini chatbot with circuit-breaker
│   ├── emotion_service.py     # Sentiment analysis
│   ├── recommendation_service.py  # ML recommendation wrapper
│   └── urls.py                # Auth URL routes
│
├── hotels/
│   ├── models.py              # Hotel, Room, Booking, Payment models
│   ├── views.py               # Hotel CRUD, booking management
│   ├── payment_views.py       # Stripe checkout, webhook, status
│   ├── recommendation_views.py # ML-powered hotel recommendations
│   ├── ml_views.py            # Additional ML endpoints
│   ├── services.py            # Business logic layer
│   └── urls.py                # Hotel URL routes
│
├── reviews/
│   ├── models.py              # Review model with ratings + photos
│   ├── views.py               # Review CRUD
│   ├── permissions.py         # Owner-only edit/delete
│   ├── services/              # Autocorrect, sentiment, aggregation
│   └── urls.py                # Review URL routes
│
├── itineraries/
│   ├── models.py              # Itinerary model
│   ├── generator.py           # Gemini-powered trip planner
│   ├── views.py               # Generate + list itineraries
│   └── urls.py                # Itinerary URL routes
│
├── scraper/
│   ├── booking_scraper.py     # Python/Selenium scraper
│   ├── puppeteer_scraper.js   # Node.js/Puppeteer scraper
│   ├── views.py               # Scraper API endpoints
│   └── package.json           # Puppeteer dependencies
│
├── ml_system/
│   ├── embeddings/            # Sentence-transformer encoding
│   ├── retrieval/             # FAISS vector search
│   └── training/              # Model training (future)
│
├── data/
│   ├── datasets/              # Raw CSV data + knowledge JSON
│   └── ingest/                # ETL pipeline
│
└── travello_backend/
    └── travello_backend/
        ├── settings.py        # All Django configuration
        ├── urls.py            # Root URL configuration
        ├── wsgi.py            # WSGI entry point
        └── utils.py           # Custom exception handler
```
