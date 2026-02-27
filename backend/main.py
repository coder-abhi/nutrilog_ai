from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json

from crud import (
    create_health_log,
    create_user,
    get_db,
    get_daily_logs,
    get_user_by_username_and_password,
    get_weight_entries,
    create_weight_entry,
)
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user

from models import Activity, ActivityInput, ExtractionResponse, SignInInput, SignUpInput
from utils import aggregate_summary
from met_engine import calculate_calories_burned, calculate_realtime_burn

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


@app.post("/test")
def calculate(data: ActivityInput, db: Session = Depends(get_db)):
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


@app.post("/log_input")
def analyze_food(data: ActivityInput, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
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
        user_id=current_user.username,
        raw_text=data.sentence,
        activities=parsed.activities,
        foods=parsed.foods
    )


    return summary