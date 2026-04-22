from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import json
import pandas as pd
from openai import OpenAI
import os, psutil
from dotenv import load_dotenv
from pathlib import Path

from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
import torch
load_dotenv(override=True)

api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()




def log_mem(stage):
    process = psutil.Process(os.getpid())
    print(f"{stage}: {process.memory_info().rss / 1024**2:.2f} MB")
# nlp = spacy.load("en_core_web_sm")
# Load local embedding model

log_mem("Before sentence transformer")


def get_onnx_embedding(text, model, tokenizer):
    inputs = tokenizer(text, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    
    # Mean Pooling logic
    token_embeddings = outputs.last_hidden_state
    mask = inputs['attention_mask'].unsqueeze(-1).expand(token_embeddings.size()).float()
    sentence_embedding = torch.sum(token_embeddings * mask, 1) / torch.clamp(mask.sum(1), min=1e-9)
    return sentence_embedding.numpy()

# Canonical activities
BASE_DIR = Path(__file__).resolve().parent
csv_file_path = BASE_DIR / "ml_models" / "activity_with_met_2.csv"
activity_embedding_file_path = BASE_DIR / "ml_models" / "activity_embeddings_onnx.npy"
activity_list_file_path = BASE_DIR / "ml_models" / "activities_list.npy"
df = pd.read_csv(csv_file_path)




ACTIVITIES = df["activity_name"].to_list()
MET_LOOKUP = dict(zip(df["activity_name"], df["MET"]))


# Load the saved assets
save_directory = "onnx_model_all_minilm_quantized"
model = ORTModelForFeatureExtraction.from_pretrained(BASE_DIR / save_directory)
tokenizer = AutoTokenizer.from_pretrained(BASE_DIR / save_directory)

# Load the pre-calculated library (The "Matrix")
activity_embeddings = np.load(activity_embedding_file_path)

log_mem("After imports")


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

# def lemmatize_text(text: str):
#     words = text.lower().split()

#     lemmatized_words = []
#     for word in words:
#         lemma = lemmatizer.lemmatize(word, pos='v')  # 'v' = verb
#         lemmatized_words.append(lemma)

#     return " ".join(lemmatized_words)
#     # return text
def lemmatize_text_spa(text: str):
    doc = nlp(text.lower())
    return " ".join([token.lemma_ for token in doc])


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
    """
    Uses the ONNX model and pre-calculated library to find the best activity match.
    """
    # 1. Generate the embedding for the user's input using the ONNX helper
    input_embedding = get_onnx_embedding(text, model, tokenizer)
    
    # 2. Compare the user's vector to the pre-loaded library (the .npy file)
    # This is a matrix-vector multiplication, which is incredibly fast
    similarities = cosine_similarity(input_embedding, activity_embeddings)[0]

    # 3. Find the index of the highest similarity score
    best_idx = np.argmax(similarities)
    
    # 4. Retrieve the corresponding activity and MET value
    activity = ACTIVITIES[best_idx]
    best_score = similarities[best_idx]
    met_value = MET_LOOKUP[activity]
    
    return activity, best_score, met_value


# 🧠 Main pipeline function (segment + decision engine)
def parse_input(text: str,weight_kg,raw_input = False):
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
        
        # clean_seg = lemmatize_text_spa(seg)
        clean_seg = seg
        # print("Clean seg")
        activity, score, met_value = detect_activity(clean_seg if raw_input==True else seg)
        # print("\nRaw Sentence")
        # r_activity, r_score, r_met_value = detect_activity(seg)

        print("Activity Score MET : ",activity,score,met_value,seg)
        duration = extract_duration(seg)
        distance = extract_distance(seg)

        unit = "minutes" if duration else "km"

        if(distance != None and activity in SPEED_MAP):
            duration = round((distance / SPEED_MAP[activity])*60,2)
        # duration = distance / 5
        # reps = extract_reps(seg)
        # print("Duration",duration,"\t MET : ",met_value)

        print("Dist and Duration : ",distance,duration,activity)
        # Decision Engine
        if activity and (duration or distance) and score > 0.50:
            calories_burned = met_value * weight_kg * (duration / 60)
            results["local"].append({
                "segment": seg,
                "activity": activity,
                "score":float(score),
                "quantity": duration if duration else distance,
                "unit": unit,
                # "reps": reps,
                "calories_burned": round(float(calories_burned)),
                "source": "local"
            })

        else:
            results["llm"].append(llm_fallback(seg))

        # print("-"*50)
        # print("For Sentence : ",clean_seg,"\n",results)

    return results


# 🧪 Example
if __name__ == "__main__":
    running = True
    while(running):
        # user_input = input("Log Activity : ")
        # if user_input.lower() == "stop":
        #     exit()
        user_input = "i walk 1km then i ran for 10km after that i had breakfast of poha"
        result = parse_input(user_input,25)

        print("\n" + "+---"*20 + "+")

        print(json.dumps(result,indent=2))

        log_mem("At End of Program")
        running = False




'''
played soccer for 1 hour
played soccer for hour
played football for 1 hour

i walk 1km then i ran for 10km after that i had breakfast of poha
'''