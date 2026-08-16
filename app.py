"""
app.py
-------
Flask backend for the Sleep Quality Predictor.

Routes:
    GET  /          -> renders the landing page (index.html)
    POST /predict    -> accepts form data (AJAX/JSON), returns prediction JSON
    GET  /history    -> returns past predictions made this server session
    GET  /about      -> simple JSON info endpoint about the project/model

Run:
    python app.py

Then open:
    http://127.0.0.1:5000
"""

from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__)

MODEL_PATH = "sleep_model.pkl"
SCALER_PATH = "scaler.pkl"

# ------------------------------------------------------------------
# Load model bundle + scaler once at startup
# ------------------------------------------------------------------
model_bundle = None
scaler = None
MODEL_LOAD_ERROR = None

try:
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        model_bundle = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print("Model and scaler loaded successfully.")
    else:
        MODEL_LOAD_ERROR = (
            "Model files not found. Run 'python train_model.py' first "
            "to generate sleep_model.pkl and scaler.pkl."
        )
        print(MODEL_LOAD_ERROR)
except Exception as e:
    MODEL_LOAD_ERROR = f"Failed to load model: {e}"
    print(MODEL_LOAD_ERROR)

# In-memory history store (resets when the server restarts).
# Good enough for a demo/portfolio project; swap for a DB in production.
prediction_history = []


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def time_to_hour(time_str):
    """Convert 'HH:MM' (24hr, from an <input type="time">) to a float hour."""
    try:
        h, m = time_str.split(":")
        return round(int(h) + int(m) / 60, 2)
    except Exception:
        return 0.0


def build_feature_row(payload, bundle):
    """
    Turns the raw JSON payload from the frontend into a single-row DataFrame
    matching the exact feature order + encoding used during training.
    """
    numeric_features = bundle["numeric_features"]
    categorical_features = bundle["categorical_features"]
    feature_order = bundle["feature_order"]
    encoders = bundle["feature_encoders"]

    bedtime_hour = time_to_hour(payload.get("bedtime", "23:00"))
    wake_hour = time_to_hour(payload.get("wake_time", "07:00"))

    raw_row = {
        "sleep_duration": float(payload.get("sleep_duration", 7)),
        "bedtime_hour": bedtime_hour,
        "wake_hour": wake_hour,
        "exercise_duration": float(payload.get("exercise_duration", 0)),
        "screen_time": float(payload.get("screen_time", 0)),
        "stress_level": float(payload.get("stress_level", 5)),
        "water_intake": float(payload.get("water_intake", 2)),
        "daily_steps": float(payload.get("daily_steps", 5000)),
        "age": float(payload.get("age", 25)),
        "bmi": float(payload.get("bmi", 22)),
        "caffeine_intake": str(payload.get("caffeine_intake", "None")),
        "mood": str(payload.get("mood", "Neutral")),
        "sleep_interruptions": str(payload.get("sleep_interruptions", "No")),
        "gender": str(payload.get("gender", "Male")),
    }

    # Encode categoricals using the SAME encoders fitted during training,
    # producing plain numbers before the DataFrame is built (avoids dtype
    # conflicts from reassigning ints into a string-typed column).
    encoded_row = dict(raw_row)
    for col in categorical_features:
        le = encoders[col]
        val = raw_row[col]
        if val not in le.classes_:
            val = le.classes_[0]
        encoded_row[col] = int(le.transform([val])[0])

    df = pd.DataFrame([encoded_row])

    # Ensure correct dtype and column order
    df = df[feature_order].astype(float)

    # Scale numeric columns only, in place, using the trained scaler
    df[numeric_features] = scaler.transform(df[numeric_features])

    return df, raw_row


def generate_suggestions(prediction, raw_row):
    """Rule-based, human-readable tips based on the predicted class and inputs."""
    tips = []

    if raw_row["screen_time"] > 60:
        tips.append("Try reducing screen time by at least 30 minutes before bed.")
    if raw_row["stress_level"] >= 7:
        tips.append("High stress detected — consider a short breathing or meditation routine before sleep.")
    if raw_row["exercise_duration"] < 20:
        tips.append("Increase your daily exercise duration for better sleep quality.")
    if raw_row["sleep_duration"] < 6.5:
        tips.append("Aim for 7–8 hours of sleep for optimal recovery.")
    if raw_row["caffeine_intake"] in ("Moderate", "High"):
        tips.append("Cut back on caffeine, especially in the afternoon and evening.")
    if raw_row["sleep_interruptions"] == "Yes":
        tips.append("Frequent interruptions detected — keep your bedroom dark, quiet, and cool.")
    if raw_row["water_intake"] < 1.5:
        tips.append("Increase water intake during the day; dehydration can disrupt sleep.")
    if raw_row["daily_steps"] < 4000:
        tips.append("Try to reach at least 6,000–8,000 steps a day for better sleep pressure.")

    if prediction == "Good" and not tips:
        tips.append("Great habits! Keep maintaining your current sleep routine.")
    elif not tips:
        tips.append("Keep a consistent bedtime and wake time to improve sleep quality further.")

    return tips[:4]  # keep it concise for the UI


def compute_sleep_score(prediction, confidence, raw_row):
    """
    Derive a 0-100 'Sleep Score' for the circular progress bar.
    Blends the model's class + confidence with a couple of raw signals
    so the score feels responsive to input changes, not just the 3 buckets.
    """
    base = {"Good": 80, "Average": 55, "Poor": 30}.get(prediction, 50)
    score = base + (confidence - 0.5) * 30
    score += (raw_row["sleep_duration"] - 7) * 2
    score -= raw_row["stress_level"] * 0.8
    score -= max(0, raw_row["screen_time"] - 60) * 0.05
    score = max(0, min(100, round(score)))
    return int(score)


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    if model_bundle is None or scaler is None:
        return jsonify({
            "success": False,
            "error": MODEL_LOAD_ERROR or "Model not loaded."
        }), 500

    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({"success": False, "error": "No input data received."}), 400

        X, raw_row = build_feature_row(payload, model_bundle)

        model = model_bundle["model"]
        target_encoder = model_bundle["target_encoder"]

        pred_encoded = model.predict(X)[0]
        probabilities = model.predict_proba(X)[0]
        prediction = target_encoder.inverse_transform([pred_encoded])[0]
        confidence = float(np.max(probabilities))

        class_probs = {
            cls: round(float(prob) * 100, 1)
            for cls, prob in zip(target_encoder.classes_, probabilities)
        }

        sleep_score = compute_sleep_score(prediction, confidence, raw_row)
        suggestions = generate_suggestions(prediction, raw_row)

        result = {
            "success": True,
            "prediction": prediction,
            "confidence": round(confidence * 100, 1),
            "sleep_score": sleep_score,
            "class_probabilities": class_probs,
            "suggestions": suggestions,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        # Save to in-memory history (most recent first, cap at 50 entries)
        prediction_history.insert(0, result)
        if len(prediction_history) > 50:
            prediction_history.pop()

        return jsonify(result)

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/history")
def history():
    return jsonify({"success": True, "history": prediction_history})


@app.route("/about")
def about():
    info = {
        "project": "Sleep Quality Predictor",
        "description": (
            "A machine learning based web app that predicts sleep quality "
            "(Good / Average / Poor) from lifestyle and physiological factors "
            "using a Random Forest classifier."
        ),
        "model": "RandomForestClassifier (scikit-learn)",
        "model_accuracy": (
            round(model_bundle["accuracy"] * 100, 2) if model_bundle else None
        ),
        "features_used": model_bundle["feature_order"] if model_bundle else [],
    }
    return jsonify(info)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)