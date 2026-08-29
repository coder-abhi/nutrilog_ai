from datetime import date, datetime
from typing import List

from fastapi import HTTPException

from models import Activity, Food


def parse_date_param(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")


def aggregate_summary(activities: List[Activity], foods: List[Food]) -> dict:
    return {
        "calories_intake": sum(f.calories for f in foods),
        "calories_burned": sum(a.calories_burned for a in activities),
        "protein": sum(f.protein for f in foods),
        "carbs": sum(f.carbs for f in foods),
        "fibre": sum(f.fibre for f in foods),
        "sugar": sum(f.sugar for f in foods),
    }
