import yfinance as yf

data = yf.download("AAPL", period="3mo", interval="1d").reset_index()

# Flatten columns if MultiIndex
if hasattr(data.columns, "levels"):
    data.columns = [' '.join(col).strip() for col in data.columns.values]

print(data.columns)  # Debug

for _, row in data.iterrows():
    date_val = row["Date"]  # Should be Timestamp
    print(type(date_val), date_val)
    print(date_val.strftime("%Y-%m-%d"))  # Now should work

    close_value = row["Close AAPL"]  # flattened column name
    volume_value = row["Volume AAPL"]

    print(f"{date_val}: Close={close_value}, Volume={volume_value}")
    break  # first row only
