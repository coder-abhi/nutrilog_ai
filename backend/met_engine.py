from datetime import datetime as dt

from utils import DAY_START_HOUR


def calculate_realtime_burn(
    weight_kg: float,
    height_cm: float,
    gender: str,
    activity_level: str | None = None,
    age: int | None = None,
    local_minutes: float | None = None,
) -> float:
    """
    Calculates calories burned from the day's 3 AM start till the current moment.
    Assumes:
    - First 6 hours (03:00-09:00) sleeping
    - Remaining hours waking

    `local_minutes` (0-1439, minutes since the client's local midnight) should be supplied by
    the caller whenever known - the server's own clock reflects its host's timezone, not the
    user's, so falling back to it here can badly misjudge "hours elapsed today" for anyone not
    in the same timezone as the server.
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

    if local_minutes is None:
        now = dt.now()
        local_minutes = now.hour * 60 + now.minute
    hours_since_day_start = ((local_minutes - DAY_START_HOUR * 60) % 1440) / 60

    sleep_hours = min(hours_since_day_start, 6)
    wake_hours = max(0, hours_since_day_start - 6)

    total_burned = (sleep_hours * sleep_cal_per_hour) + (wake_hours * wake_cal_per_hour)

    return round(total_burned, 2)
