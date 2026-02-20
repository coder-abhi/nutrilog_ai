from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json
import crud

from models import Activity, ActivityInput, ExtractionResponse
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

USER_CONFIG = {
    "age": 25,
    "weight": 82,
    "gender": "male",
    "height": 185.42,
    "activity_level": "low",
}

@app.post("/test")
def calculate(data: ActivityInput):
    return "Hello, World!"

from typing import List
# from pydantic import BaseModel

@app.post("/log_input")
def analyze_food(data: ActivityInput):

    system_prompt = f"""
You are a structured health data extraction and estimation engine.
User details:
Age: {USER_CONFIG['age']}
Weight: {USER_CONFIG['weight']} kg
Gender: {USER_CONFIG['gender']}
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
        tmp_calori_burned += calculate_calories_burned(activity.type,activity.quantity,activity.unit,USER_CONFIG['weight'])

    print("Calories Burned by MET :",tmp_calori_burned)
    if(tmp_calori_burned != 0):
        summary["calories_burned"] = tmp_calori_burned

    return summary