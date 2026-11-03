FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, models, and data
COPY backend /app/backend

ENV PYTHONPATH="/app:/app/backend"
ENV PORT=8000
ENV GROQ_MODEL="openai/gpt-oss-20b"

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
