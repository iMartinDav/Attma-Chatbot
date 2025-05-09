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
    
    # Email Service - Using Frontend API
    EMAIL_API_TOKEN: str = "dummy_token"  # Default value added to make it optional
    EMAIL_API_ENDPOINT: str = "/api/email"
    EMAIL_API_MAX_RETRIES: int = 3
    EMAIL_API_RETRY_DELAY_MS: int = 500

    # CORS
    CORS_ORIGINS: Set[str]

    # Blob Storage
    BLOB_READ_WRITE_TOKEN: str = ""
    
    # Email Templates (Legacy - can be removed in future)
    TEMPLATE_DIR: str = "email_templates"
    
    # Legacy Email settings (retained for compatibility)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@attma.bio"
    MAIL_PORT: int = 1025
    MAIL_SERVER: str = "localhost"
    MAIL_FROM_NAME: str = "Attma"
    MAIL_STARTTLS: bool = False
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = False
    VALIDATE_CERTS: bool = False

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
