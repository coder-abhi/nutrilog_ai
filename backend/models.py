from typing import Literal

from pydantic import BaseModel, Field


class Activity(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    quantity: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=50)
    calories_burned: int = Field(ge=0)


class Food(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    quantity: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=50)
    calories: int = Field(ge=0)
    protein: int = Field(ge=0)
    carbs: int = Field(ge=0)
    fat: int = Field(ge=0)
    fibre: int = Field(ge=0)
    sugar: int = Field(ge=0)
    saturated_fat: int = Field(ge=0)
    sodium: int = Field(ge=0)

class InsulinPoint(BaseModel):
    minute: int = Field(ge=0, le=1440)
    value: int = Field(ge=0, le=100)

class ExtractionResponse(BaseModel):
    activities: list[Activity]
    foods: list[Food]
    insulin_curve: list[InsulinPoint] = Field(default_factory=list)

class ActivityInput(BaseModel):
    sentence: str = Field(min_length=1, max_length=2000)
    date: str | None = Field(default=None, max_length=10)
    log_time_minutes: int | None = Field(default=None, ge=0, le=1439)


class TrackerCardInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    value_type: Literal["boolean", "numeric"]
    target_days_per_week: int = Field(ge=1, le=7)
    description: str | None = Field(default=None, max_length=500)


class TrackerCardUpdateInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_days_per_week: int = Field(ge=1, le=7)
    description: str | None = Field(default=None, max_length=500)


class TrackerVisibilityInput(BaseModel):
    is_visible: bool


class TrackerEntryInput(BaseModel):
    tracker_id: str
    value: float = Field(ge=0, le=1_000_000_000)
    date: str | None = Field(default=None, max_length=10)


class SignInInput(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class SignUpInput(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=256)
    weight_kg: float = Field(gt=0, le=1000)
    target_weight_kg: float | None = Field(default=None, gt=0, le=1000)
    height_cm: float = Field(ge=30, le=300)
    gender: Literal["male", "female", "other"]
    activity_level: Literal["sedentary", "low", "moderate", "high", "very_high"]
    goal: str | None = Field(default=None, max_length=100)


class ProfileUpdateInput(BaseModel):
    weight_kg: float = Field(gt=0, le=1000)
    target_weight_kg: float | None = Field(default=None, gt=0, le=1000)
    height_cm: float = Field(ge=30, le=300)
    gender: Literal["male", "female", "other"]
    activity_level: Literal["sedentary", "low", "moderate", "high", "very_high"]
    goal: str | None = Field(default=None, max_length=100)


class WeightEntryInput(BaseModel):
    value_kg: float = Field(gt=0, le=1000)
    recorded_at: str | None = Field(default=None, max_length=32)
