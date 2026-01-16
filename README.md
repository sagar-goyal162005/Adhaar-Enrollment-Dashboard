# 🇮🇳 AADHAAR ENROLLMENT DASHBOARD

## ⚠️ License & Usage
This project is proprietary and developed for the UIDAI Hackathon.
Unauthorized copying, modification, or distribution is strictly prohibited.

## Overview
Interactive dashboard for Aadhaar enrollment data analysis.

See project details (features, tech stack, API overview) in [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

## 📁 Repo Structure
```
Uidai/
├── backend/                       # FastAPI backend (pandas cleaning + API)
├── uidai-dashboard/               # React + Vite frontend
├── run.ps1                        # Starts backend + frontend (Windows)
└── data/
  └── api_data_aadhar_enrolment.csv    # Main enrollment data
```

## 🚀 How To Run (Windows)

#### 1) Create a Python venv (first time only)
```powershell
cd D:\Uidai
python -m venv .venv
```

#### 2) Install backend dependencies
```powershell
cd D:\Uidai
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

#### 3) Install frontend dependencies
```powershell
cd D:\Uidai\uidai-dashboard
npm install
```

#### 4) Run everything
```powershell
cd D:\Uidai
.\run.ps1
```

#### 5) Open the app
- Frontend: `http://127.0.0.1:5173` (or next available port)
- Backend: `http://127.0.0.1:8000`

## 🎛️ Notes
- The backend reads `data/api_data_aadhar_enrolment.csv` and applies cleaning at startup.
- Exports (state/district totals) come from backend endpoints to stay accurate under filters.
