from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

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


@app.post("/test")
def calculate(data: ActivityInput):
    return "Hello, World!"