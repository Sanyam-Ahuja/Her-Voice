# HerVoice - Women's Safety Mapping App

HerVoice is a crowd-sourced mapping app for women's safety. Users can rate areas they visit on a scale of 1-5, add tags (like "isolated", "well lit", etc.) and view a heatmap of safe and unsafe spots. It also uses machine learning to fill in gaps on the map for areas that don't have enough reviews yet.

## Features
- Interactive Leaflet map showing safety score heatmaps
- Filter map scores by Day/Night or specific hours
- Submit ratings anonymously (device ID is hashed using SHA-256 before sending to keep it private)
- ML model (XGBoost) predicts safety ratings for unreviewed grid cells based on urban features
- Rate limiting to prevent spam (users can only rate the same grid cell once every 6 days, duplicates are silently discarded)

## Tech Stack
- Frontend: React Native (Expo)
- Backend: FastAPI (Python), SQLAlchemy, PostgreSQL + PostGIS database
- ML: scikit-learn, XGBoost

## Running the App

### 1. Database (Docker)
Start the PostGIS database container:
```bash
docker compose up -d
```

### 2. Backend (Python)
Go to the backend directory:
```bash
cd backend_py
```
Create a virtual environment, install the packages, and run the server:
```bash
python -m venv .venv
source .venv/bin/activate  # on windows: .venv\Scripts\activate
pip install -r requirements.txt
```
To run the server, set your environment variables and start uvicorn:
```bash
# On Linux/macOS
export API_KEY="your_api_key_here"
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload

# On Windows (PowerShell)
$env:API_KEY="your_api_key_here"
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```
To seed the database with test/training data:
```bash
python seed_data.py
```

### 3. Mobile App (Expo)
Go to the mobile directory and install node modules:
```bash
cd mobile
npm install
```
Configure your backend url. Create a `.env` file or set the environment variables in `eas.json` for builds.
Then run:
```bash
npx expo start
```
Use Expo Go app on your phone to scan the QR code and test the app.
