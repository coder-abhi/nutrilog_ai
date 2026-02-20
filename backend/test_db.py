from crud import SessionLocal, create_health_log
from types import SimpleNamespace

db = SessionLocal()

# fake activity + food objects
activity = SimpleNamespace(
    type="walking",
    quantity=5,
    unit="km",
    calories_burned=300
)

food = SimpleNamespace(
    name="chapati",
    quantity=2,
    unit="unit",
    calories=200,
    protein=6,
    carbs=40,
    fat=4,
    fibre=6,
    sugar=2,
    saturated_fat=1,
    sodium=250
)

create_health_log(
    session=db,
    user_id="test_user",
    raw_text="I walked 5 km and ate 2 chapatis",
    activities=[activity],
    foods=[food]
)

db.close()

print("Inserted successfully")