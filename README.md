# Travello

An AI-powered travel platform that makes planning trips to Pakistan simple and enjoyable. Book hotels, get smart recommendations, explore itineraries, and chat with an intelligent assistant—all in one place.

## What is Travello?

Travello combines modern web technologies with AI to deliver a seamless travel booking experience. Whether you're looking for a last-minute getaway or planning a detailed multi-day trip, Travello helps you discover the best hotels, get personalized recommendations, and navigate Pakistani destinations with confidence.

### Key Features

**Hotels & Bookings**
- Real-time availability and pricing from major booking platforms
- Instant booking with Stripe integration
- Flexible payment options (pay online or on arrival)
- Comprehensive hotel details, reviews, and photos

**Smart Recommendations**
- AI-powered hotel suggestions based on your preferences
- Semantic search that understands what you're looking for
- Personalized recommendations using machine learning
- Mood-based itinerary generation

**AI Assistant**
- Chat with an intelligent assistant powered by Google Gemini
- Get travel tips, booking help, and local insights
- Real-time internet search for current information
- Natural conversation about destinations

**Multi-day Itineraries**
- Automatic trip planning for 2-7 days
- Mood-based activity matching
- Optimal route planning between attractions
- Integration with your hotel booking

**Reviews & Community**
- Write and read honest reviews from travelers
- AI-powered sentiment analysis
- Auto-correct for review text
- Photo uploads with automatic optimization

**Mobile-Friendly**
- Responsive design works on all devices
- Dark mode for comfortable browsing
- Smooth animations and fast load times
- Works offline for key features

## Getting Started

### Quick Setup

**Requirements:**
- Python 3.11 or later
- Node.js 18 or later
- Git

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys (see DOCUMENTATION.md)
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm start  # Opens http://localhost:3000
```

**Scraper Setup (Optional):**
```bash
cd backend/scraper
npm install  # For Puppeteer-based hotel scraping
```

The platform will be available at `http://localhost:3000` and the API at `http://localhost:8000`.

## Technology Stack

**Frontend:** React 18, Tailwind CSS, Framer Motion, Recharts, Three.js

**Backend:** Django 4.2, Django REST Framework, PostgreSQL, Redis

**AI/ML:** HuggingFace Transformers, FAISS, Google Gemini, LightGBM

**Infrastructure:** Docker, Docker Compose, Gunicorn, Nginx

## Common Tasks

**Run Tests:**
```bash
cd backend
pytest
```

**Create an Admin User:**
```bash
python manage.py createsuperuser
# Then visit http://localhost:8000/admin
```

**Build for Production:**
```bash
cd frontend
npm run build  # Creates optimized build in build/
```

**Docker Deployment:**
```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

**Collect Static Files:**
```bash
python manage.py collectstatic --noinput
```

## Configuration

All configuration is handled through environment variables in `.env`. See `.env.example` for a template with all available options.

**Essential variables:**
- `GEMINI_API_KEY` - Google AI API key for the chatbot
- `STRIPE_SECRET_KEY` - Stripe API key for payments
- `CLOUDINARY_URL` - Cloudinary image CDN
- `SECRET_KEY` - Django secret key (generate a new one)
- Database URL, Redis URL, etc.

See DOCUMENTATION.md for detailed configuration options.

## API Reference

The backend provides a RESTful API with the following main endpoints:

**Hotels:** `GET /api/hotels/search/` - Search available hotels

**Bookings:** `POST /api/bookings/` - Create a booking

**Reviews:** `GET /api/reviews/` - List reviews, `POST /api/reviews/` - Add review

**AI:** `POST /api/chat/` - Chat with assistant, `POST /api/itineraries/generate/` - Generate trip plan

**Auth:** `POST /api/auth/register/` - Register, `POST /api/auth/login/` - Login

Full API documentation is available at `/api/docs` when running the backend.

## Deployment

The project is Docker-ready and can be deployed to any Docker-compatible hosting platform (AWS, GCP, Azure, etc.).

**Quick Docker deployment:**
```bash
docker-compose up -d
```

This starts:
- Django backend on port 8000
- React frontend on port 3000
- PostgreSQL database
- Redis cache

For production, update `docker-compose.yml` with your domain and SSL configuration.

See DOCUMENTATION.md for detailed deployment instructions.

## Performance

- Frontend builds: ~30 seconds
- API response time: <200ms (typical)
- AI operations: <2 seconds
- Database queries: <50ms

Performance monitoring is built-in via Sentry error tracking.

## Support & Contribution

Found a bug? Have a feature idea? Open an issue or pull request.

For questions about the project, refer to DOCUMENTATION.md for technical details.

## License

MIT License - see LICENSE file for details.

---

**Ready to explore?** Start with `npm start` and `python manage.py runserver`, then head to http://localhost:3000.

For technical details, API documentation, and configuration guides, see [DOCUMENTATION.md](DOCUMENTATION.md).
