import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "TurningPoint AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # LLM Provider Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_BASE_URL: str = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
    
    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "https://frontend-mauve-omega-75.vercel.app",
        "https://turningpoint-ai.vercel.app",
    ] + [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    
    CORS_ORIGIN_REGEX: str = r"^https:\/\/.*\.vercel\.app$"

settings = Settings()
