from hybrid_parser import parse_input

import pandas as pd

input_tests = pd.read_csv('backend/calorie_test_cases.txt',header=None)
# print(input_tests.head())
clean_goals = 0
raw_goals = 0
clean_score = 0
raw_score = 0
for index, row in input_tests.iterrows():
    clean_op = parse_input(row[0],True)
    raw_op = parse_input(row[0])

    if clean_op["segments"]["source"] == "local":
        clean_goals += 1
        clean_score += clean_op["segments"]["score"]
    
    if raw_op["segments"]["source"] == "local":
        raw_goals += 1
        raw_score += raw_op["segments"]["score"]
    
print("Raw goals : ",raw_goals, "\tTotal score : ",raw_score, "\tRaw avg : ",round(raw_score/raw_goals,2))
print("--------------------------")
print("Clean goals : ",clean_goals, "\tTotal score : ",clean_score, "\tClean avg : ",round(clean_score/clean_goals,2))
# ans1= parse_input("played  for 1 hour",True)
# ans2 = parse_input("played cricket for 1 hour")
# print(ans1["segments"])
# print(ans2["segments"])