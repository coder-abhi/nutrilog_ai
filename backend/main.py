from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json

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

class ActivityInput(BaseModel):
    sentence: str

class NutritionOutput(BaseModel):
    calories: int
    protein: int
    carbs: int
    fat: int
    fibre: int
    sugar: int
    saturated_fat: int
    sodium: int

@app.post("/calories")
def calculate(data: ActivityInput):

    system_prompt = f"""
You are a fitness calorie calculator.

User details:
Age: {USER_CONFIG['age']}
Weight: {USER_CONFIG['weight']} kg
Gender: {USER_CONFIG['gender']}

When given a sentence describing physical activity,
calculate estimated calories burned.

Return ONLY a single integer.
No text.
No explanation.
No units.
Just the number.
"""

    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.sentence}
        ],
    )

    return int(response.choices[0].message.content.strip())


@app.post("/intake", response_model=NutritionOutput)
def analyze_food(data: ActivityInput):

    system_prompt = f"""
You are a precise nutrition analysis engine.

When the user describes food they ate, estimate total nutritional values.
User details:
Age: {USER_CONFIG['age']}
Weight: {USER_CONFIG['weight']} kg
Gender: {USER_CONFIG['gender']}

Return ONLY valid JSON.
Do NOT include explanations.
Do NOT include units in the values.
Do NOT include text before or after the JSON.
Do NOT use markdown formatting.

Output format must be exactly:

{{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fibre": number,
  "sugar": number,
  "saturated_fat": number,
  "sodium": number
}}

Rules:
- All values must be realistic estimates.
- Numbers must be integers.
- If quantity is unclear, make a reasonable assumption.
- If food is unknown, estimate using common equivalents.
- Combine all items into total daily intake for that message.
"""

    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.sentence}
        ],
    )

    return json.loads(response.choices[0].message.content)


@app.post("/test")
def calculate(data: ActivityInput):
    return "Hello, World!"