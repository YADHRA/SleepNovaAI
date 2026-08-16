# Sleep Quality Predictor

An AI-powered, premium-styled web app that predicts sleep quality (**Good / Average / Poor**) from daily lifestyle and physiological habits — sleep duration, stress, screen time, caffeine, exercise, hydration, and more.

Built with **Flask + scikit-learn** on the backend and a dark-luxury glassmorphism UI (**HTML/CSS/JS + Chart.js**) on the frontend.

---

## 1. Folder Structure

```
SleepQualityPredictor/
├── app.py                 # Flask backend (routes + prediction logic)
├── requirements.txt       # Python dependencies
├── train_model.py         # Trains the Random Forest and saves the model
├── generate_dataset.py    # (optional) regenerates sleep_dataset.csv
├── sleep_dataset.csv      # Training data (1,200 rows, 14 features + label)
├── sleep_model.pkl        # Trained model bundle (created by train_model.py)
├── scaler.pkl             # Fitted StandardScaler (created by train_model.py)
├── static/
│   ├── style.css          # Full dark/gold glassmorphism design system
│   ├── script.js          # Form logic, AJAX calls, Chart.js, animations
│   ├── images/            # (empty — add any custom images here)
│   └── icons/              # (empty — Font Awesome is used via CDN)
├── templates/
│   └── index.html         # The landing page / single-page app
├── models/                 # (reserved for future saved-model versions)
├── utils/                  # (reserved for future helper modules)
└── README.md               # This file
```

> `sleep_model.pkl` and `scaler.pkl` are **binary files** — you don't write code for them. They're generated automatically the first time you run `train_model.py`.

---

## 2. Which File to Create First

Follow this order — each step depends on the one before it:

1. **`requirements.txt`** — install dependencies before anything else
2. **`sleep_dataset.csv`** — the training data must exist before training
3. **`train_model.py`** — produces `sleep_model.pkl` + `scaler.pkl`
4. **`app.py`** — loads the two `.pkl` files; won't run without them
5. **`templates/index.html`** — the page Flask renders on `/`
6. **`static/style.css`** — makes the page look premium
7. **`static/script.js`** — makes the form/predictions/charts actually work

---

## 3. What Code Goes Into Each File

| File | Purpose |
|---|---|
| `requirements.txt` | Pins Flask, scikit-learn, pandas, numpy, joblib versions |
| `sleep_dataset.csv` | 1,200 synthetic rows: sleep duration, bedtime/wake hour, caffeine, exercise, screen time, stress, mood, interruptions, water intake, steps, age, gender, BMI → `sleep_quality` label |
| `train_model.py` | Loads the CSV → label-encodes categoricals → scales numerics → trains `RandomForestClassifier` → prints accuracy/report → saves `sleep_model.pkl` + `scaler.pkl` |
| `app.py` | Loads the model bundle at startup → serves `/` → handles `POST /predict` (encodes incoming form data the same way as training, returns prediction + confidence + sleep score + suggestions as JSON) → `/history` → `/about` |
| `templates/index.html` | Navbar, hero, features grid, prediction form (all fields), result card (gauge + probabilities + suggestions), 5 chart canvases, about section, footer |
| `static/style.css` | Dark luxury background, gold accents, glassmorphism cards, animations, full responsive layout |
| `static/script.js` | Navbar scroll effects, scroll-reveal, form validation, `fetch()` call to `/predict`, animated gauge + charts, toast notifications |

All files were generated in full — no placeholders — and each backend piece (`train_model.py`, `app.py`) was actually executed and tested during development to confirm it works.

---

## 4. Terminal Commands (Full Setup)

Open a terminal inside your `SleepQualityPredictor/` folder in VS Code:

```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## 5. How to Train the Model

Make sure `sleep_dataset.csv` and `train_model.py` are both in the project root, then run:

```bash
python train_model.py
```

Expected output includes something like:

```
Loading dataset from 'sleep_dataset.csv' ...
Loaded 1200 rows, 15 columns.
Target classes: ['Average', 'Good', 'Poor']

Training RandomForestClassifier ...

Test Accuracy: 64.58%

Classification Report:
              precision    recall  f1-score   support
     Average       0.48      0.51      0.49        79
        Good       0.71      0.70      0.70        82
        Poor       0.75      0.73      0.74        79
...
Saved trained model bundle to 'sleep_model.pkl'
Saved fitted scaler to 'scaler.pkl'

Done. You can now run: python app.py
```

This creates/overwrites `sleep_model.pkl` and `scaler.pkl` in your project root.

> Want a different dataset size or random seed? Edit and re-run `generate_dataset.py`, then re-run `train_model.py`.

---

## 6. How to Run Flask

Once the model is trained:

```bash
python app.py
```

You should see:

```
Model and scaler loaded successfully.
 * Running on http://127.0.0.1:5000
```

---

## 7. Final URL

Open your browser to:

```
http://127.0.0.1:5000
```

---

## 8. Testing Steps

1. **Home page loads** — you should see the dark luxury hero section with "Sleep Better. Live Better."
2. **Scroll through sections** — Features, Predict, Statistics, About should all fade/slide in as you scroll.
3. **Fill the prediction form** — enter realistic values (e.g. 7.5 hrs sleep, 22:30 bedtime, low stress, low screen time) and click **Predict**.
4. **Check the result card** — a gauge should animate to a score, the label should read Good/Average/Poor in the matching color, probability bars should fill, and 1–4 suggestions should appear.
5. **Check the charts** — scroll to Statistics; the gauge chart should reflect your latest score, and the trend/scatter charts should start populating after 2+ predictions.
6. **Try Reset** — the form should clear and the result card should return to its empty state.
7. **Try invalid input** — clear a required field and submit; you should see a red error toast, not a crash.
8. **Resize the window / open on mobile** — the hamburger menu should appear below ~860px width, and the form should stack to one column below ~640px.
9. **API sanity check** (optional, from a second terminal):
   ```bash
   curl http://127.0.0.1:5000/about
   ```
   Should return JSON with `model_accuracy` and the list of `features_used`.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript, Chart.js
- **Backend:** Python, Flask
- **Machine Learning:** scikit-learn (Random Forest), pandas, NumPy, joblib

## Notes

- Prediction history is stored **in-memory** on the Flask server (resets on restart). For persistence across restarts, swap `prediction_history` in `app.py` for a database or a JSON file.
- The dataset is **synthetic** but domain-informed (weighted composite score → percentile-based Good/Average/Poor labels), so accuracy (~65%) is realistic for a 3-class lifestyle-prediction problem — genuinely useful for demos and portfolios without overstating precision.
- This is a Flask **development server** (`debug=True`). For real deployment, use a production WSGI server (e.g. gunicorn) behind a reverse proxy.