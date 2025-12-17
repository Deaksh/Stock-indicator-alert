FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (WITHOUT pandas-ta)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Clone pandas-ta manually (NO partial clone)
RUN git clone https://github.com/twopirllc/pandas-ta.git /tmp/pandas-ta \
    && pip install /tmp/pandas-ta \
    && rm -rf /tmp/pandas-ta

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
