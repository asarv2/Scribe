import asyncio
import time
from typing import Literal

type LiteralModel = Literal["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "deepseek-r1-7b"]

class ModelRateLimiter:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRateLimiter, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not ModelRateLimiter._initialized:
            # Simple semaphore per model
            self._locks = {
                "gemini-2.0-flash": asyncio.Semaphore(2),      # Allow 2 concurrent requests
                "gemini-2.0-flash-lite": asyncio.Semaphore(2), # Allow 2 concurrent requests
                "gemini-1.5-pro": asyncio.Semaphore(1),        # More restricted
                "gemini-1.5-flash": asyncio.Semaphore(2),      # Allow 2 concurrent requests
                "gemini-1.5-flash-8b": asyncio.Semaphore(2),   # Allow 2 concurrent requests
                "deepseek-r1-7b": asyncio.Semaphore(1)         # GPU model - restrict to 1
            }
            
            # RPM limits based on Google's documentation
            self._rpm_limits = {
                "gemini-2.0-flash": 15,
                "gemini-2.0-flash-lite": 30,
                "gemini-1.5-pro": 2,
                "gemini-1.5-flash": 15,
                "gemini-1.5-flash-8b": 15,
                "deepseek-r1-7b": 30  # Local model can handle more
            }
            
            # Last request timestamp per model using an asyncio lock
            self._last_request = {}
            self._last_request_lock = asyncio.Lock()
            
            ModelRateLimiter._initialized = True

    async def acquire(self, model: LiteralModel):
        """Acquire permission to make an API call"""
        if model not in self._locks:
            raise ValueError(f"Unknown model: {model}")

        # Calculate minimum time between requests
        rpm = self._rpm_limits[model]
        min_interval = 60.0 / rpm

        # Check and update last request time in an async-safe manner
        async with self._last_request_lock:
            current_time = time.time()
            last_time = self._last_request.get(model, 0)
            wait_time = max(0, min_interval - (current_time - last_time))
            
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            
            self._last_request[model] = time.time()  # update after sleep

        # Acquire the semaphore for the model
        await self._locks[model].acquire()
        return True

    def release(self, model: LiteralModel):
        """Release the semaphore for a model"""
        if model in self._locks:
            self._locks[model].release()

# Global instance
rate_limiter = ModelRateLimiter()