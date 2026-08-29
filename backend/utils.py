from datetime import date, datetime, timedelta
from typing import List

from fastapi import HTTPException

from models import Activity, Food

# The tracking day rolls over at 3 AM local time, not midnight, so a meal logged at 1 AM still
# counts toward the previous day instead of starting a new (mostly empty) one. Mirrors
# DAY_WINDOW_START_MINUTES / logicalDate on the mobile and web clients.
DAY_START_HOUR = 3


def parse_date_param(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")


def logical_date(timestamp: datetime) -> date:
    """The tracking-day date a real timestamp belongs to, given the 3 AM day boundary."""
    if timestamp.hour < DAY_START_HOUR:
        return (timestamp - timedelta(days=1)).date()
    return timestamp.date()


def day_window(target_date: date) -> tuple[datetime, datetime]:
    """The [start, end) real-timestamp window covered by a tracking day starting at 3 AM."""
    start = datetime(target_date.year, target_date.month, target_date.day, DAY_START_HOUR)
    end = start + timedelta(days=1)
    return start, end


def aggregate_summary(activities: List[Activity], foods: List[Food]) -> dict:
    return {
        "calories_intake": sum(f.calories for f in foods),
        "calories_burned": sum(a.calories_burned for a in activities),
        "protein": sum(f.protein for f in foods),
        "carbs": sum(f.carbs for f in foods),
        "fibre": sum(f.fibre for f in foods),
        "sugar": sum(f.sugar for f in foods),
    }
