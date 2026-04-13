from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


# Find the root .env file from dev-tools/
ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    
    # Firebase Configuration
    firebase_credentials: str = ""  # JSON string of Firebase service account
    firebase_storage_bucket: str = Field(
        default="",
        validation_alias="EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    )
    
    # Legacy JWT settings retained for compatibility with existing env files
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    schedule_timezone: str = "America/Port_of_Spain"
    reminder_worker_enabled: bool = True
    reminder_worker_poll_seconds: int = 60

    class Config:
        env_file = str(ENV_FILE)
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields like GEMINI_API_KEY


settings = Settings()
