"""
LLM provider abstraction (multi-LLM support).

Mirrors the synopsis class diagram: an LLMProvider base with OpenAIProvider
and OllamaProvider concrete implementations, selected at request time so the
user can switch between cloud (OpenAI) and local (Ollama) models.
"""

from abc import ABC, abstractmethod

from langchain_core.language_models import BaseChatModel

from app.config import settings


class LLMProvider(ABC):
    name: str
    model_name: str

    @abstractmethod
    def chat_model(self) -> BaseChatModel:
        """Return a LangChain chat model instance."""

    def generate(self, prompt: str) -> str:
        return self.chat_model().invoke(prompt).content


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.OLLAMA_MODEL

    def chat_model(self) -> BaseChatModel:
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=self.model_name,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0.2,
            # Keep the model resident in memory so we don't pay the multi-second
            # load cost on every query (important on low-VRAM hardware).
            keep_alive="30m",
            # Bound the response length so a looping model can't run forever.
            num_predict=settings.LLM_MAX_TOKENS,
            # Hard timeout on the underlying HTTP call. Without this, a model
            # that's too big for VRAM (and crawling on CPU) makes the request
            # hang indefinitely. On timeout the client raises, which we turn
            # into a friendly "model too slow" message in the RAG engine.
            client_kwargs={"timeout": settings.LLM_TIMEOUT},
        )


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.OPENAI_CHAT_MODEL

    def chat_model(self) -> BaseChatModel:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OpenAI provider selected but OPENAI_API_KEY is not set.")
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=self.model_name,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.2,
            timeout=settings.LLM_TIMEOUT,
            max_tokens=settings.LLM_MAX_TOKENS,
            max_retries=1,
        )


def get_provider(provider: str | None = None, model: str | None = None) -> LLMProvider:
    """Factory: resolve a provider name to a concrete LLMProvider."""
    provider = (provider or settings.DEFAULT_LLM_PROVIDER).lower()
    if provider == "openai":
        return OpenAIProvider(model)
    if provider == "ollama":
        return OllamaProvider(model)
    raise ValueError(f"Unknown LLM provider: {provider!r}")
