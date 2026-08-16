"""
train_model.py
----------------
Trains a Random Forest classifier on sleep_dataset.csv to predict sleep
quality (Good / Average / Poor) from lifestyle + physiological features.

Run:
    python train_model.py

Produces:
    sleep_model.pkl   -> trained RandomForestClassifier (+ label encoders, feature order)
    scaler.pkl         -> fitted StandardScaler for numeric features
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

DATA_PATH = "sleep_dataset.csv"
MODEL_PATH = "sleep_model.pkl"
SCALER_PATH = "scaler.pkl"

# Columns in the exact order the Flask app will send them for prediction
NUMERIC_FEATURES = [
    "sleep_duration",
    "bedtime_hour",
    "wake_hour",
    "exercise_duration",
    "screen_time",
    "stress_level",
    "water_intake",
    "daily_steps",
    "age",
    "bmi",
]

CATEGORICAL_FEATURES = [
    "caffeine_intake",
    "mood",
    "sleep_interruptions",
    "gender",
]

TARGET = "sleep_quality"

FEATURE_ORDER = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def load_data():
    print(f"Loading dataset from '{DATA_PATH}' ...")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} rows, {df.shape[1]} columns.")
    return df


def encode_categoricals(df, encoders=None, fit=True):
    """One-hot-free label encoding for each categorical column.
    Returns the transformed df and the dict of fitted LabelEncoders."""
    df = df.copy()
    if encoders is None:
        encoders = {}

    for col in CATEGORICAL_FEATURES:
        if fit:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
        else:
            le = encoders[col]
            df[col] = le.transform(df[col].astype(str))

    return df, encoders


def main():
    df = load_data()

    # Encode categorical inputs (caffeine, mood, interruptions, gender)
    df_encoded, feature_encoders = encode_categoricals(df, fit=True)

    # Encode target label
    target_encoder = LabelEncoder()
    y = target_encoder.fit_transform(df_encoded[TARGET].astype(str))
    print(f"Target classes: {list(target_encoder.classes_)}")

    X = df_encoded[FEATURE_ORDER]

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale numeric features only (categorical are already small-integer encoded)
    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()
    X_train_scaled[NUMERIC_FEATURES] = scaler.fit_transform(X_train[NUMERIC_FEATURES])
    X_test_scaled[NUMERIC_FEATURES] = scaler.transform(X_test[NUMERIC_FEATURES])

    # Train Random Forest
    print("\nTraining RandomForestClassifier ...")
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    model.fit(X_train_scaled, y_train)

    # Evaluate
    y_pred = model.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nTest Accuracy: {acc * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred, target_names=target_encoder.classes_))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Feature importance (nice to show in an interview)
    importances = pd.Series(model.feature_importances_, index=FEATURE_ORDER)
    importances = importances.sort_values(ascending=False)
    print("\nTop Feature Importances:")
    print(importances.head(10).to_string())

    # Bundle everything the Flask app needs into one artifact
    bundle = {
        "model": model,
        "feature_encoders": feature_encoders,
        "target_encoder": target_encoder,
        "feature_order": FEATURE_ORDER,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "accuracy": acc,
    }

    joblib.dump(bundle, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    print(f"\nSaved trained model bundle to '{MODEL_PATH}'")
    print(f"Saved fitted scaler to '{SCALER_PATH}'")
    print("\nDone. You can now run: python app.py")


if __name__ == "__main__":
    main()