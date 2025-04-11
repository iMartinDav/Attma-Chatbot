from typing import Set

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # OpenAPI docs
    OPENAPI_URL: str = "/openapi.json"

    # Database
    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None
    EXPIRE_ON_COMMIT: bool = False

    # User
    ACCESS_SECRET_KEY: str
    RESET_PASSWORD_SECRET_KEY: str
    VERIFICATION_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Email Service
    EMAIL_API_TOKEN: str = "dummy_token"  # Default value added to make it optional
    EMAIL_API_ENDPOINT: str = "/api/email"
    EMAIL_API_MAX_RETRIES: int = 3
    EMAIL_API_RETRY_DELAY_MS: int = 500

    # CORS
    CORS_ORIGINS: Set[str]

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
