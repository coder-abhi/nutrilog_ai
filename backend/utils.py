from typing import List

from models import Activity, Food

def aggregate_summary(activities: List[Activity], foods: List[Food]) -> dict:
    return {
        "calories_intake": sum(f.calories for f in foods),
        "calories_burned": sum(a.calories_burned for a in activities),
        "protein": sum(f.protein for f in foods),
        "carbs": sum(f.carbs for f in foods),
        "fibre": sum(f.fibre for f in foods),
        "sugar": sum(f.sugar for f in foods),
    }
