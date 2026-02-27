from pydantic import BaseModel
from typing import List
from datetime import datetime


class Activity(BaseModel):
    type: str
    quantity: float
    unit: str
    calories_burned: int


class Food(BaseModel):
    name: str
    quantity: float
    unit: str
    calories: int
    protein: int
    carbs: int
    fat: int
    fibre: int
    sugar: int
    saturated_fat: int
    sodium: int

class HealthLog(BaseModel):
    user_id: str
    timestamp: datetime
    activities: List[Activity]
    foods: List[Food]
    

class ExtractionResponse(BaseModel):
    activities: List[Activity]
    foods: List[Food]

class ActivityInput(BaseModel):
    sentence: str


class SignInInput(BaseModel):
    username: str
    password: str


class SignUpInput(BaseModel):
    username: str
    password: str
    weight_kg: float
    target_weight_kg: float
    height_cm: float
    gender: str  # male | female | other
    activity_level: str  # sedentary | low | moderate | high | very_high


def total_macros(log: HealthLog) -> dict:
    return {
        "protein": sum(f.protein for f in log.foods),
        "carbs": sum(f.carbs for f in log.foods),
        "fat": sum(f.fat for f in log.foods),
        "fibre": sum(f.fibre for f in log.foods),
        "sugar": sum(f.sugar for f in log.foods),
        "saturated_fat": sum(f.saturated_fat for f in log.foods),
        "sodium": sum(f.sodium for f in log.foods),
    }

