# NutriLog AI

An AI-powered health and nutrition tracking application that lets users log food and activities through natural language input.

## Tech Stack

**Web**: Next.js 16, React 19, TypeScript
**Mobile**: Expo 54, React Native 0.81, Expo Router
**Backend**: FastAPI, Python 3.12, SQLAlchemy, SQLite/PostgreSQL, JWT auth
**AI**: OpenAI structured JSON extraction

## Features

- **Natural Language Logging** - Log food and activities in plain English (e.g., "I ran 5km and had poha for breakfast")
- **MET-based Calorie Calculation** - Accurate calorie burn estimation using MET values and user biometrics
- **Macro Tracking** - Track calories, protein, carbs, fat, fiber, and sugar intake
- **Weight Tracking** - Log and visualize weight changes over time
- **Calendar View** - Review past health logs by date
- **User Authentication** - JWT-based auth with personalized user profiles

## Project Structure

```
nutrilog-ai/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Pydantic models
│   ├── crud.py              # Database operations
│   ├── auth.py              # JWT authentication
│   ├── met_engine.py        # Calorie calculation engine
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main dashboard
│   │   ├── calendar/        # Calendar view
│   │   ├── weight-tracker/  # Weight tracking
│   │   └── components/      # UI components
│   └── package.json
├── mobile/                  # Expo mobile application
└── docs/
    └── decision/            # Architecture decisions
```

## Setup

### Prerequisites

- Python 3.12
- Node.js 20+
- OpenAI API key

### Backend

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
```

Create the backend environment file:

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` and a random `JWT_SECRET_KEY` of at least 32 characters. For production, set `DATABASE_URL` to PostgreSQL and list the exact web origins in `CORS_ORIGINS`.

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

The frontend runs on `http://localhost:3000` and the API on `http://localhost:8000`.

### Mobile

```bash
cd mobile
npm ci
cp .env.example .env
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Create new user account |
| POST | `/signin` | Authenticate user |
| POST | `/log_input` | Log food/activity via natural language |
| GET | `/today_summary` | Get daily calories and macros |
| GET | `/weight_entries` | Get weight history |
| POST | `/weight_entry` | Add weight entry |
| GET | `/passive_calorie_burned` | Get passive calories burned today |

## How It Works

1. **Input Parsing**: User enters natural language (e.g., "I walked 3km and ate 2 rotis")
2. **Structured Extraction**: The configured OpenAI model returns validated food, activity, and insulin-curve JSON.
3. **Storage**: Parsed data saved to SQLite with timestamps
4. **Summary**: Aggregated macros and calories returned to frontend
