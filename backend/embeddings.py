from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import json

from nltk.stem import WordNetLemmatizer

lemmatizer = WordNetLemmatizer()
# Load local embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Canonical activities
ACTIVITIES = [
    "walk",
    "running exercise",
    "cycling",
    "swim",
    "gym workout",
    "yoga"
]

# Precompute embeddings
activity_embeddings = model.encode(ACTIVITIES)


# 🧠 Duration word mapping
TIME_WORDS = {
    "half hour": 30,
    "half an hour": 30,
    "quarter hour": 15,
    "one hour": 60,
    "couple of minutes": 2,
    "few minutes": 5
}

def lemmatize_text(text: str):
    words = text.lower().split()

    lemmatized_words = []
    for word in words:
        lemma = lemmatizer.lemmatize(word, pos='v')  # 'v' = verb
        lemmatized_words.append(lemma)

    return " ".join(lemmatized_words)
    # return text


# 🧠 Extract duration
def extract_duration(text: str):
    text = text.lower()

    # 1️⃣ Word-based
    for phrase, minutes in TIME_WORDS.items():
        if phrase in text:
            return minutes

    # 2️⃣ Numeric regex
    match = re.search(r'(\d+(\.\d+)?)\s*(min|mins|minutes|hour|hours|hr|hrs)', text)

    if match:
        value = float(match.group(1))
        unit = match.group(3)

        if "hour" in unit or "hr" in unit:
            return value * 60
        return value

    return None


# 🧠 Extract distance (km)
def extract_distance(text: str):
    text = text.lower()

    # km / kilometers
    match = re.search(r'(\d+(\.\d+)?)\s*(km|kilometers)\b', text)
    if match:
        return float(match.group(1))

    # "5k"
    match_k = re.search(r'(\d+(\.\d+)?)\s*k\b', text)
    if match_k:
        return float(match_k.group(1))

    # miles → km
    match_miles = re.search(r'(\d+(\.\d+)?)\s*(miles|mile|mi)\b', text)
    if match_miles:
        miles = float(match_miles.group(1))
        return round(miles * 1.60934, 2)

    # meters → km
    match_meters = re.search(r'(\d+(\.\d+)?)\s*(m|meters|meter)\b', text)
    if match_meters:
        meters = float(match_meters.group(1))
        return round(meters / 1000, 3)

    return None


# 🧠 Extract reps (counts)
def extract_reps(text: str):
    text = text.lower()

    match = re.search(r'(\d+)\s*(reps|rep)\b', text)
    if match:
        return int(match.group(1))

    match_ex = re.search(r'(\d+)\s*(pushups?|squats?|pullups?|situps?)\b', text)
    if match_ex:
        return int(match_ex.group(1))

    return None


# 🧠 Split into segments (and, comma, period)
def split_segments(text: str):
    parts = re.split(r'\band\b|,|\.', text.lower())
    return [p.strip() for p in parts if p.strip()]


# 🧠 LLM fallback (placeholder)
def llm_fallback(segment: str):
    return {
        "segment": segment,
        "source": "llm",
        "note": "fallback required"
    }


# 🧠 Activity detection using embeddings
def detect_activity(text: str):
    print("Detect activity text : ",text)
    input_embedding = model.encode([text])
    similarities = cosine_similarity(input_embedding, activity_embeddings)[0]

    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]

    activity = ACTIVITIES[best_idx]
    confidence = round(float(best_score) * 100, 2)

    print("Print 1: ",activity,"\t",best_score,"\t",confidence)

    return activity, best_score, confidence


# 🧠 Main pipeline function (segment + decision engine)
def parse_input(text: str):
    segments = split_segments(text)

    results = []

    for seg in segments:
        clean_seg = lemmatize_text(seg)
        print("Clean seg : ",clean_seg)
        activity, score, confidence = detect_activity(clean_seg)
        duration = extract_duration(seg)
        distance = extract_distance(seg)
        reps = extract_reps(seg)

        # Decision Engine
        if activity and (duration or distance or reps) and score > 0.55:
            results.append({
                "segment": seg,
                "activity": activity,
                "duration_min": duration,
                "distance_km": distance,
                "reps": reps,
                "confidence_percent": confidence,
                "source": "local"
            })
        else:
            results.append(llm_fallback(seg))

    return {
        "segments": results
    }


# 🧪 Example
if __name__ == "__main__":
    while(True):

        user_input = input("Log Activity : ")
        if user_input.lower() == "stop":
            exit()
        result = parse_input(user_input)

        print(json.dumps(result, indent=2))