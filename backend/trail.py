from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.getenv('OPENAI_API_KEY')

client = OpenAI()

print(api_key)

system_prompt = f"""
You are a fitness calorie calculator.

User details:

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
        {"role": "user", "content": "I ran 5 km"}
    ]
)

print(response.choices[0].message.content)