from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import json
from nltk.stem import WordNetLemmatizer
import pandas as pd



lemmatizer = WordNetLemmatizer()
# Load local embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Canonical activities
df = pd.read_csv("backend/activity_with_met_2.csv")
MET_LOOKUP = dict(zip(df["activity_name"], df["MET"]))

ACTIVITIES = df["activity_name"].to_list()
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

SPEED_MAP = {
    "walking": 5,
    "race walking": 7,
    "jogging": 8,
    "jogging 2.6-3.7 mph": 5.5,
    "running": 10,
    "running 4.3-4.8 mph": 7.5,
    "running uphill": 8,
    "running downhill": 12,
    "running/jogging": 9,
    "shuttle running": 10,
    "hiking": 4.5,
    "walking treadmill": 5,
    "e-bike": 20,
    "rowing": 6,
    "canoeing": 6,
    "swimming": 2,
    "swimming breaststroke": 2.5,
    "swimming laps": 3,
    "water walking": 3,
    "water jogging": 4,
    "water running": 4
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
    parts = re.split(
    r'\b(?:and|then|after that|after|later|also|plus|n)\b|[,&.]',
    text.lower()
)
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
    # print("Detect activity text : ",text)
    input_embedding = model.encode([text])
    similarities = cosine_similarity(input_embedding, activity_embeddings)[0]

    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]

    activity = ACTIVITIES[best_idx]
    confidence = round(float(best_score) * 100, 2)

    met_value = MET_LOOKUP[activity]

    # print("Print 1: ",activity,"\t",best_score,"\t",met_value)

    return activity, best_score, met_value


# 🧠 Main pipeline function (segment + decision engine)
def parse_input(text: str,raw_input = False):
    segments = split_segments(text)
    print("Segments : ",segments)
    results = {
        "local": [],
        "llm": []
    }
        

    for seg in segments:

        # clearing fields before use
        # activity = None
        # score = 0
        # duration = None
        # distance = None
        # met_value = None
        
        clean_seg = lemmatize_text(seg)
        # print("Clean seg")
        activity, score, met_value = detect_activity(clean_seg if raw_input==True else seg)
        # print("\nRaw Sentence")
        # r_activity, r_score, r_met_value = detect_activity(seg)
        duration = extract_duration(seg)
        distance = extract_distance(seg)

        if(distance != None and activity in SPEED_MAP):
            duration = round((distance / SPEED_MAP[activity])*60,2)
        # duration = distance / 5
        # reps = extract_reps(seg)




        # Decision Engine
        if activity and (duration or distance) and score > 0.50:
            results["local"].append({
                "segment": seg,
                "activity": activity,
                "score":float(score),
                "duration_min": duration,
                # "distance_km": distance,
                # "reps": reps,
                "met_value": float(met_value),
                "source": "local"
            })

        else:
            results["llm"].append(llm_fallback(seg))

        # print("-"*50)
        # print("For Sentence : ",clean_seg,"\n",results)




    return results


# # 🧪 Example
# if __name__ == "__main__":
#     running = True
#     while(running):
#         # user_input = input("Log Activity : ")
#         # if user_input.lower() == "stop":
#         #     exit()
#         user_input = "i walk 1km then i ran for 10km after that i had breakfast of poha"
#         result = parse_input(user_input)

#         print("\n" + "+---"*20 + "+")

#         print(json.dumps(result,indent=2))
#         running = False




'''
played soccer for 1 hour
played soccer for hour
played football for 1 hour

i walk 1km then i ran for 10km after that i had breakfast of poha
'''