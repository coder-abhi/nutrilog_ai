import base64
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import uuid

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import declarative_base, relationship, selectinload, sessionmaker

from models import SignUpInput

load_dotenv()


Base = declarative_base()


PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 600_000


def _encode_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode_bytes(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${_encode_bytes(salt)}${_encode_bytes(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith(f"{PASSWORD_SCHEME}$"):
        try:
            _, iterations, encoded_salt, encoded_digest = stored_hash.split("$", 3)
            digest = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                _decode_bytes(encoded_salt),
                int(iterations),
            )
            return hmac.compare_digest(digest, _decode_bytes(encoded_digest))
        except (TypeError, ValueError):
            return False

    legacy_digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy_digest, stored_hash)


def _password_needs_upgrade(stored_hash: str) -> bool:
    if not stored_hash.startswith(f"{PASSWORD_SCHEME}$"):
        return True
    try:
        return int(stored_hash.split("$", 2)[1]) < PASSWORD_ITERATIONS
    except (IndexError, ValueError):
        return True


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
    goals = Column(Text, nullable=True)  # JSON-encoded list[str]; supersedes `goal`


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
    target_days_per_week = Column(Integer, nullable=False, default=7)  # boolean trackers: days/week target
    target_value = Column(Float, nullable=True)  # numeric trackers: total quantity/week target
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


def encode_goals(goals: list[str] | None) -> str | None:
    if not goals:
        return None
    return json.dumps(goals)


def decode_goals(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except ValueError:
        return []
    return parsed if isinstance(parsed, list) else []


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
        goals=encode_goals(dataObj.goals),
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ValueError("Username already exists") from exc
    session.refresh(user)
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
    if _password_needs_upgrade(user.password_hash):
        user.password_hash = _hash_password(password)
        session.commit()
    return user


def update_user_profile(session, username: str, *, weight_kg: float, target_weight_kg: float | None, height_cm: float, gender: str, activity_level: str, goals: list[str] | None):
    user = get_user_by_username(session, username)
    if user is None:
        return None
    user.weight_kg = weight_kg
    user.target_weight_kg = target_weight_kg
    user.height_cm = height_cm
    user.gender = gender
    user.activity_level = activity_level
    user.goals = encode_goals(goals)
    session.commit()
    session.refresh(user)
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


def get_daily_logs(session, user_id: str, date=None, days: int = 1):
    """Fetch logs for an inclusive date range, newest first."""
    target_date = date or datetime.now().date()
    start_date = target_date - timedelta(days=days - 1)
    start = datetime(start_date.year, start_date.month, start_date.day)
    end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, 999999)

    return (
        session.query(HealthLogDB)
        .options(
            selectinload(HealthLogDB.activities),
            selectinload(HealthLogDB.foods),
        )
        .filter(
            HealthLogDB.user_id == user_id,
            HealthLogDB.timestamp >= start,
            HealthLogDB.timestamp <= end,
        )
        .order_by(HealthLogDB.timestamp.desc())
        .all()
    )


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


def create_tracker_card(session, user_id: str, name: str, value_type: str, target_days_per_week: int, target_value: float | None = None, description: str | None = None):
    card = TrackerCardDB(
        user_id=user_id,
        name=name.strip(),
        value_type=value_type,
        target_days_per_week=target_days_per_week,
        target_value=target_value,
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


def update_tracker_card(session, user_id: str, tracker_id: str, name: str, target_days_per_week: int, target_value: float | None = None, description: str | None = None):
    card = get_tracker_card(session, user_id, tracker_id)
    if card is None:
        return None
    card.name = name.strip()
    card.target_days_per_week = target_days_per_week
    card.target_value = target_value
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
LOCAL_DATABASE_URL = f"sqlite:///{LOCAL_DB_PATH}"
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_ONLINE") or LOCAL_DATABASE_URL
if DATABASE_URL in {"sqlite:///./local.db", "sqlite:///local.db"}:
    DATABASE_URL = LOCAL_DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(engine)


def _add_column_if_missing(table_name: str, column_name: str, definition: str):
    columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
    if column_name not in columns:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


_add_column_if_missing("users", "target_weight_kg", "REAL")
_add_column_if_missing("health_logs", "insulin_curve", "TEXT")
_add_column_if_missing("users", "goals", "TEXT")
_add_column_if_missing("tracker_cards", "target_value", "REAL")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
