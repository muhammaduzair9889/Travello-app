# Travello - Technical Documentation

Complete technical reference for developers working on or deploying Travello.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend API](#backend-api)
3. [Frontend Application](#frontend-application)
4. [AI & Machine Learning](#ai--machine-learning)
5. [Authentication & Security](#authentication--security)
6. [Payment Processing](#payment-processing)
7. [Database Schema](#database-schema)
8. [Deployment Guide](#deployment-guide)
9. [Configuration Reference](#configuration-reference)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Travello follows a standard microservices architecture with clear separation between frontend and backend.

### System Components

**Frontend (React 18)**
- Single Page Application (SPA)
- Responsive design with Tailwind CSS
- Real-time state management with Context API
- WebSocket support for live chat

**Backend (Django + DRF)**
- RESTful API serving all frontend requests
- Asynchronous task processing with Celery (optional)
- WebSocket support via Channels for real-time features
- JWT authentication with refresh tokens

**Database Layer**
- PostgreSQL for production (SQLite for development)
- Redis for caching and sessions
- Elasticsearch (optional) for hotel search optimization

**External Services**
- Google Gemini API for AI chatbot and itinerary generation
- Stripe for payment processing
- Cloudinary for image hosting
- OpenWeatherMap for weather data

### Data Flow

```
Client (Browser)
    ↓
React Frontend (Port 3000)
    ↓
Django REST API (Port 8000)
    ↓
PostgreSQL Database + Redis Cache
    ↓
External APIs (Gemini, Stripe, Cloudinary)
```

---

## Backend API

### Core Endpoints

**Authentication**
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login (returns JWT)
- `POST /api/auth/refresh/` - Refresh JWT token
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/profile/` - Get logged-in user profile
- `PUT /api/auth/profile/` - Update user profile

**Hotels**
- `GET /api/hotels/search/?city=Lahore&checkin=2024-05-01&checkout=2024-05-03` - Search hotels
- `GET /api/hotels/{id}/` - Get hotel details
- `GET /api/hotels/{id}/availability/` - Check real-time availability
- `GET /api/hotels/{id}/reviews/` - Get hotel reviews

**Bookings**
- `POST /api/bookings/` - Create a booking
- `GET /api/bookings/` - List user's bookings
- `GET /api/bookings/{id}/` - Get booking details
- `PUT /api/bookings/{id}/` - Update booking
- `DELETE /api/bookings/{id}/` - Cancel booking

**Reviews**
- `POST /api/reviews/` - Write a review
- `GET /api/reviews/?hotel={id}` - Get hotel reviews
- `PUT /api/reviews/{id}/` - Update own review
- `DELETE /api/reviews/{id}/` - Delete own review
- `POST /api/reviews/{id}/helpful/` - Mark review as helpful

**AI Features**
- `POST /api/chat/` - Chat with AI assistant
- `POST /api/itineraries/generate/` - Generate multi-day itinerary
- `GET /api/itineraries/` - List saved itineraries
- `GET /api/itineraries/{id}/` - Get itinerary details

**Recommendations**
- `GET /api/recommendations/?mood=relaxing&city=Lahore` - Get AI recommendations
- `POST /api/recommendations/feedback/` - Provide feedback on recommendations

**Admin**
- `GET /api/admin/dashboard/` - Admin overview
- `GET /api/admin/bookings/` - All bookings (admin)
- `GET /api/admin/users/` - User management
- `GET /api/admin/analytics/` - Platform analytics

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Hotel Example",
    ...
  },
  "message": "Operation successful"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Booking not found",
  "code": "NOT_FOUND",
  "status": 404
}
```

### Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. User logs in with email/password or OAuth
2. Server returns `access_token` (expires in 15 minutes) and `refresh_token` (expires in 7 days)
3. Client includes access token in Authorization header: `Authorization: Bearer <token>`
4. When access token expires, use refresh token to get a new one

### Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Anonymous users: 100 requests/hour
- Authenticated users: 1000 requests/hour
- AI endpoints (chat, itinerary): 50 requests/hour per user

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

---

## Frontend Application

### Project Structure

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Hotels/          # Hotel search & details
│   │   ├── Auth/            # Login, register, profile
│   │   ├── Bookings/        # Booking management
│   │   ├── Reviews/         # Review interface
│   │   ├── Chat/            # AI chatbot
│   │   ├── Itineraries/     # Trip planning
│   │   └── Layout/          # Navigation, header
│   ├── services/
│   │   └── api.js           # Axios API client
│   ├── contexts/
│   │   ├── AuthContext.js   # User auth state
│   │   └── AppContext.js    # Global app state
│   ├── hooks/
│   │   ├── useApi.js        # API calls helper
│   │   └── useAuth.js       # Auth state hook
│   ├── App.js
│   └── index.js
├── package.json
└── tailwind.config.js
```

### Key Components

**Hotels Component**
- Displays search results
- Filters by price, rating, amenities
- Pagination support
- Real-time availability updates

**Booking Flow**
1. User selects hotel and dates
2. Review booking details
3. Enter guest information
4. Choose payment method
5. Process payment
6. Confirmation page

**Chat Interface**
- Message history display
- Real-time message updates
- File upload support (for photos)
- Typing indicators

**Review Submission**
- Star rating (1-5)
- Text review with grammar suggestions
- Photo uploads
- Sentiment analysis preview

### State Management

The app uses React Context API for state management:

**AuthContext**
- Current user data
- Auth tokens
- Login/logout methods
- User preferences

**AppContext**
- Global UI state
- Notifications
- Loading states
- Theme (light/dark mode)

### API Integration

All API calls go through the centralized `api.js` service:

```javascript
import api from './services/api';

// GET request
const hotels = await api.get('/hotels/search', {
  params: { city: 'Lahore', checkin: '2024-05-01' }
});

// POST request
const booking = await api.post('/bookings/', {
  hotel_id: 123,
  checkin_date: '2024-05-01',
  checkout_date: '2024-05-03'
});
```

The service automatically handles:
- JWT token inclusion in headers
- Token refresh when expired
- Error handling and user notifications
- Request/response logging

### Build & Deployment

Development:
```bash
npm start  # Runs on http://localhost:3000
```

Production:
```bash
npm run build  # Creates optimized build in build/
```

The build is optimized with:
- Code splitting by route
- CSS minification
- JS minification and tree-shaking
- Asset optimization
- Service worker for offline support

---

## AI & Machine Learning

### 1. Recommendation Engine

**How it works:**
- Hotels and attractions are indexed with semantic embeddings
- Uses all-mpnet-base-v2 (768-dimensional vectors) from HuggingFace
- When user searches, query is embedded and compared with FAISS index
- Similar items are returned based on cosine similarity

**Technology Stack:**
- FAISS (Facebook AI Similarity Search) for vector indexing
- Sentence-Transformers for generating embeddings
- Scikit-learn for machine learning utilities

**Performance:**
- Indexing 10,000 hotels: ~5 minutes
- Search query: <100ms
- Memory usage: ~2GB for typical dataset

### 2. AI Chatbot

**Features:**
- Natural language understanding with Google Gemini API
- Real-time web search integration for current information
- Fallback to Groq (Llama 3) if Gemini is unavailable
- Conversation history stored for context

**Capabilities:**
- Answer travel questions about Pakistan
- Suggest hotels and attractions
- Provide booking assistance
- Local tips and cultural information
- Real-time search for events, weather, etc.

**Rate Limiting:**
- Gemini: 50 messages/hour per user
- Web search: 10 searches/hour per user

### 3. Itinerary Generation

**Process:**
1. Collect user preferences: mood, budget, interests
2. Extract places matching mood and location
3. Rank places using ML model (LightGBM)
4. Optimize route for travel time
5. Generate descriptions with Gemini
6. Return complete day-by-day itinerary

**ML Model:**
- LightGBM (gradient boosting) for place ranking
- Trained on user feedback data
- Features: user mood, place ratings, distance, time of day
- Fallback to rule-based ranking if model unavailable

### 4. Sentiment Analysis

**For Reviews:**
- Uses TextBlob for sentiment classification
- Keyword-based fallback for high accuracy
- Classifies reviews as: Positive, Neutral, or Negative
- Extracts emotion from review text

**For Chat:**
- Detects user emotion to personalize responses
- Adjusts tone based on detected sentiment

---

## Authentication & Security

### Authentication Methods

**Email/Password**
1. User registers with email and password
2. Password is hashed with bcrypt (not stored in plain text)
3. User receives verification email
4. After verification, can login

**Google OAuth**
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. On approval, user is automatically logged in or registered
4. Travello receives user info (email, name, photo)

**Email OTP**
- Used for password reset
- 6-digit code sent to email
- Valid for 10 minutes
- User must verify before resetting password

### JWT Tokens

**Access Token**
- Valid for 15 minutes
- Included in Authorization header
- Payload contains user ID and permissions

**Refresh Token**
- Valid for 7 days
- Stored as HTTP-only cookie (secure)
- Used to get new access token
- Can be revoked (logout)

### Password Requirements

- Minimum 8 characters
- Must contain uppercase, lowercase, numbers
- Cannot be common passwords (checked against list)

### CSRF Protection

All POST/PUT/DELETE requests require CSRF token in headers. The token is automatically included by the frontend and validated by Django.

### Security Headers

The API includes security headers:
```
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## Payment Processing

### Stripe Integration

**How Payments Work:**

1. **Checkout Creation**
   ```
   User creates booking → Travello creates Stripe Checkout session → 
   Redirect to Stripe → User enters payment info → 
   Stripe redirects to success page
   ```

2. **Payment Methods**
   - Card (credit/debit)
   - Google Pay
   - Apple Pay
   - Digital wallets

3. **Webhook Processing**
   - Stripe sends webhook when payment succeeds
   - Travello updates booking status to "Paid"
   - User receives confirmation email
   - Hotel is notified

**Payment Statuses:**
- Pending: Booking created, awaiting payment
- Completed: Payment received
- Failed: Payment declined
- Refunded: User cancelled and received refund

### Pay on Arrival Option

Users can choose to pay at the hotel instead:
- No immediate payment required
- Booking is confirmed as "Pay on Arrival"
- Hotel receives notification
- Payment confirmed when guest checks in

### Refund Policy

- Full refund within 24 hours of booking
- 50% refund 24-48 hours before checkin
- No refund within 24 hours of checkin

Refunds are processed automatically via Stripe webhook.

### Invoicing

Each completed booking generates an invoice:
- PDF available in user dashboard
- Email sent automatically
- Contains booking details and payment info

---

## Database Schema

### Core Tables

**users**
```
id, email, password, first_name, last_name, 
phone, avatar_url, is_verified, created_at
```

**hotels**
```
id, name, city, address, latitude, longitude,
rating, review_count, amenities, 
price_per_night, capacity, created_at
```

**bookings**
```
id, user_id, hotel_id, checkin_date, 
checkout_date, guests, payment_status,
booking_status, total_price, created_at
```

**reviews**
```
id, user_id, hotel_id, rating, text,
sentiment, helpful_count, created_at
```

**itineraries**
```
id, user_id, city, mood, duration,
places (JSON), created_at
```

**payments**
```
id, booking_id, stripe_id, amount,
status, created_at
```

### Indexes

Optimized queries with indexes on:
- users.email (unique)
- bookings.user_id, hotel_id
- reviews.hotel_id, user_id
- itineraries.user_id

---

## Deployment Guide

### Docker Deployment (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services Started:**
- Backend API (port 8000)
- Frontend (port 3000)
- PostgreSQL (port 5432)
- Redis (port 6379)

### Manual Deployment

**1. Server Setup**
```bash
# Create deployment directory
mkdir /var/www/travello
cd /var/www/travello

# Clone repository
git clone https://github.com/yourusername/travello.git .

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

**2. Database Setup**
```bash
# Create PostgreSQL database
createdb travello

# Run migrations
cd backend
python manage.py migrate
```

**3. Static Files**
```bash
# Collect static files
python manage.py collectstatic --noinput

# Serve with WhiteNoise
```

**4. Gunicorn Configuration**
```bash
# Create systemd service file
sudo nano /etc/systemd/system/travello.service

# Add content (see systemd service example below)
# Start service
sudo systemctl start travello
sudo systemctl enable travello
```

**Example systemd service:**
```ini
[Unit]
Description=Travello Django Application
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/var/www/travello/backend
Environment="PATH=/var/www/travello/venv/bin"
ExecStart=/var/www/travello/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    travello_backend.wsgi:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**5. Nginx Configuration**
```nginx
upstream django {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com;
    client_max_body_size 100M;

    location / {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static/ {
        alias /var/www/travello/backend/staticfiles/;
    }
}
```

**6. SSL/HTTPS**
```bash
# Use Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com
```

### Environment Variables

Create `.env` file in backend/:

```bash
# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost/travello

# Cache
REDIS_URL=redis://localhost:6379/0

# APIs
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key (optional)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
CLOUDINARY_URL=cloudinary://key:secret@cloud
OPENWEATHERMAP_API_KEY=your-openweathermap-key

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Frontend
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_STRIPE_KEY=your-stripe-publishable-key
```

---

## Configuration Reference

### Django Settings

**Debug Mode (Development Only)**
```python
DEBUG = True  # Set to False in production
```

**Allowed Hosts**
```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'yourdomain.com']
```

**Database Configuration**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'travello',
        'USER': 'postgres',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': 5432,
    }
}
```

**Cache Configuration (Redis)**
```python
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

**CORS Configuration**
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://yourdomain.com',
]
```

### Frontend Configuration

**API Base URL**
```javascript
// In .env.local
REACT_APP_API_URL=http://localhost:8000
```

**Feature Flags**
```javascript
const features = {
  ENABLE_CHAT: true,
  ENABLE_ITINERARY: true,
  ENABLE_REVIEWS: true,
};
```

---

## Troubleshooting

### Common Issues

**"ModuleNotFoundError: No module named 'transformers'"**
- Solution: `pip install -r requirements.txt` to install all dependencies

**"psycopg2: connection to database failed"**
- Check PostgreSQL is running: `psql -U postgres`
- Verify DATABASE_URL in .env
- Check database exists: `createdb travello`

**"Stripe API key not found"**
- Verify STRIPE_SECRET_KEY is set in .env
- Check key format (should start with sk_)

**"CORS error when accessing API"**
- Ensure frontend URL is in CORS_ALLOWED_ORIGINS
- Check if backend is running on correct port

**"Static files not loading in production"**
- Run: `python manage.py collectstatic`
- Verify STATIC_ROOT path exists
- Check Nginx configuration

**"Email not sending"**
- Verify EMAIL_HOST and credentials in .env
- Check Gmail App Password (not regular password)
- Enable "Less secure apps" for Gmail account

### Performance Optimization

**Database Queries**
- Use Django shell: `python manage.py shell`
- Check slow queries in logs
- Add indexes to frequently queried columns

**Caching**
- Enable Redis caching for API responses
- Cache AI model predictions
- Use browser caching for static assets

**API Response Time**
- Monitor with Sentry
- Profile code with django-silk
- Optimize database queries with select_related/prefetch_related

**Frontend Performance**
- Use React DevTools Profiler
- Check bundle size: `npm run build`
- Lazy load components and images

---

## API Examples

### Search Hotels
```bash
curl -X GET "http://localhost:8000/api/hotels/search/?city=Lahore&checkin=2024-05-01&checkout=2024-05-03" \
  -H "Authorization: Bearer <token>"
```

### Create Booking
```bash
curl -X POST "http://localhost:8000/api/bookings/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "hotel_id": 123,
    "checkin_date": "2024-05-01",
    "checkout_date": "2024-05-03",
    "guests": 2
  }'
```

### Chat with AI
```bash
curl -X POST "http://localhost:8000/api/chat/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "message": "What are the best hotels in Lahore?",
    "session_id": "user-session-123"
  }'
```

### Generate Itinerary
```bash
curl -X POST "http://localhost:8000/api/itineraries/generate/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "city": "Lahore",
    "duration": 3,
    "mood": "cultural",
    "budget": "medium"
  }'
```

---

## Support

For issues, questions, or contributions, please check the README.md or open an issue on GitHub.

Last updated: April 2024
