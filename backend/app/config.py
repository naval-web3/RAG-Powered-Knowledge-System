"""
Application configuration.

Loads settings from environment variables / the .env file using
pydantic-settings. A single cached `settings` instance is shared
across the whole application.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- Application ----
    APP_NAME: str = "RAG Powered Knowledge System"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ---- Security / JWT ----
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    # ---- PostgreSQL ----
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "rag"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "rag_knowledge"

    # ---- Vector store ----
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION: str = "knowledge_base"

    # ---- File storage ----
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 25

    # ---- RAG tuning ----
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    RETRIEVAL_TOP_K: int = 5

    # ---- LLM provider ----
    DEFAULT_LLM_PROVIDER: str = "ollama"

    # ---- Ollama ----
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:8b"

    # ---- OpenAI ----
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ---- Embeddings ----
    EMBEDDING_BACKEND: str = "local"
    LOCAL_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # ---- CORS ----
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
