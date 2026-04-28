# Apex Quant Terminal

A monorepo with a Next.js frontend and FastAPI backend for a live WebSocket confidence-score dashboard.

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check:

```txt
http://localhost:8000/health
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open:

```txt
http://localhost:3000/dashboard
```

## Railway Deployment

Create one Railway project with two services from the same GitHub repo.

### Backend Service

Root directory:

```txt
/backend
```

Variables:

```env
FRONTEND_ORIGIN=https://your-frontend-service.up.railway.app
MARKET_DATA_API_KEY=replace_me_later
```

### Frontend Service

Root directory:

```txt
/frontend
```

Variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend-service.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend-service.up.railway.app
```

Deploy backend first, copy its public URL, then set frontend variables and deploy frontend.

## Notes

- The backend currently uses a mock market-data stream.
- Replace `get_mock_market_data()` in `backend/main.py` with a real data provider when ready.
- The frontend has WebSocket auto-reconnect built into `useLiveTradingData`.
- This app is a trading analysis tool only and does not provide financial advice.
