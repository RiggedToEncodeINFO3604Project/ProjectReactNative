import os
from pathlib import Path

from pydantic_settings import BaseSettings


# Find the root .env file (go up one directory from backend/)
ROOT_DIR = Path(__file__).parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    
    # Firebase Configuration
    firebase_credentials: str = ""  # JSON string of Firebase service account
    
    # JWT Configuration
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    class Config:
        env_file = str(ENV_FILE)
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields like GEMINI_API_KEY


settings = Settings()
