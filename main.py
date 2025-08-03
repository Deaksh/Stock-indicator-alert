import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np

def fetch_stock_data(ticker, period, interval='1d'):
    data = yf.download(ticker, period=period, interval=interval)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = ['_'.join([str(i) for i in col if i]) for col in data.columns.values]
    return data

def calculate_sma(data, close_col, window):
    sma_col = f'SMA_{window}'
    data[sma_col] = data[close_col].rolling(window=window).mean()
    return sma_col

def calculate_ema(data, close_col, window):
    ema_col = f'EMA_{window}'
    data[ema_col] = data[close_col].ewm(span=window, adjust=False).mean()
    return ema_col

def calculate_macd(data, close_col, fast=12, slow=26, signal=9):
    exp1 = data[close_col].ewm(span=fast, adjust=False).mean()
    exp2 = data[close_col].ewm(span=slow, adjust=False).mean()
    macd_line = exp1 - exp2
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    macd_hist = macd_line - signal_line

    data['MACD_Line'] = macd_line
    data['MACD_Signal'] = signal_line
    data['MACD_Hist'] = macd_hist
    return ['MACD_Line', 'MACD_Signal', 'MACD_Hist']

def calculate_bollinger_bands(data, close_col, window=20, num_std=2):
    rolling_mean = data[close_col].rolling(window=window).mean()
    rolling_std = data[close_col].rolling(window=window).std()
    upper_band = rolling_mean + (rolling_std * num_std)
    lower_band = rolling_mean - (rolling_std * num_std)

    data[f'BB_Middle_{window}'] = rolling_mean
    data[f'BB_Upper_{window}'] = upper_band
    data[f'BB_Lower_{window}'] = lower_band
    return [f'BB_Middle_{window}', f'BB_Upper_{window}', f'BB_Lower_{window}']

def calculate_rsi(data, close_col, window=14):
    delta = data[close_col].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    avg_gain = gain.rolling(window=window).mean()
    avg_loss = loss.rolling(window=window).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    rsi_col = f'RSI_{window}'
    data[rsi_col] = rsi
    return rsi_col

def check_alert(data, close_col, indicator_col, window, ticker, indicator_name):
    latest = data.iloc[-1]
    prev = data.iloc[-2]
    if prev[close_col] < prev[indicator_col] and latest[close_col] > latest[indicator_col]:
        return f"ALERT: {latest.name} - {ticker} price crossed above the {window}-period {indicator_name}!"
    elif prev[close_col] > prev[indicator_col] and latest[close_col] < latest[indicator_col]:
        return f"ALERT: {latest.name} - {ticker} price crossed below the {window}-period {indicator_name}!"
    else:
        return None  # No alert triggered

def check_sma_cross(data, close_col, sma_col, period, ticker):
    latest = data.iloc[-1]
    prev = data.iloc[-2]
    crossed_above = prev[close_col] < prev[sma_col] and latest[close_col] > latest[sma_col]
    crossed_below = prev[close_col] > prev[sma_col] and latest[close_col] < latest[sma_col]

    if crossed_above:
        return f"ALERT: {ticker} price just crossed ABOVE the {period}-day SMA (bullish)."
    elif crossed_below:
        return f"ALERT: {ticker} price just crossed BELOW the {period}-day SMA (bearish)."
    else:
        return None

def check_price_vs_sma(data, close_col, sma_col, period, ticker):
    latest = data.iloc[-1]
    if latest[close_col] > latest[sma_col]:
        return f"INFO: {ticker} price is ABOVE the {period}-day SMA."
    elif latest[close_col] < latest[sma_col]:
        return f"INFO: {ticker} price is BELOW the {period}-day SMA."
    else:
        return f"INFO: {ticker} price is EQUAL to the {period}-day SMA."

def main():
    st.title("Stock Indicator Alert Tool with Multiple Indicators")

    ticker = st.text_input("Enter the stock ticker symbol (e.g., AAPL, MSFT):").upper().strip()

    selected_indicators = st.multiselect(
        "Select the technical indicators to display:",
        ["SMA", "EMA", "MACD", "Bollinger Bands", "RSI", "Volume"],
        default=["SMA"]
    )

    sma_ema_window = rsi_window = bb_window = None

    if "SMA" in selected_indicators or "EMA" in selected_indicators:
        sma_ema_window = st.number_input("Enter the SMA/EMA period window:", min_value=1, max_value=200, value=20)

    if "RSI" in selected_indicators:
        rsi_window = st.number_input("Enter the RSI period window:", min_value=1, max_value=100, value=14)

    if "Bollinger Bands" in selected_indicators:
        bb_window = st.number_input("Enter the Bollinger Bands period window:", min_value=1, max_value=100, value=20)

    timeframe_options = {
        "1 Month (1mo)": "1mo",
        "3 Months (3mo)": "3mo",
        "6 Months (6mo)": "6mo",
        "1 Year (1y)": "1y",
        "2 Years (2y)": "2y",
        "5 Years (5y)": "5y"
    }
    timeframe_display = st.selectbox("Select Timeframe", list(timeframe_options.keys()))
    period = timeframe_options[timeframe_display]

    sma_50_200_period = '2y'
    dma_check_type = None
    if ticker:
        dma_check_type = st.radio("Check 50/200 Day SMA for:", ('Crossing Event', 'Above/Below Status'))

    if st.button("Check Alert"):
        if not ticker:
            st.error("Please enter a stock ticker symbol.")
            return

        try:
            data = fetch_stock_data(ticker, period=period, interval='1d')
            close_col = f'Close_{ticker}'
            volume_col = f'Volume_{ticker}'

            if close_col not in data.columns:
                st.error(f"Close price for {ticker} not found in data! Try a different ticker or timeframe.")
                return

            output_cols = [close_col]
            alerts = []

            # Calculate indicators based on user selection
            if "SMA" in selected_indicators and sma_ema_window:
                sma_col = calculate_sma(data, close_col, sma_ema_window)
                output_cols.append(sma_col)
                alert = check_alert(data, close_col, sma_col, sma_ema_window, ticker, "SMA")
                if alert:
                    alerts.append(alert)
            if "EMA" in selected_indicators and sma_ema_window:
                ema_col = calculate_ema(data, close_col, sma_ema_window)
                output_cols.append(ema_col)
                alert = check_alert(data, close_col, ema_col, sma_ema_window, ticker, "EMA")
                if alert:
                    alerts.append(alert)
            if "MACD" in selected_indicators:
                macd_cols = calculate_macd(data, close_col)
                output_cols.extend(macd_cols)
                latest = data.iloc[-1]
                prev = data.iloc[-2]
                if prev['MACD_Line'] < prev['MACD_Signal'] and latest['MACD_Line'] > latest['MACD_Signal']:
                    alerts.append(f"ALERT: {ticker} MACD line crossed ABOVE Signal line (bullish).")
                elif prev['MACD_Line'] > prev['MACD_Signal'] and latest['MACD_Line'] < latest['MACD_Signal']:
                    alerts.append(f"ALERT: {ticker} MACD line crossed BELOW Signal line (bearish).")
            if "Bollinger Bands" in selected_indicators and bb_window:
                bb_cols = calculate_bollinger_bands(data, close_col, bb_window)
                output_cols.extend(bb_cols)
                alerts.append("Bollinger Bands calculated. No automatic alerts implemented.")
            if "RSI" in selected_indicators and rsi_window:
                rsi_col = calculate_rsi(data, close_col, rsi_window)
                output_cols.append(rsi_col)
                latest_rsi = data[rsi_col].iloc[-1]
                msg = f"Latest RSI: {latest_rsi:.2f}."
                if latest_rsi > 70:
                    msg += " RSI indicates overbought condition."
                elif latest_rsi < 30:
                    msg += " RSI indicates oversold condition."
                alerts.append(msg)
            if "Volume" in selected_indicators:
                if volume_col not in data.columns:
                    st.error(f"Volume data for {ticker} not available.")
                    return
                output_cols.append(volume_col)
                alerts.append("Showing volume data.")

            st.subheader(f"Recent {ticker} Data with Selected Indicators")
            # Changed: Plot all lines together, allow Streamlit to handle NaNs so each indicator appears when data is available
            st.line_chart(data[output_cols])

            for alert in alerts:
                st.success(alert)

            # 50/200-day SMA section
            data_long = fetch_stock_data(ticker, period=sma_50_200_period, interval='1d')
            if close_col not in data_long.columns:
                st.error(f"Close price for {ticker} not found in extended data.")
                return

            data_long['SMA_50'] = data_long[close_col].rolling(window=50).mean()
            data_long['SMA_200'] = data_long[close_col].rolling(window=200).mean()

            st.subheader(f"{ticker} 50-day & 200-day SMA")
            st.line_chart(data_long[[close_col, 'SMA_50', 'SMA_200']])

            if dma_check_type == 'Crossing Event':
                alert_50 = check_sma_cross(data_long, close_col, 'SMA_50', 50, ticker)
                alert_200 = check_sma_cross(data_long, close_col, 'SMA_200', 200, ticker)
            else:
                alert_50 = check_price_vs_sma(data_long, close_col, 'SMA_50', 50, ticker)
                alert_200 = check_price_vs_sma(data_long, close_col, 'SMA_200', 200, ticker)

            if alert_50:
                st.info(alert_50)
            if alert_200:
                st.info(alert_200)

        except Exception as e:
            st.error(f"Error: {e}")

if __name__ == "__main__":
    main()
