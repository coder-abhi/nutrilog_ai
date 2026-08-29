import json
import logging
import os
import time
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import ValidationError
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user
from crud import (
    create_health_log,
    create_tracker_card,
    create_user,
    create_weight_entry,
    decode_goals,
    get_db,
    get_daily_logs,
    get_tracker_card,
    get_tracker_entries,
    get_tracker_cards,
    get_user_by_username_and_password,
    get_weight_entries,
    set_tracker_card_visibility,
    update_tracker_card,
    update_user_profile,
    upsert_tracker_entry,
)
from met_engine import calculate_realtime_burn
from models import (
    ActivityInput,
    ExtractionResponse,
    ProfileUpdateInput,
    SignInInput,
    SignUpInput,
    TrackerCardInput,
    TrackerCardUpdateInput,
    TrackerEntryInput,
    TrackerVisibilityInput,
    WeightEntryInput,
)
from utils import aggregate_summary, parse_date_param

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nutrilog")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable is not set")

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))
if OPENAI_TIMEOUT_SECONDS <= 0:
    raise RuntimeError("OPENAI_TIMEOUT_SECONDS must be greater than 0")

client = OpenAI(
    api_key=OPENAI_API_KEY,
    timeout=OPENAI_TIMEOUT_SECONDS,
    max_retries=2,
)


class AIServiceError(Exception):
    pass


def request_ai_json(*, system_prompt: str, user_prompt: str, operation: str) -> dict:
    start_time = time.perf_counter()
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("AI response did not include content")
        payload = json.loads(content)
        if not isinstance(payload, dict):
            raise ValueError("AI response was not a JSON object")
        return payload
    except Exception as exc:
        logger.warning("%s failed (%s)", operation, type(exc).__name__)
        raise AIServiceError from exc
    finally:
        logger.info("%s took %.4fs", operation, time.perf_counter() - start_time)


app = FastAPI()

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
if not cors_origins or "*" in cors_origins:
    raise RuntimeError("CORS_ORIGINS must contain explicit origins and cannot include '*'")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/test")
def health_check():
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    error = exc.errors()[0]
    field = ".".join(str(part) for part in error.get("loc", [])[1:])
    message = error.get("msg", "Invalid request")
    detail = f"{field}: {message}" if field else message
    return JSONResponse(status_code=422, content={"detail": detail})


@app.middleware("http")
async def log_time(request, call_next):
    start = time.perf_counter()
    try:
        return await call_next(request)
    finally:
        logger.info("%s %s took %.4fs", request.method, request.url.path, time.perf_counter() - start)


def _user_payload(user):
    return {
        "username": user.username,
        "weight_kg": user.weight_kg,
        "target_weight_kg": getattr(user, "target_weight_kg", None),
        "height_cm": user.height_cm,
        "gender": user.gender,
        "activity_level": user.activity_level,
        "goals": decode_goals(user.goals),
    }

@app.post("/signup")
def signup(data: SignUpInput, db: Session = Depends(get_db)):
    username = data.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    try:
        user = create_user(
            session=db,
            dataObj=data.model_copy(update={"username": username}),
        )
        access_token = create_access_token(data={"sub": user.username})
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": _user_payload(user),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/signin")
def signin(data: SignInInput, db: Session = Depends(get_db)):
    user = get_user_by_username_and_password(db, data.username.strip(), data.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": _user_payload(user),
    }


@app.patch("/profile")
def edit_profile(data: ProfileUpdateInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = update_user_profile(
        db,
        current_user.username,
        weight_kg=data.weight_kg,
        target_weight_kg=data.target_weight_kg,
        height_cm=data.height_cm,
        gender=data.gender,
        activity_level=data.activity_level,
        goals=data.goals,
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"success": True, "user": _user_payload(user)}
@app.get("/passive_calorie_burned")
def passive_calorie_burned(current_user=Depends(get_current_user)):
    """
    Returns passive calories burned from 12:00 AM till now.
    """
    total_burned = calculate_realtime_burn(
        weight_kg=current_user.weight_kg,
        height_cm=current_user.height_cm,
        gender=current_user.gender,
        activity_level=current_user.activity_level,
        age=25
    )

    return int(total_burned)


@app.get("/today_summary")
def today_summary(
    date: str | None = None,
    days: int = Query(default=1, ge=1, le=31),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Fetch one day or an inclusive date range ending on date (YYYY-MM-DD)."""
    target_date = parse_date_param(date) if date else None
    logs = get_daily_logs(db, current_user.username, date=target_date, days=days)
    calories_intake = 0
    calories_burned = 0
    protein = 0
    carbs = 0
    fibre = 0
    sugar = 0
    foods_list = []
    activities_list = []
    insulin_curves = []
    for log in logs:
        insulin_curve = []
        if log.insulin_curve:
            try:
                insulin_curve = json.loads(log.insulin_curve)
            except json.JSONDecodeError:
                insulin_curve = []
        if insulin_curve:
            insulin_curves.append({
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "points": insulin_curve,
            })
        for f in log.foods:
            calories_intake += f.calories
            protein += f.protein
            carbs += f.carbs
            fibre += f.fibre
            sugar += f.sugar
            foods_list.append({
                "name": f.name,
                "quantity": f.quantity,
                "unit": f.unit,
                "calories": f.calories,
                "protein": f.protein,
                "carbs": f.carbs,
                "fat": f.fat,
                "fibre": f.fibre,
                "sugar": f.sugar,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            })
        for a in log.activities:
            calories_burned += a.calories_burned
            activities_list.append({
                "type": a.type,
                "quantity": a.quantity,
                "unit": a.unit,
                "calories_burned": a.calories_burned,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            })
    return {
        "summary": {
            "calories_intake": calories_intake,
            "calories_burned": calories_burned,
            "protein": protein,
            "carbs": carbs,
            "fibre": fibre,
            "sugar": sugar,
        },
        "foods": foods_list,
        "activities": activities_list,
        "insulin_curves": insulin_curves,
    }
@app.get("/weight_entries")
def list_weight_entries(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Fetch weight entries for the user, most recent first."""
    entries = get_weight_entries(db, current_user.username)
    return [
        {"value_kg": e.value_kg, "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None}
        for e in entries
    ]
@app.post("/weight_entry")
def add_weight_entry(data: WeightEntryInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Add a weight entry for the user. recorded_at optional (YYYY-MM-DD or full ISO); default now."""
    recorded_at = None
    if data.recorded_at:
        try:
            if "T" in data.recorded_at:
                recorded_at = datetime.fromisoformat(data.recorded_at.replace("Z", "+00:00"))
            else:
                recorded_at = datetime.strptime(data.recorded_at, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid recorded_at. Use YYYY-MM-DD.")
    entry = create_weight_entry(db, current_user.username, data.value_kg, recorded_at=recorded_at)
    return {"value_kg": entry.value_kg, "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None}


def _resolve_tracker_targets(value_type: str, target_value: float | None, target_days_per_week: int | None) -> tuple[int, float | None]:
    if value_type == "numeric":
        if not target_value or target_value <= 0:
            raise HTTPException(status_code=400, detail="Weekly target is required for numeric trackers.")
        # Numeric trackers target a total quantity/week (e.g. 50 pushups), not a count of
        # days, so target_days_per_week doesn't apply to them; always store the full week.
        return 7, target_value
    return target_days_per_week or 7, None


def _get_owned_tracker_or_404(db: Session, user_id: str, tracker_id: str):
    card = get_tracker_card(db, user_id, tracker_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Tracker card not found.")
    return card


def _tracker_card_payload(card, entries_by_card=None):
    card_entries = (entries_by_card or {}).get(card.id, [])
    return {
        "id": card.id,
        "name": card.name,
        "value_type": card.value_type,
        "target_days_per_week": card.target_days_per_week,
        "target_value": card.target_value,
        "description": card.description or "",
        "is_visible": bool(card.is_visible),
        "created_at": card.created_at.isoformat() if card.created_at else None,
        "entries": [
            {
                "id": entry.id,
                "date": entry.entry_date.isoformat(),
                "value": entry.value,
                "raw_text": entry.raw_text or "",
            }
            for entry in card_entries
        ],
    }


@app.get("/tracker_cards")
def list_tracker_cards(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cards = get_tracker_cards(db, current_user.username)
    # Server "today" is computed in server-local time, but a client ahead of the server
    # (e.g. UTC+5:30 just after midnight) can already be logging entries dated "tomorrow"
    # from the server's point of view. Pad the window so those entries aren't filtered out
    # of the graph/streak data right after they're created.
    end_date = date.today() + timedelta(days=1)
    start_date = end_date - timedelta(days=90)
    entries = get_tracker_entries(db, current_user.username, start_date=start_date, end_date=end_date)
    entries_by_card = {}
    for entry in entries:
        entries_by_card.setdefault(entry.tracker_id, []).append(entry)
    return [_tracker_card_payload(card, entries_by_card) for card in cards]


@app.post("/tracker_cards")
def add_tracker_card(data: TrackerCardInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    name = data.name.strip()
    value_type = data.value_type
    if not name:
        raise HTTPException(status_code=400, detail="Tracker name is required.")
    target_days_per_week, target_value = _resolve_tracker_targets(value_type, data.target_value, data.target_days_per_week)
    card = create_tracker_card(
        db,
        current_user.username,
        name=name,
        value_type=value_type,
        target_days_per_week=target_days_per_week,
        target_value=target_value,
        description=data.description,
    )
    return _tracker_card_payload(card)


@app.patch("/tracker_cards/{tracker_id}")
def edit_tracker_card(tracker_id: str, data: TrackerCardUpdateInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tracker name is required.")
    existing = _get_owned_tracker_or_404(db, current_user.username, tracker_id)
    target_days_per_week, target_value = _resolve_tracker_targets(existing.value_type, data.target_value, data.target_days_per_week)
    card = update_tracker_card(
        db,
        current_user.username,
        tracker_id,
        name=name,
        target_days_per_week=target_days_per_week,
        target_value=target_value,
        description=data.description,
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Tracker card not found.")
    return _tracker_card_payload(card)


@app.patch("/tracker_cards/{tracker_id}/visibility")
def update_tracker_visibility(tracker_id: str, data: TrackerVisibilityInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    card = set_tracker_card_visibility(db, current_user.username, tracker_id, data.is_visible)
    if card is None:
        raise HTTPException(status_code=404, detail="Tracker card not found.")
    return _tracker_card_payload(card)


@app.post("/tracker_entries")
def add_tracker_entry(data: TrackerEntryInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    card = _get_owned_tracker_or_404(db, current_user.username, data.tracker_id)
    entry_date = parse_date_param(data.date) if data.date else date.today()
    value = (1 if data.value > 0 else 0) if card.value_type == "boolean" else data.value
    entry = upsert_tracker_entry(db, current_user.username, card.id, entry_date, value, add_to_existing=card.value_type == "numeric")
    if card.value_type == "numeric" and entry.value < 0:
        entry.value = 0
        db.commit()
    return {
        "id": entry.id,
        "tracker_id": entry.tracker_id,
        "date": entry.entry_date.isoformat(),
        "value": entry.value,
    }


def _extract_tracker_updates(sentence: str, db: Session, user_id: str, target_date):
    cards = get_tracker_cards(db, user_id)
    if not cards:
        return []

    cards_prompt = [
        {
            "id": card.id,
            "name": card.name,
            "value_type": card.value_type,
            "description": card.description or card.name,
        }
        for card in cards
    ]
    system_prompt = f"""
You extract habit tracker updates from a user's health log sentence.
Return ONLY valid JSON. No markdown, no explanations.

Tracker cards:
{json.dumps(cards_prompt)}

Output format:
{{
  "updates": [
    {{
      "tracker_id": string,
      "value": number,
      "confidence": number
    }}
  ]
}}

Rules:
- Match only tracker cards clearly mentioned or implied by the sentence.
- For boolean trackers, use value 1 when the user did it/ate it, and 0 only when the user clearly says they did not.
- For numeric trackers, extract the numeric count or amount. Example: "20 pushups" -> 20.
- Use each card's description to understand synonyms.
- If nothing matches, return {{"updates": []}}.
- confidence must be between 0 and 1.
"""
    try:
        payload = request_ai_json(
            system_prompt=system_prompt,
            user_prompt=sentence,
            operation="tracker extraction",
        )
    except AIServiceError:
        return []

    updates = []
    card_by_id = {card.id: card for card in cards}
    raw_updates = payload.get("updates", [])
    if not isinstance(raw_updates, list):
        return []
    for update in raw_updates:
        if not isinstance(update, dict):
            continue
        tracker_id = update.get("tracker_id")
        card = card_by_id.get(tracker_id)
        if card is None:
            continue
        try:
            confidence = float(update.get("confidence", 0))
            raw_value = float(update.get("value", 0))
        except (TypeError, ValueError):
            continue
        if confidence < 0.55:
            continue
        value = (1 if raw_value > 0 else 0) if card.value_type == "boolean" else max(0, raw_value)
        entry = upsert_tracker_entry(db, user_id, tracker_id, target_date, value, raw_text=sentence, add_to_existing=card.value_type == "numeric")
        updates.append({
            "tracker_id": tracker_id,
            "name": card.name,
            "value": entry.value,
            "date": entry.entry_date.isoformat(),
        })
    return updates


@app.post("/log_input")
def analyze_food(data: ActivityInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sentence = data.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="Log text is required.")

    log_timestamp = None
    if data.date:
        try:
            log_timestamp = datetime.strptime(data.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if log_timestamp and data.log_time_minutes is not None:
        log_timestamp = log_timestamp + timedelta(minutes=data.log_time_minutes)

    user_config = {
        "username": current_user.username,
        "age": 25,
        "weight": current_user.weight_kg,
        "gender": current_user.gender,
        "height": current_user.height_cm,
        "activity_level": current_user.activity_level,
    }
    activity_level_descriptions = {
        "sedentary": "Barely any walking (under ~1 km/day), no sport or gym.",
        "low": "Light week - a sport, walk or workout roughly once a week.",
        "moderate": "Gym, sport or a long walk ~3x a week, or ~8k steps most days.",
        "high": "Training hard 5-6x a week, or a physically demanding job.",
        "very_high": "Intense training most days or heavy manual labour.",
    }
    activity_level_description = activity_level_descriptions.get(
        user_config["activity_level"], "Unknown activity level."
    )
    system_prompt = f"""
You are a structured health data extraction and estimation engine.
User details:
Age: {user_config['age']}
Weight: {user_config['weight']} kg
Height: {user_config['height']} cm
Gender: {user_config['gender']}
Baseline activity level: {user_config['activity_level']} ({activity_level_description})
Region: India, Maharastra
From the user's sentence, extract:

1) Physical activities performed.
2) Foods consumed.
3) A realistic postprandial insulin response curve for the foods consumed.

Return ONLY valid JSON.
Do NOT include explanations.
Do NOT include markdown.
Do NOT include text before or after the JSON.

Output format must be exactly:

{{
  "activities": [
    {{
      "type": string,
      "quantity": number,
      "unit": string,
      "calories_burned": number
    }}
  ],
  "foods": [
    {{
      "name": string,
      "quantity": number,
      "unit": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "fibre": number,
      "sugar": number,
      "saturated_fat": number,
      "sodium": number
    }}
  ],
  "insulin_curve": [
    {{
      "minute": number,
      "value": number
    }}
  ]
}}

Rules:
- All numbers must be integers.
- Always include unit.
- If qty or unit is not very clear in input then make realistic guess using activity or food
- Estimate realistic nutritional values.
- Estimate calories burned using user weight and realistic MET values, adjusted for the user's baseline activity level (e.g. a "high"/"very_high" user performing a workout is likely more conditioned and efficient than a "sedentary" user doing the same activity).
- If a category has no entries, return an empty array.
- Do not invent unrealistic quantities.
- Insulin curve values are relative to the meal time.
- If there are foods, return insulin_curve points every 10 minutes from minute 0 through minute 240 inclusive.
- Insulin value is an estimated relative insulin index from 0 to 100, where fasting/baseline is 5-10, moderate meal peak is 35-60, and high refined-carb/sugar meal peak is 70-95.
- Shape the insulin curve smoothly: start near baseline, rise after eating, peak around 30-90 minutes depending on carbs/sugar, then return near baseline by 180-240 minutes.
- If there are no foods, return "insulin_curve": [].

"""
    
    try:
        llm_return = request_ai_json(
            system_prompt=system_prompt,
            user_prompt=sentence,
            operation="health log extraction",
        )
        parsed = ExtractionResponse.model_validate(llm_return)
    except (AIServiceError, ValidationError):
        raise HTTPException(
            status_code=502,
            detail="Could not process this log right now. Please try again.",
        )

    summary = aggregate_summary(parsed.activities, parsed.foods)

    create_health_log(
        session=db,
        user_id=current_user.username,
        raw_text=sentence,
        activities=parsed.activities,
        foods=parsed.foods,
        timestamp=log_timestamp,
        insulin_curve=json.dumps([point.model_dump() for point in parsed.insulin_curve])
    )

    tracker_date = (log_timestamp or datetime.now()).date()
    tracker_updates = _extract_tracker_updates(sentence, db, current_user.username, tracker_date)
    summary["tracker_updates"] = tracker_updates

    return summary
