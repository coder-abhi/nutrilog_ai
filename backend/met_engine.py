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