from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json

from crud import (
    SessionLocal,
    create_health_log,
    create_user,
    get_daily_logs,
    get_user_by_username,
    get_user_by_username_and_password,
    get_weight_entries,
    create_weight_entry,
)
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from models import Activity, ActivityInput, ExtractionResponse, SignInInput, SignUpInput
from utils import aggregate_summary
from met_engine import calculate_calories_burned

load_dotenv(override=True)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/test")
def calculate(data: ActivityInput):
    return "Hello, World!"

from typing import List
# from pydantic import BaseModel

@app.post("/signup")
def signup(data: SignUpInput, db: Session = Depends(get_db)):
    try:
        user = create_user(
            session=db,
            username=data.username,
            password=data.password,
            weight_kg=data.weight_kg,
            target_weight_kg=data.target_weight_kg,
            height_cm=data.height_cm,
            gender=data.gender,
            activity_level=data.activity_level,
        )
        return {
            "success": True,
            "user": {
                "username": user.username,
                "weight_kg": user.weight_kg,
                "target_weight_kg": getattr(user, "target_weight_kg", None),
                "height_cm": user.height_cm,
                "gender": user.gender,
                "activity_level": user.activity_level,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/signin")
def signin(data: SignInInput, db: Session = Depends(get_db)):
    user = get_user_by_username_and_password(db, data.username, data.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "success": True,
        "user": {
            "username": user.username,
            "weight_kg": user.weight_kg,
            "target_weight_kg": getattr(user, "target_weight_kg", None),
            "height_cm": user.height_cm,
            "gender": user.gender,
            "activity_level": user.activity_level,
        },
    }


@app.get("/today_summary")
def today_summary(username: str, db: Session = Depends(get_db)):
    """Fetch today's aggregated calories/macros and list of food/activity entries for the user."""
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found. Please sign in.")
    logs = get_daily_logs(db, user.username)
    calories_intake = 0
    calories_burned = 0
    protein = 0
    carbs = 0
    fibre = 0
    sugar = 0
    foods_list = []
    activities_list = []
    for log in logs:
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
    }


@app.get("/weight_entries")
def list_weight_entries(username: str, db: Session = Depends(get_db)):
    """Fetch weight entries for the user, most recent first."""
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found. Please sign in.")
    entries = get_weight_entries(db, user.username)
    return [
        {"value_kg": e.value_kg, "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None}
        for e in entries
    ]


class WeightEntryInput(BaseModel):
    username: str
    value_kg: float


@app.post("/weight_entry")
def add_weight_entry(data: WeightEntryInput, db: Session = Depends(get_db)):
    """Add a weight entry for the user."""
    user = get_user_by_username(db, data.username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found. Please sign in.")
    entry = create_weight_entry(db, user.username, data.value_kg)
    return {"value_kg": entry.value_kg, "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None}


@app.post("/log_input")
def analyze_food(data: ActivityInput, db: Session = Depends(get_db)):
    user = get_user_by_username(db, data.username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found. Please sign in.")
    user_config = {
        "username": user.username,
        "age": 30,
        "weight": user.weight_kg,
        "gender": user.gender,
        "height": user.height_cm,
        "activity_level": user.activity_level,
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

"""

    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.sentence}
        ],
    )

    llm_return = json.loads(response.choices[0].message.content)
    parsed = ExtractionResponse(**llm_return)
    summary = aggregate_summary(parsed.activities, parsed.foods)
    tmp_calori_burned = 0
    for activity in parsed.activities:
        tmp_calori_burned += calculate_calories_burned(activity.type, activity.quantity, activity.unit, user_config["weight"])

    print("Calories Burned by MET :",tmp_calori_burned)
    if(tmp_calori_burned != 0):
        summary["calories_burned"] = tmp_calori_burned

        # ---- save to database ----
    create_health_log(
        session=db,
        user_id=user_config["username"],
        raw_text=data.sentence,
        activities=parsed.activities,
        foods=parsed.foods
    )


    return summary