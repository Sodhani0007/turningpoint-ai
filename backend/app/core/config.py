import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "TurningPoint AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "https://turningpoint-ai.vercel.app",
        "*"
    ]

settings = Settings()
