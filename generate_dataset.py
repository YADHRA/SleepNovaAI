"""
Synthetic dataset generator for Sleep Quality Predictor.
Run this ONLY if you want to regenerate sleep_dataset.csv with a fresh random seed.
Produces a domain-informed, weakly-labeled dataset with balanced classes
(Good / Average / Poor) suitable for supervised classification.
"""
import numpy as np
import pandas as pd

np.random.seed(42)
N = 1200

sleep_duration = np.round(np.random.normal(6.5, 1.3, N).clip(3, 10), 2)
bedtime_hour = np.round(np.random.normal(23.5, 1.5, N).clip(20, 26) % 24, 2)
wake_hour = np.round((bedtime_hour + sleep_duration) % 24, 2)

caffeine_levels = ["None", "Low", "Moderate", "High"]
caffeine_intake = np.random.choice(caffeine_levels, N, p=[0.25, 0.30, 0.30, 0.15])
caffeine_score = pd.Series(caffeine_intake).map({"None": 0, "Low": 1, "Moderate": 2, "High": 3}).values

exercise_duration = np.round(np.random.exponential(25, N).clip(0, 120), 1)
screen_time = np.round(np.random.normal(90, 45, N).clip(0, 300), 1)
stress_level = np.random.randint(0, 11, N)

moods = ["Happy", "Neutral", "Sad", "Anxious"]
mood = np.random.choice(moods, N, p=[0.35, 0.35, 0.15, 0.15])
mood_score = pd.Series(mood).map({"Happy": 0, "Neutral": 1, "Sad": 2, "Anxious": 2}).values

sleep_interruptions = np.random.choice(["Yes", "No"], N, p=[0.35, 0.65])
interruption_score = (sleep_interruptions == "Yes").astype(int)

water_intake = np.round(np.random.normal(2.2, 0.7, N).clip(0.5, 5), 2)
daily_steps = np.round(np.random.normal(7000, 3000, N).clip(500, 20000), 0)
age = np.random.randint(18, 65, N)
gender = np.random.choice(["Male", "Female"], N)
bmi = np.round(np.random.normal(23.5, 3.5, N).clip(15, 40), 1)

# Composite domain-informed sleep-health score
score = (
    (sleep_duration - 7) * 8
    - abs(sleep_duration - 7.5) * 3
    - caffeine_score * 4
    - (screen_time / 30)
    - stress_level * 3
    + (exercise_duration / 10)
    - mood_score * 5
    - interruption_score * 12
    - abs(bmi - 22) * 1.2
    + (daily_steps / 3000)
    + np.random.normal(0, 8, N)  # noise so it's not trivially separable
)

# Percentile-based thresholds -> balanced 3-class split
p33, p66 = np.percentile(score, [33, 66])


def classify(s):
    if s >= p66:
        return "Good"
    elif s >= p33:
        return "Average"
    else:
        return "Poor"


sleep_quality = np.array([classify(s) for s in score])

df = pd.DataFrame({
    "sleep_duration": sleep_duration,
    "bedtime_hour": bedtime_hour,
    "wake_hour": wake_hour,
    "caffeine_intake": caffeine_intake,
    "exercise_duration": exercise_duration,
    "screen_time": screen_time,
    "stress_level": stress_level,
    "mood": mood,
    "sleep_interruptions": sleep_interruptions,
    "water_intake": water_intake,
    "daily_steps": daily_steps.astype(int),
    "age": age,
    "gender": gender,
    "bmi": bmi,
    "sleep_quality": sleep_quality
})

df.to_csv("sleep_dataset.csv", index=False)
print(df["sleep_quality"].value_counts())
print(f"Rows: {len(df)}")
