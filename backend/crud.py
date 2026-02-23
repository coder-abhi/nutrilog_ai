from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, create_engine, engine, text
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
import uuid
import hashlib
import os


Base = declarative_base()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, stored_hash: str) -> bool:
    return _hash_password(password) == stored_hash


DATABASE_URL = os.getenv("DATABASE_URL")

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


class WeightEntryDB(Base):
    __tablename__ = "weight_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    value_kg = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)


class HealthLogDB(Base):
    __tablename__ = "health_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    raw_text = Column(String, nullable=False)

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


def create_user(session, username: str, password: str, weight_kg: float, target_weight_kg: float | None, height_cm: float, gender: str, activity_level: str):
    """Create a new user. Raises if username exists."""
    if get_user_by_username(session, username) is not None:
        raise ValueError("Username already exists")
    user = UserDB(
        username=username,
        password_hash=_hash_password(password),
        weight_kg=weight_kg,
        target_weight_kg=target_weight_kg,
        height_cm=height_cm,
        gender=gender,
        activity_level=activity_level,
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


def create_health_log(session, user_id: str, raw_text: str, activities, foods):
    """
    Persist one full transaction:
    - Creates HealthLog row
    - Inserts related Activity and Food rows
    """

    log = HealthLogDB(
        user_id=user_id,
        raw_text=raw_text
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


# engine = create_engine("sqlite:///./local.db", connect_args={"check_same_thread": False})
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
