MET_VALUES = {
    "walking": 3.8,
    "running": 9.8,
    "cycling": 7.5,
    "swimming": 8.0,
    "weight training": 6.0,
    "yoga": 3.0,
    "football": 8.5,
    "basketball": 8.0,
}

AVERAGE_SPEED = {
    "walking": 5,     # km/h
    "running": 10,
    "cycling": 15,
}

def calculate_calories_burned(activity_type: str, quantity: float, unit: str, weight: float) -> int:
    
    activity_type = activity_type.lower()
    print("Activity Type: ",activity_type)
    print("Qty",quantity)
    print("Uint: ",unit)

    if activity_type not in MET_VALUES:
        return 0  # unknown activity

    met = MET_VALUES[activity_type]

    # Convert to duration in hours
    duration_hours = 0

    if unit == "km":
        speed = AVERAGE_SPEED.get(activity_type, 5)
        duration_hours = quantity / speed

    elif unit in ["minute", "minutes"]:
        duration_hours = quantity / 60

    elif unit in ["hour", "hours"]:
        duration_hours = quantity

    else:
        return 0  # unsupported unit

    calories = met * weight * duration_hours

    return round(calories)

# --- Real-time calorie burn calculation ---
from datetime import datetime as dt

def calculate_realtime_burn(weight_kg: float, height_cm: float, gender: str, activity_level: str | None = None, age: int | None = None) -> float:
    """
    Calculates calories burned from 12:00 AM till current moment.
    Assumes:
    - First 6 hours (00:00–06:00) sleeping
    - Remaining hours waking
    """
    if age is None:
        age = 25

    # BMR Calculation
    if gender.lower() == "male":
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    else:
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

    # Activity multiplier (simple default mapping)
    activity_multipliers = {
        "sedentary":1.1,
        "low":1.2,
        "moderate":1.35,
        "high":1.55,
        "very high":1.75
    }
    activity_multiplier = activity_multipliers.get((activity_level or "low").lower(), 1.2)

    sleep_cal_per_hour = (bmr / 24) * 0.95
    wake_cal_per_hour = (bmr / 24) * activity_multiplier

    now = dt.now()
    hours_since_midnight = now.hour + now.minute / 60

    sleep_hours = min(hours_since_midnight, 6)
    wake_hours = max(0, hours_since_midnight - 6)

    # print("Sleep Hours: ",sleep_hours,"\t Wake Hours:",wake_hours)

    total_burned = (sleep_hours * sleep_cal_per_hour) + (wake_hours * wake_cal_per_hour)

    return round(total_burned, 2)
