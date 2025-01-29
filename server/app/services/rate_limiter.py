import asyncio
import time
from typing import Dict, Literal
from collections import deque
import threading

class ModelRateLimiter:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRateLimiter, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Only initialize once
        if not ModelRateLimiter._initialized:
            # Store semaphores per event loop
            self._semaphores: Dict[int, asyncio.Semaphore] = {}
            self._semaphore_lock = threading.Lock()
            
            # Store RPM limits
            self._rpm_limits = {
                "gemini-1.5-flash-8b": 10,
                "gemini-1.5-flash": 10,
                "gemini-2.0-flash-exp": 10,
                "gemini-1.5-pro": 2
            }
            
            # Track last call time per model
            self._last_call: Dict[str, float] = {
                "gemini-1.5-flash-8b": 0,
                "gemini-1.5-flash": 0,
                "gemini-2.0-flash-exp": 0,
                "gemini-1.5-pro": 0
            }
            
            # Request queue for debugging/monitoring
            self._request_queue = deque()
            self._queue_lock = threading.Lock()
            
            ModelRateLimiter._initialized = True

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Get or create a semaphore for the current event loop"""
        loop = asyncio.get_running_loop()
        loop_id = id(loop)
        
        with self._semaphore_lock:
            if loop_id not in self._semaphores:
                self._semaphores[loop_id] = asyncio.Semaphore(1)
            return self._semaphores[loop_id]

    def get_rpm(self, model: str) -> int:
        return self._rpm_limits.get(model, 0)

    async def acquire(self, model: str):
        """Acquire permission to make an API call"""
        # Get semaphore for current event loop
        semaphore = self._get_semaphore()
        
        # Add request to queue for monitoring
        request_id = id(asyncio.current_task())
        with self._queue_lock:
            self._request_queue.append((model, request_id))
            queue_length = len(self._request_queue)
        print(f"Request {request_id} for {model} queued. Queue length: {queue_length}")

        # Use event loop specific semaphore for sequential processing
        async with semaphore:
            current_time = time.time()
            last_call_time = self._last_call[model]
            
            # Calculate minimum wait time based on RPM
            rpm = self.get_rpm(model)
            min_interval = 60.0 / rpm  # seconds between requests
            
            # Calculate wait time
            wait_time = last_call_time + min_interval - current_time
            if wait_time > 0:
                print(f"Request {request_id} waiting for {wait_time:.2f} seconds")
                await asyncio.sleep(wait_time)
            
            # Update last call time
            self._last_call[model] = time.time()
            
            # Remove request from queue
            with self._queue_lock:
                self._request_queue.popleft()
                remaining = len(self._request_queue)
            print(f"Request {request_id} for {model} starting. Remaining queue: {remaining}")

    def get_queue_length(self) -> int:
        """Get current queue length"""
        with self._queue_lock:
            return len(self._request_queue)

    def get_queue_status(self) -> list:
        """Get status of all queued requests"""
        with self._queue_lock:
            return list(self._request_queue)

# Global instance
rate_limiter = ModelRateLimiter()
