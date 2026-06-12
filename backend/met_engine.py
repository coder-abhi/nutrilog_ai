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
        "very_high":1.75,
        "very high":1.75,
    }
    activity_multiplier = activity_multipliers.get((activity_level or "low").lower(), 1.2)

    sleep_cal_per_hour = (bmr / 24) * 0.95
    wake_cal_per_hour = (bmr / 24) * activity_multiplier

    now = dt.now()
    hours_since_midnight = now.hour + now.minute / 60

    sleep_hours = min(hours_since_midnight, 6)
    wake_hours = max(0, hours_since_midnight - 6)

    total_burned = (sleep_hours * sleep_cal_per_hour) + (wake_hours * wake_cal_per_hour)

    return round(total_burned, 2)
