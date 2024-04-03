FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install -q -r requirements.txt

COPY app.py .
COPY static ./static/

CMD ["python", "app.py"]
