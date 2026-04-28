import asyncio
import os
import random
from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional, Dict, Any, Literal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Apex Quant Terminal API")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TradeMode = Literal["LONG", "SHORT", "NEUTRAL"]


@dataclass
class MarketData:
    symbol: str
    current_price: float
    ema_5m: float
    ema_15m: float
    ema_daily: float
    vwap: float
    atr: float
    mean_price: float
    current_volume: int
    avg_volume_20: int
    daily_volume: int
    bid_ask_spread_pct: float
    news_sentiment_score: float
    earnings_date: Optional[date]
    previous_candle_low: float
    previous_candle_high: float
    candle_open: float
    candle_high: float
    candle_low: float
    candle_close: float
    exchange_fee_per_share: float = 0.005
    current_time: Optional[datetime] = None


def detect_trade_mode(data: MarketData) -> TradeMode:
    if data.current_price > data.ema_5m > data.ema_15m > data.ema_daily:
        return "LONG"
    if data.current_price < data.ema_5m < data.ema_15m < data.ema_daily:
        return "SHORT"
    return "NEUTRAL"


def calculate_apex_score(data: MarketData) -> Dict[str, Any]:
    score = 0
    mode = detect_trade_mode(data)
    rvol = data.current_volume / data.avg_volume_20 if data.avg_volume_20 > 0 else 0

    gates = {
        "contextualTrend": False,
        "volatilityEntry": False,
        "volumePriceConfirmation": False,
    }

    risk_flags = {
        "spreadTooWide": False,
        "newsBlackout": False,
        "stopMovedToBreakeven": False,
        "profitToSlippageRatioTooLow": False,
        "lowLiquidity": False,
        "reversalCandleDetected": False,
    }

    if mode == "LONG" and data.current_price > data.vwap:
        score += 25
        gates["contextualTrend"] = True
    elif mode == "SHORT" and data.current_price < data.vwap:
        score += 25
        gates["contextualTrend"] = True

    distance_from_mean = abs(data.current_price - data.mean_price)
    if distance_from_mean <= data.atr:
        score += 25
        gates["volatilityEntry"] = True
    else:
        score -= 10

    green_candle = data.candle_close > data.candle_open
    red_candle = data.candle_close < data.candle_open

    if mode == "LONG" and rvol > 1.5 and green_candle:
        score += 25
        gates["volumePriceConfirmation"] = True
    elif mode == "SHORT" and rvol > 1.5 and red_candle:
        score += 25
        gates["volumePriceConfirmation"] = True

    if data.news_sentiment_score > 0.7:
        score += 25

    if data.bid_ask_spread_pct > 0.15:
        score = 0
        risk_flags["spreadTooWide"] = True

    if data.daily_volume < 500_000:
        score = 0
        risk_flags["lowLiquidity"] = True

    now = data.current_time or datetime.now()
    if data.earnings_date == now.date():
        score = min(score, 60)
        risk_flags["newsBlackout"] = True

    entry = data.current_price
    slippage_rate = 0.0005

    if mode == "LONG":
        entry = entry * (1 + slippage_rate)
        stop_loss = max(entry - (1.5 * data.atr), data.previous_candle_low)
        risk_per_share = entry - stop_loss
        take_profit_2r = entry + (2 * risk_per_share)
        take_profit_3r = entry + (3 * risk_per_share)
        execution_cost = (entry * slippage_rate * 2) + (data.exchange_fee_per_share * 2)
        break_even_point = entry + execution_cost
    elif mode == "SHORT":
        entry = entry * (1 - slippage_rate)
        stop_loss = min(entry + (1.5 * data.atr), data.previous_candle_high)
        risk_per_share = stop_loss - entry
        take_profit_2r = entry - (2 * risk_per_share)
        take_profit_3r = entry - (3 * risk_per_share)
        execution_cost = (entry * slippage_rate * 2) + (data.exchange_fee_per_share * 2)
        break_even_point = entry - execution_cost
    else:
        stop_loss = None
        risk_per_share = 0
        take_profit_2r = None
        take_profit_3r = None
        execution_cost = 0
        break_even_point = None

    if risk_per_share <= 0:
        score = 0
    elif risk_per_share < execution_cost:
        score = 0
        risk_flags["profitToSlippageRatioTooLow"] = True

    score = max(0, min(score, 100))

    return {
        "symbol": data.symbol,
        "score": round(score, 2),
        "gates": gates,
        "riskFlags": risk_flags,
        "updatedAt": now.isoformat(),
        "tradeLevels": {
            "mode": mode,
            "entry": round(entry, 4),
            "stopLoss": round(stop_loss, 4) if stop_loss is not None else None,
            "takeProfit2R": round(take_profit_2r, 4) if take_profit_2r is not None else None,
            "takeProfit3R": round(take_profit_3r, 4) if take_profit_3r is not None else None,
            "riskPerShare": round(risk_per_share, 4),
            "breakEvenPoint": round(break_even_point, 4) if break_even_point is not None else None,
            "estimatedRoundTripExecutionCost": round(execution_cost, 4),
        },
        "debug": {
            "rvol": round(rvol, 2),
            "tradeMode": mode,
        },
    }


def get_mock_market_data(symbol: str, previous_price: Optional[float] = None) -> MarketData:
    base_price = previous_price or random.uniform(80, 240)
    current_price = base_price + random.uniform(-0.45, 0.45)

    candle_open = base_price
    candle_close = current_price
    candle_high = max(candle_open, candle_close) + random.uniform(0.05, 0.35)
    candle_low = min(candle_open, candle_close) - random.uniform(0.05, 0.35)

    bullish = random.choice([True, True, True, False])
    if bullish:
        ema_5m = current_price - random.uniform(0.1, 0.6)
        ema_15m = ema_5m - random.uniform(0.2, 0.7)
        ema_daily = ema_15m - random.uniform(0.5, 2.0)
        vwap = current_price - random.uniform(0.1, 0.7)
    else:
        ema_5m = current_price + random.uniform(0.1, 0.6)
        ema_15m = ema_5m + random.uniform(0.2, 0.7)
        ema_daily = ema_15m + random.uniform(0.5, 2.0)
        vwap = current_price + random.uniform(0.1, 0.7)

    return MarketData(
        symbol=symbol.upper(),
        current_price=current_price,
        ema_5m=ema_5m,
        ema_15m=ema_15m,
        ema_daily=ema_daily,
        vwap=vwap,
        atr=random.uniform(0.8, 3.5),
        mean_price=current_price - random.uniform(-1.0, 1.0),
        current_volume=random.randint(700_000, 3_000_000),
        avg_volume_20=random.randint(500_000, 1_500_000),
        daily_volume=random.randint(1_000_000, 50_000_000),
        bid_ask_spread_pct=random.uniform(0.01, 0.12),
        news_sentiment_score=random.uniform(0.4, 0.95),
        earnings_date=None,
        previous_candle_low=candle_low - random.uniform(0.1, 0.5),
        previous_candle_high=candle_high + random.uniform(0.1, 0.5),
        candle_open=candle_open,
        candle_high=candle_high,
        candle_low=candle_low,
        candle_close=candle_close,
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "apex-quant-backend"}


@app.websocket("/ws/trading/{symbol}")
async def trading_stream(websocket: WebSocket, symbol: str):
    await websocket.accept()
    previous_price = None

    try:
        while True:
            market_data = get_mock_market_data(symbol, previous_price)
            previous_price = market_data.current_price
            result = calculate_apex_score(market_data)
            await websocket.send_json(result)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f"Client disconnected from {symbol} stream.")
    except Exception as error:
        await websocket.send_json({
            "type": "error",
            "message": str(error),
            "updatedAt": datetime.now().isoformat(),
        })
        await websocket.close()
