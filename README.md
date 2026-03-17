# 📊 SocialStats — Social Media Agency Dashboard

Multi-tenant social media analytics dashboard for marketing agencies.
Automatically syncs data from Facebook, Instagram, YouTube, LinkedIn, and Google My Business.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 4.2 + Django REST Framework |
| Auth | JWT (SimpleJWT) |
| Task Queue | Celery + Redis |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React 18 + React Router |
| Charts | Recharts |
| PDF Export | jsPDF + html2canvas |

---

## 👤 User Roles

| Role | Access |
|------|--------|
| **superadmin** | All clients, admin panel, create accounts |
| **staff** | Assigned clients only |
| **client** | Their own data only |

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API credentials

# Run database migrations
python manage.py migrate

# Create superadmin + Celery schedules
python manage.py setup
# Default: admin@agency.com / admin123

# Start Django server
python manage.py runserver
```

### 2. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Copy env file
cp .env.example .env

# Start React dev server
npm start
# Opens at http://localhost:3000
```

### 3. Start Celery (auto-sync)

Open two extra terminal windows:

```bash
# Terminal 1: Celery worker (processes sync tasks)
cd backend
celery -A dashboard worker -l info

# Terminal 2: Celery beat (triggers scheduled syncs)
cd backend
celery -A dashboard beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### 4. Install Redis (required for Celery)

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt install redis-server && sudo systemctl start redis

# Windows — use WSL or Docker:
docker run -d -p 6379:6379 redis
```

---

## 🔑 Getting API Credentials

### Meta (Facebook + Instagram)
1. Go to https://developers.facebook.com → **Create App** → Business type
2. Add products: **Pages API** + **Instagram Graph API**
3. Settings → Basic → copy **App ID** + **App Secret**
4. Facebook Login → Settings → add `http://localhost:8000/api/oauth/facebook/callback/`
5. Submit app for **App Review** (required for real users)

### Google (YouTube + Google My Business)
1. Go to https://console.cloud.google.com → New Project
2. APIs & Services → **Enable APIs**:
   - YouTube Data API v3
   - YouTube Analytics API
   - Business Profile API
3. Credentials → **Create OAuth 2.0 Client ID** (Web Application type)
4. Add redirect URI: `http://localhost:8000/api/oauth/google/callback/`
5. Copy **Client ID** + **Client Secret**

### LinkedIn
1. Go to https://www.linkedin.com/developers → **Create App**
2. Associate with your LinkedIn Company Page
3. Products tab → Request **Marketing Developer Platform** (1-5 business days)
4. Auth tab → copy **Client ID** + **Client Secret**
5. Add redirect URI: `http://localhost:8000/api/oauth/linkedin/callback/`

---

## 👥 Adding a New Client

**Option 1 — Via Admin Panel (http://localhost:3000/admin):**
1. Click **+ Add New Client**
2. Fill in Company, Name, Email, Password
3. Click **Create Client**
4. The client can now log in at http://localhost:3000/login

**Option 2 — Via API:**
```bash
POST /api/admin/create-client/
{
  "company": "Acme Corp",
  "name": "John Smith",
  "email": "john@acmecorp.com",
  "password": "securepassword123"
}
```

---

## 🔌 Connecting Client Accounts

Once the client logs in:
1. Go to **Connect Accounts** (Settings page)
2. Click **Connect Facebook** → redirected to Facebook login → approve permissions
3. Click **Connect Google** → redirected to Google login → approve permissions
4. Click **Connect LinkedIn** → redirected to LinkedIn login → approve permissions
5. Data starts syncing automatically

---

## ⏰ Auto-Sync Schedule

| Platform | Frequency |
|----------|-----------|
| Facebook | Every 6 hours |
| Instagram | Every 6 hours |
| YouTube | Every 12 hours |
| LinkedIn | Every 12 hours |
| Google My Business | Every 24 hours |

---

## 📡 API Endpoints

```
POST   /api/auth/login/                    Login
POST   /api/auth/refresh/                  Refresh JWT token
GET    /api/auth/me/                       Current user info

GET    /api/clients/                       List clients
GET    /api/clients/{id}/summary/          KPI totals
GET    /api/clients/{id}/timeseries/       Daily metrics for charts
GET    /api/clients/{id}/posts/            Per-post metrics
POST   /api/clients/{id}/trigger_sync/     Manual sync trigger
GET    /api/clients/{id}/sync_status/      Sync history

GET    /api/oauth/status/{client_id}/      Connection status all platforms
GET    /api/oauth/facebook/start/{id}/     Start Facebook OAuth
GET    /api/oauth/google/start/{id}/       Start Google OAuth
GET    /api/oauth/linkedin/start/{id}/     Start LinkedIn OAuth
DELETE /api/oauth/disconnect/{id}/{plat}/  Disconnect platform

GET    /api/overview/                      Agency-wide totals (admin)
GET    /api/synclogs/                      Recent sync activity

POST   /api/admin/create-client/           Create client + login account
```

---

## 🚀 Production Deployment

```bash
# Update .env for production
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
FRONTEND_URL=https://yourdomain.com
# Use PostgreSQL instead of SQLite
# Use real Redis server
# Use real SMTP for email

# Build React frontend
cd frontend && npm run build

# Run with Gunicorn
cd backend
gunicorn dashboard.wsgi:application --bind 0.0.0.0:8000 --workers 4

# Serve with Nginx (example config included below)
```

### Nginx Config
```nginx
server {
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /path/to/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📁 Project Structure

```
social-dashboard/
├── backend/
│   ├── dashboard/              Django project config
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── celery.py
│   ├── social_stats/           Main app
│   │   ├── models.py           Client, UserProfile, PlatformCredential, DailyMetric, PostMetric, SyncLog
│   │   ├── views.py            REST API views (role-based access)
│   │   ├── oauth_views.py      OAuth flows for all 5 platforms
│   │   ├── tasks.py            Celery sync tasks
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── admin.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── App.js              Routes + auth protection
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── ClientDashboard.jsx   Client stats view
        │   ├── AdminOverview.jsx     Agency admin view
        │   └── SettingsPage.jsx      Connect accounts
        ├── components/
        │   ├── layout/Sidebar.jsx
        │   ├── charts/Charts.jsx
        │   └── ui/
        │       ├── StatCard.jsx
        │       ├── PlatformTabs.jsx
        │       ├── DateRangePicker.jsx
        │       └── ConnectedAccounts.jsx
        ├── hooks/
        │   ├── useAuth.js
        │   └── useData.js
        └── services/
            ├── api.js
            ├── platforms.js
            └── exportPDF.js
```
