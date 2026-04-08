import os
from pathlib import Path

from pydantic_settings import BaseSettings


# Find the root .env file from apps/api/
ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    
    # Firebase Configuration
    firebase_credentials: str = ""  # JSON string of Firebase service account
    
    # Legacy JWT settings retained for compatibility with existing env files
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    class Config:
        env_file = str(ENV_FILE)
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields like GEMINI_API_KEY


settings = Settings()
