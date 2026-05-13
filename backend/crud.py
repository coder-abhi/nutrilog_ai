from datetime import datetime
from sqlalchemy import Column, Integer, Nullable, String, Float, DateTime, Date, Boolean, ForeignKey, Text, create_engine, engine, text
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
from pathlib import Path
import uuid
import hashlib
import os
from dotenv import load_dotenv
from models import SignUpInput

load_dotenv(override=True)


Base = declarative_base()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, stored_hash: str) -> bool:
    return _hash_password(password) == stored_hash


DATABASE_URL = os.getenv("DATABASE_URL")
# DATABASE_URL = os.getenv("DATABASE_URL_LOCAL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")


# -----------------------------
# DATABASE MODELS (Supabase-ready)
# -----------------------------


class UserDB(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=False)
    target_weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=False)
    gender = Column(String, nullable=False)  # male | female | other
    activity_level = Column(String, nullable=False)  # sedentary | low | moderate | high | very_high
    created_at = Column(DateTime, default=datetime.utcnow)
    goal=Column[str](String,nullable=True)


class WeightEntryDB(Base):
    __tablename__ = "weight_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    value_kg = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)


class TrackerCardDB(Base):
    __tablename__ = "tracker_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    value_type = Column(String, nullable=False)  # boolean | numeric
    target_days_per_week = Column(Integer, nullable=False, default=7)
    description = Column(Text, nullable=True)
    is_visible = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    entries = relationship("TrackerEntryDB", back_populates="card", cascade="all, delete")


class TrackerEntryDB(Base):
    __tablename__ = "tracker_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tracker_id = Column(String, ForeignKey("tracker_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    entry_date = Column(Date, nullable=False, index=True)
    value = Column(Float, nullable=False)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    card = relationship("TrackerCardDB", back_populates="entries")


class HealthLogDB(Base):
    __tablename__ = "health_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    raw_text = Column(String, nullable=False)
    insulin_curve = Column(Text, nullable=True)

    activities = relationship("ActivityDB", back_populates="log", cascade="all, delete")
    foods = relationship("FoodDB", back_populates="log", cascade="all, delete")


class ActivityDB(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    log_id = Column(String, ForeignKey("health_logs.id", ondelete="CASCADE"))
    user_id = Column(String, nullable=False, index=True)

    type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    calories_burned = Column(Integer, nullable=False)

    log = relationship("HealthLogDB", back_populates="activities")


class FoodDB(Base):
    __tablename__ = "foods"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    log_id = Column(String, ForeignKey("health_logs.id", ondelete="CASCADE"))
    user_id = Column(String, nullable=False, index=True)

    name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)

    calories = Column(Integer, nullable=False)
    protein = Column(Integer, nullable=False)
    carbs = Column(Integer, nullable=False)
    fat = Column(Integer, nullable=False)
    fibre = Column(Integer, nullable=False)
    sugar = Column(Integer, nullable=False)
    saturated_fat = Column(Integer, nullable=False)
    sodium = Column(Integer, nullable=False)

    log = relationship("HealthLogDB", back_populates="foods")


# -----------------------------
# CRUD OPERATIONS
# -----------------------------


def create_user(session,dataObj:SignUpInput):
    """Create a new user. Raises if username exists."""
    if get_user_by_username(session, dataObj.username) is not None:
        raise ValueError("Username already exists")
    user = UserDB(
        username=dataObj.username,
        password_hash=_hash_password(dataObj.password),
        weight_kg=dataObj.weight_kg,
        target_weight_kg=dataObj.target_weight_kg,
        height_cm=dataObj.height_cm,
        gender=dataObj.gender,
        activity_level=dataObj.activity_level,
        goal=dataObj.goal
    )
    session.add(user)
    session.commit()
    return user


def get_user_by_username(session, username: str) -> UserDB | None:
    """Return user by username or None."""
    return session.query(UserDB).filter(UserDB.username == username).first()


def get_user_by_username_and_password(session, username: str, password: str) -> UserDB | None:
    """Return user if username and password match, else None."""
    user = get_user_by_username(session, username)
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_health_log(session, user_id: str, raw_text: str, activities, foods, timestamp: datetime | None = None, insulin_curve: str | None = None):
    """
    Persist one full transaction:
    - Creates HealthLog row
    - Inserts related Activity and Food rows
    """

    log = HealthLogDB(
        user_id=user_id,
        raw_text=raw_text,
        timestamp=timestamp or datetime.utcnow(),
        insulin_curve=insulin_curve
    )

    session.add(log)
    session.flush()  # get log.id before inserting children

    for activity in activities:
        session.add(
            ActivityDB(
                log_id=log.id,
                user_id=user_id,
                type=activity.type,
                quantity=activity.quantity,
                unit=activity.unit,
                calories_burned=activity.calories_burned
            )
        )

    for food in foods:
        session.add(
            FoodDB(
                log_id=log.id,
                user_id=user_id,
                name=food.name,
                quantity=food.quantity,
                unit=food.unit,
                calories=food.calories,
                protein=food.protein,
                carbs=food.carbs,
                fat=food.fat,
                fibre=food.fibre,
                sugar=food.sugar,
                saturated_fat=food.saturated_fat,
                sodium=food.sodium
            )
        )

    session.commit()
    return log


def get_daily_logs(session, user_id: str, date: datetime | None = None):
    """
    Fetch all logs for a user on a given date.
    """
    if date is None:
        date = datetime.now().date()

    start = datetime(date.year, date.month, date.day)
    end = datetime(date.year, date.month, date.day, 23, 59, 59)

    return session.query(HealthLogDB).filter(
        HealthLogDB.user_id == user_id,
        HealthLogDB.timestamp >= start,
        HealthLogDB.timestamp <= end
    ).order_by(HealthLogDB.timestamp.desc()).all()


def create_weight_entry(session, user_id: str, value_kg: float, recorded_at: datetime | None = None):
    """Add a weight entry for the user. recorded_at defaults to now."""
    entry = WeightEntryDB(user_id=user_id, value_kg=value_kg, recorded_at=recorded_at or datetime.utcnow())
    session.add(entry)
    session.commit()
    return entry


def get_weight_entries(session, user_id: str, limit: int = 100):
    """Get weight entries for user, most recent first."""
    return (
        session.query(WeightEntryDB)
        .filter(WeightEntryDB.user_id == user_id)
        .order_by(WeightEntryDB.recorded_at.desc())
        .limit(limit)
        .all()
    )


def create_tracker_card(session, user_id: str, name: str, value_type: str, target_days_per_week: int, description: str | None = None):
    card = TrackerCardDB(
        user_id=user_id,
        name=name.strip(),
        value_type=value_type,
        target_days_per_week=target_days_per_week,
        description=description,
        is_visible=True,
    )
    session.add(card)
    session.commit()
    return card


def get_tracker_cards(session, user_id: str):
    return (
        session.query(TrackerCardDB)
        .filter(TrackerCardDB.user_id == user_id)
        .order_by(TrackerCardDB.created_at.asc())
        .all()
    )


def get_tracker_card(session, user_id: str, tracker_id: str):
    return (
        session.query(TrackerCardDB)
        .filter(TrackerCardDB.user_id == user_id, TrackerCardDB.id == tracker_id)
        .first()
    )


def update_tracker_card(session, user_id: str, tracker_id: str, name: str, target_days_per_week: int, description: str | None = None):
    card = get_tracker_card(session, user_id, tracker_id)
    if card is None:
        return None
    card.name = name.strip()
    card.target_days_per_week = target_days_per_week
    card.description = description
    session.commit()
    return card


def set_tracker_card_visibility(session, user_id: str, tracker_id: str, is_visible: bool):
    card = get_tracker_card(session, user_id, tracker_id)
    if card is None:
        return None
    card.is_visible = is_visible
    session.commit()
    return card


def upsert_tracker_entry(session, user_id: str, tracker_id: str, entry_date, value: float, raw_text: str | None = None, add_to_existing: bool = False):
    entry = (
        session.query(TrackerEntryDB)
        .filter(
            TrackerEntryDB.user_id == user_id,
            TrackerEntryDB.tracker_id == tracker_id,
            TrackerEntryDB.entry_date == entry_date,
        )
        .first()
    )
    if entry is None:
        entry = TrackerEntryDB(
            user_id=user_id,
            tracker_id=tracker_id,
            entry_date=entry_date,
            value=value,
            raw_text=raw_text,
        )
        session.add(entry)
    else:
        entry.value = entry.value + value if add_to_existing else value
        entry.raw_text = raw_text or entry.raw_text
        entry.created_at = datetime.utcnow()
    session.commit()
    return entry


def get_tracker_entries(session, user_id: str, start_date=None, end_date=None):
    query = session.query(TrackerEntryDB).filter(TrackerEntryDB.user_id == user_id)
    if start_date is not None:
        query = query.filter(TrackerEntryDB.entry_date >= start_date)
    if end_date is not None:
        query = query.filter(TrackerEntryDB.entry_date <= end_date)
    return query.order_by(TrackerEntryDB.entry_date.asc()).all()


LOCAL_DB_PATH = Path(__file__).resolve().parent / "local.db"

# engine = create_engine(f"sqlite:///{LOCAL_DB_PATH}", connect_args={"check_same_thread": False})

# engine = create_engine(
#     DATABASE_URL,
#     connect_args={"sslmode": "require"}
# )
engine = create_engine(
    f"sqlite:///{LOCAL_DB_PATH}",
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(engine)


def _migrate_add_target_weight():
    """Add target_weight_kg to users if missing (e.g. existing DBs)."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN target_weight_kg REAL"))
            conn.commit()
        except Exception:
            conn.rollback()


_migrate_add_target_weight()


def _migrate_add_insulin_curve():
    """Add insulin_curve to health_logs if missing."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE health_logs ADD COLUMN insulin_curve TEXT"))
            conn.commit()
        except Exception:
            conn.rollback()


_migrate_add_insulin_curve()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
