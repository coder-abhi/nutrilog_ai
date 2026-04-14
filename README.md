# NutriLog AI

An AI-powered health and nutrition tracking application that lets users log food and activities through natural language input. Combines local NLP (sentence embeddings + MET values) with LLM fallback for accurate parsing.

## Tech Stack

**Frontend**: Next.js 16, React 19, TypeScript, Recharts  
**Backend**: FastAPI, Python 3.10+, SQLite, JWT Auth  
**AI/NLP**: OpenAI GPT-4o-mini, Sentence Transformers (all-MiniLM-L6-v2), spaCy

## Features

- **Natural Language Logging** - Log food and activities in plain English (e.g., "I ran 5km and had poha for breakfast")
- **Hybrid Parsing Pipeline** - Local sentence embeddings for common activities + LLM fallback for complex queries
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
│   ├── hybrid_parser.py     # NLP parsing pipeline
│   ├── met_engine.py        # Calorie calculation engine
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main dashboard
│   │   ├── calendar/        # Calendar view
│   │   ├── weight-tracker/  # Weight tracking
│   │   └── components/      # UI components
│   └── package.json
└── docs/
    └── decision/            # Architecture decisions
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenAI API key

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create a `.env` file in the backend directory:

```env
OPENAI_API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here
```

Start the backend server:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and the API on `http://localhost:8000`.

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
2. **Hybrid Pipeline**: 
   - Local parser uses sentence embeddings to detect known activities
   - MET values calculate calorie burn for detected activities
   - Unknown items fall back to GPT-4o-mini for parsing
3. **Storage**: Parsed data saved to SQLite with timestamps
4. **Summary**: Aggregated macros and calories returned to frontend
