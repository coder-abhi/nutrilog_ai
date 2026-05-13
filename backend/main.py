from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json
import logging  # for printing time taken by every query

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user

from models import Activity, ActivityInput, ExtractionResponse, SignInInput, SignUpInput, TrackerCardInput, TrackerCardUpdateInput, TrackerEntryInput, TrackerVisibilityInput
from utils import aggregate_summary
from met_engine import calculate_realtime_burn


# Configure logging to write to 'app.log'
logging.basicConfig(
    filename='nutrilog_info.log', 
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

from crud import (
    create_health_log,
    create_user,
    get_db,
    get_daily_logs,
    get_user_by_username_and_password,
    get_weight_entries,
    create_weight_entry,
    create_tracker_card,
    get_tracker_cards,
    get_tracker_card,
    get_tracker_entries,
    set_tracker_card_visibility,
    update_tracker_card,
    upsert_tracker_entry,
)


load_dotenv(override=True)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()

import time

def measure_openai_latency(func, *args, **kwargs):
    start_time = time.time()
    response = func(*args, **kwargs)
    end_time = time.time()

    duration = end_time - start_time
    print(f"⏱️ OpenAI API call took {duration:.4f} seconds")
    logging.info(f"OpenAI API call took {duration:.4f} seconds")

    return response
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/test")
def calculate(db: Session = Depends(get_db)):
    return "Hello, World!"

from typing import List
# from pydantic import BaseModel

@app.middleware("http")
async def log_time(request, call_next):
    import time
    start = time.time()

    response = await call_next(request)

    duration = time.time() - start
    logging.info(f"{request.url.path} took {duration:.4f}s")

    return response

@app.post("/signup")
def signup(data: SignUpInput, db: Session = Depends(get_db)):
    try:
        user = create_user(
            session=db,
            dataObj=data
        )
        access_token = create_access_token(data={"sub": user.username})
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "username": user.username,
                "weight_kg": user.weight_kg,
                "target_weight_kg": getattr(user, "target_weight_kg", None),
                "height_cm": user.height_cm,
                "gender": user.gender,
                "activity_level": user.activity_level,
                "goal": user.goal or "",
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/signin")
def signin(data: SignInInput, db: Session = Depends(get_db)):
    user = get_user_by_username_and_password(db, data.username, data.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "weight_kg": user.weight_kg,
            "target_weight_kg": getattr(user, "target_weight_kg", None),
            "height_cm": user.height_cm,
            "gender": user.gender,
            "activity_level": user.activity_level,
            "goal": user.goal or "",
        },
    }
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
def today_summary(date: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Fetch aggregated calories/macros and food/activity entries for the user for a given date (YYYY-MM-DD). Defaults to today."""
    from datetime import datetime as dt
    if date:
        try:
            target_date = dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        target_date = None
    logs = get_daily_logs(db, current_user.username, date=target_date)
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




class WeightEntryInput(BaseModel):
    value_kg: float
    recorded_at: str | None = None  # optional ISO date "YYYY-MM-DD" or datetime; defaults to now


@app.post("/weight_entry")
def add_weight_entry(data: WeightEntryInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Add a weight entry for the user. recorded_at optional (YYYY-MM-DD or full ISO); default now."""
    from datetime import datetime as dt
    recorded_at = None
    if data.recorded_at:
        try:
            if "T" in data.recorded_at:
                recorded_at = dt.fromisoformat(data.recorded_at.replace("Z", "+00:00"))
            else:
                recorded_at = dt.strptime(data.recorded_at, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid recorded_at. Use YYYY-MM-DD.")
    entry = create_weight_entry(db, current_user.username, data.value_kg, recorded_at=recorded_at)
    return {"value_kg": entry.value_kg, "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None}


def _tracker_card_payload(card, entries_by_card=None):
    card_entries = (entries_by_card or {}).get(card.id, [])
    return {
        "id": card.id,
        "name": card.name,
        "value_type": card.value_type,
        "target_days_per_week": card.target_days_per_week,
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
    from datetime import date, timedelta

    cards = get_tracker_cards(db, current_user.username)
    end_date = date.today()
    start_date = end_date - timedelta(days=89)
    entries = get_tracker_entries(db, current_user.username, start_date=start_date, end_date=end_date)
    entries_by_card = {}
    for entry in entries:
        entries_by_card.setdefault(entry.tracker_id, []).append(entry)
    return [_tracker_card_payload(card, entries_by_card) for card in cards]


@app.post("/tracker_cards")
def add_tracker_card(data: TrackerCardInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    name = data.name.strip()
    value_type = data.value_type.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Tracker name is required.")
    if value_type not in {"boolean", "numeric"}:
        raise HTTPException(status_code=400, detail="value_type must be boolean or numeric.")
    if data.target_days_per_week < 1 or data.target_days_per_week > 7:
        raise HTTPException(status_code=400, detail="target_days_per_week must be between 1 and 7.")
    card = create_tracker_card(
        db,
        current_user.username,
        name=name,
        value_type=value_type,
        target_days_per_week=data.target_days_per_week,
        description=data.description,
    )
    return _tracker_card_payload(card)


@app.patch("/tracker_cards/{tracker_id}")
def edit_tracker_card(tracker_id: str, data: TrackerCardUpdateInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tracker name is required.")
    if data.target_days_per_week < 1 or data.target_days_per_week > 7:
        raise HTTPException(status_code=400, detail="target_days_per_week must be between 1 and 7.")
    card = update_tracker_card(
        db,
        current_user.username,
        tracker_id,
        name=name,
        target_days_per_week=data.target_days_per_week,
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
    from datetime import datetime as dt, date

    card = get_tracker_card(db, current_user.username, data.tracker_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Tracker card not found.")
    if data.date:
        try:
            entry_date = dt.strptime(data.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        entry_date = date.today()
    value = 1 if card.value_type == "boolean" and data.value > 0 else data.value
    entry = upsert_tracker_entry(db, current_user.username, card.id, entry_date, value, add_to_existing=card.value_type == "numeric")
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
        response = measure_openai_latency(
            client.chat.completions.create,
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": sentence},
            ],
        )
        payload = json.loads(response.choices[0].message.content)
    except Exception as exc:
        logging.warning(f"Tracker extraction failed: {exc}")
        return []

    updates = []
    card_by_id = {card.id: card for card in cards}
    for update in payload.get("updates", []):
        tracker_id = update.get("tracker_id")
        card = card_by_id.get(tracker_id)
        if card is None:
            continue
        confidence = float(update.get("confidence", 0))
        if confidence < 0.55:
            continue
        raw_value = float(update.get("value", 0))
        value = 1 if card.value_type == "boolean" and raw_value > 0 else raw_value
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
    from datetime import datetime as dt, timedelta

    log_timestamp = None
    if data.date:
        try:
            log_timestamp = dt.strptime(data.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if log_timestamp and data.log_time_minutes is not None:
        if data.log_time_minutes < 0 or data.log_time_minutes > 1439:
            raise HTTPException(status_code=400, detail="Invalid log_time_minutes. Use 0-1439.")
        log_timestamp = log_timestamp + timedelta(minutes=data.log_time_minutes)

    user_config = {
        "username": current_user.username,
        "age": 25,
        "weight": current_user.weight_kg,
        "gender": current_user.gender,
        "height": current_user.height_cm,
        "activity_level": current_user.activity_level,
    }
    system_prompt = f"""
You are a structured health data extraction and estimation engine.
User details:
Age: {user_config['age']}
Weight: {user_config['weight']} kg
Gender: {user_config['gender']}
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
- Estimate calories burned using user weight and realistic MET values.
- If a category has no entries, return an empty array.
- Do not invent unrealistic quantities.
- Insulin curve values are relative to the meal time.
- If there are foods, return insulin_curve points every 10 minutes from minute 0 through minute 240 inclusive.
- Insulin value is an estimated relative insulin index from 0 to 100, where fasting/baseline is 5-10, moderate meal peak is 35-60, and high refined-carb/sugar meal peak is 70-95.
- Shape the insulin curve smoothly: start near baseline, rise after eating, peak around 30-90 minutes depending on carbs/sugar, then return near baseline by 180-240 minutes.
- If there are no foods, return "insulin_curve": [].

"""
    
    response = measure_openai_latency(
        client.chat.completions.create,
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.sentence}
        ],
    )

    print("-"*20, "User Prompt", "-"*20)
    print(data.sentence)

    llm_return = json.loads(response.choices[0].message.content)

    parsed = ExtractionResponse(**llm_return)

    print("-"*20,"PARSED Data","-"*20)
    print(parsed)
    summary = aggregate_summary(parsed.activities, parsed.foods)

        # ---- save to database ----
    create_health_log(
        session=db,
        user_id=current_user.username,
        raw_text=data.sentence,
        activities=parsed.activities,
        foods=parsed.foods,
        timestamp=log_timestamp,
        insulin_curve=json.dumps([point.model_dump() for point in parsed.insulin_curve])
    )

    tracker_date = (log_timestamp or dt.now()).date()
    tracker_updates = _extract_tracker_updates(data.sentence, db, current_user.username, tracker_date)
    summary["tracker_updates"] = tracker_updates

    return summary
