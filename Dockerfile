FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
COPY app.py .
COPY static ./static/

RUN pip install -q -r requirements.txt

CMD ["python", "app.py"]
