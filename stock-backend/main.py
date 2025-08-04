from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import math
from typing import Optional, List, Dict
from pydantic import BaseModel
import requests
import os
from typing import List
import json

import os
from dotenv import load_dotenv
load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise EnvironmentError("GROQ_API_KEY is not set in environment variables")


class ChatRequest(BaseModel):
    question: str
    symbol: Optional[str] = None
    indicator_values: Optional[Dict] = None
    time_period: Optional[Dict] = None  # Should have keys 'label', 'interval', etc.
    selected_indicators: Optional[List[str]] = None

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # For development only
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sample symbol master list combining US + Indian NSE stocks
# Expand or replace this with a JSON file or external API integration
SYMBOLS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "AMD", "name": "Advanced Micro Devices, Inc."},
    {"symbol": "TSLA", "name": "Tesla, Inc."},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries Limited"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services Limited"},
    {"symbol": "INFY.NS", "name": "Infosys Limited"},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
]

FMP_API_KEY = "nGqOK2IEwHrg5f8OtMeEkMFxlu3Qkt6r"  # sign up for free key

@app.get("/symbols")
def symbol_search(q: str = Query(..., min_length=1)):
    # Optional: Filter to NSE exchange by appending &exchange=NSE
    response = requests.get(
        f"https://financialmodelingprep.com/api/v3/search?query={q}&limit=20&apikey={FMP_API_KEY}"
    )
    results = response.json()
    # format: [{"symbol": "RELIANCE.NS", "name": "Reliance Industries Limited", ...}, ...]
    # For India-only: add &exchange=NSE
    return [{"symbol": r["symbol"], "name": r["name"]} for r in results]

@app.post("/chat")
def chat(req: ChatRequest):
    """Context-aware AI chatbot endpoint using Groq's Llama."""
    system_message = (
        "You are an expert AI financial analyst. "
        "Always use the user's context (symbol, period, interval, indicators, and chart values) if provided. "
        "Be accurate, give short technical explanations, and never make up prices/data."
    )
    user_message = req.question.strip()
    if req.symbol:
        user_message += f"\n\nStock symbol: {req.symbol}"
    if req.time_period:
        label = req.time_period.get('label', 'unknown')
        interval = req.time_period.get('interval', 'unknown')
        user_message += f"\nTime period selected: {label}, Interval: {interval}"
    if req.selected_indicators:
        user_message += f"\nSelected indicators: {', '.join(req.selected_indicators)}"
    if req.indicator_values:
        ind_lines = [f"{k}: {v}" for k, v in req.indicator_values.items() if v is not None]
        if ind_lines:
            user_message += "\nLatest indicator values:\n" + "\n".join(ind_lines)

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7,
        "max_tokens": 700,
    }

    resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
    try:
        resp_json = resp.json()
        if resp.status_code != 200:
            err = resp_json.get("error", resp_json)
            return {"response": f"[Groq error {resp.status_code}]: {err}"}
        if "choices" not in resp_json:
            return {"response": f"[Groq error]: Unexpected API response: {resp_json}"}
        content = resp_json["choices"][0]["message"]["content"]
    except Exception as exc:
        # Show the error for debugging (remove in prod)
        return {"response": f"Exception: {str(exc)} | Raw: {getattr(resp, 'text', '')[:200]}"}
    return {"response": content}

@app.get("/history")
def get_history(
    symbol: str,
    period: str = "3mo",
    interval: str = "1d",
    indicators: Optional[str] = Query(None, description="Comma separated list of indicators")
):
    data = yf.download(symbol, period=period, interval=interval, auto_adjust=True)

    if data.empty:
        return {"error": "No data found for symbol."}

    if hasattr(data.columns, "levels"):
        data.columns = [' '.join(col).strip() for col in data.columns.values]
    data = data.reset_index()

    close_col = f"Close {symbol}" if f"Close {symbol}" in data.columns else "Close"
    open_col = f"Open {symbol}" if f"Open {symbol}" in data.columns else "Open"
    high_col = f"High {symbol}" if f"High {symbol}" in data.columns else "High"
    low_col = f"Low {symbol}" if f"Low {symbol}" in data.columns else "Low"
    volume_col = f"Volume {symbol}" if f"Volume {symbol}" in data.columns else "Volume"

    requested = [s.strip().lower() for s in indicators.split(",")] if indicators else []

    # Compute indicators
    if "sma20" in requested:
        if close_col not in data.columns:
            return {"error": f"Close column not found: {close_col}"}
        data["SMA_20"] = data[close_col].rolling(window=20).mean()

    if "ema20" in requested:
        if close_col not in data.columns:
            return {"error": f"Close column not found: {close_col}"}
        data["EMA_20"] = data[close_col].ewm(span=20, adjust=False).mean()

    if "rsi" in requested:
        if close_col not in data.columns:
            return {"error": f"Close column not found: {close_col}"}
        data["RSI_14"] = ta.rsi(data[close_col], length=14)

    # --- Pattern recognition: Price gaps (always run!) ---
    data["gap_up"] = False
    data["gap_down"] = False
    data["gap_size"] = 0.0
    for i in range(1, len(data)):
        prev_close = data.loc[i - 1, close_col]
        curr_open = data.loc[i, open_col]
        if curr_open > prev_close * 1.01:
            data.loc[i, "gap_up"] = True
            data.loc[i, "gap_size"] = (curr_open - prev_close)
        elif curr_open < prev_close * 0.99:
            data.loc[i, "gap_down"] = True
            data.loc[i, "gap_size"] = (curr_open - prev_close)

    # --- Pattern recognition: Local swing highs/lows for support/resistance (always run!) ---
    data["swing_high"] = False
    data["swing_low"] = False
    window = 2

    for i in range(window, len(data) - window):
        highs = data[high_col][i - window: i + window + 1]
        lows = data[low_col][i - window: i + window + 1]
        center = i
        if data.loc[center, high_col] == max(highs):
            data.loc[center, "swing_high"] = True
        if data.loc[center, low_col] == min(lows):
            data.loc[center, "swing_low"] = True

    def safe_float(v):
        if v is None: return None
        try:
            if isinstance(v, float):
                if math.isnan(v) or math.isinf(v): return None
                return float(v)
            if pd.isna(v): return None
            return float(v)
        except Exception:
            return None

    result = []
    for _, row in data.iterrows():
        date_val = row["Date"]
        date_str = date_val.strftime("%Y-%m-%d") if hasattr(date_val, "strftime") else str(date_val).strip()
        close_value = safe_float(row.get(close_col))
        volume_value = safe_float(row.get(volume_col))
        if close_value is None or volume_value is None: continue

        entry = {
            "date": date_str,
            "close": close_value,
            "volume": volume_value,
            "gap_up": bool(row.get("gap_up", False)),
            "gap_down": bool(row.get("gap_down", False)),
            "gap_size": safe_float(row.get("gap_size", 0.0)),
            "swing_high": bool(row.get("swing_high", False)),
            "swing_low": bool(row.get("swing_low", False)),
        }
        if "sma20" in requested:
            entry["SMA_20"] = safe_float(row.get("SMA_20"))
        if "ema20" in requested:
            entry["EMA_20"] = safe_float(row.get("EMA_20"))
        if "rsi" in requested:
            entry["RSI_14"] = safe_float(row.get("RSI_14"))
        result.append(entry)
    return result

