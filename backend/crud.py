from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
import uuid


Base = declarative_base()


# -----------------------------
# DATABASE MODELS (Supabase-ready)
# -----------------------------

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


def get_daily_logs(session, user_id: str, date: datetime):
    """
    Fetch all logs for a user on a given date.
    """
    start = datetime(date.year, date.month, date.day)
    end = datetime(date.year, date.month, date.day, 23, 59, 59)

    return session.query(HealthLogDB).filter(
        HealthLogDB.user_id == user_id,
        HealthLogDB.timestamp >= start,
        HealthLogDB.timestamp <= end
    ).all()

engine = create_engine("sqlite:///./local.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(engine)
