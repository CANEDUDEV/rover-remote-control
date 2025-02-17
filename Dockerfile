FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y iproute2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -q -r requirements.txt

COPY app.py .
COPY static ./static/

CMD ["python", "app.py", "--cert-file=/certs/cert.crt", "--key-file=/certs/key.key"]
