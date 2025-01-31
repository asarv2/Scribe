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
            self._last_call = {
                "gemini-1.5-flash-8b": 0,
                "gemini-1.5-flash": 0,
                "gemini-2.0-flash-exp": 0,
                "gemini-1.5-pro": 0
            }
            
            # Add thread-safe dictionary
            self._last_call_lock = threading.Lock()
            
            # Request queue for debugging/monitoring
            self._request_queue = deque()
            self._queue_lock = threading.Lock()
            
            self.MAX_QUEUE_SIZE = 100
            self.QUEUE_TIMEOUT = 300  # seconds
            
            self._cleanup_interval = 3600  # 1 hour
            self._last_cleanup = time.time()
            
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
        request_id = id(asyncio.current_task())
        current_time = time.time()
        
        # Check queue size
        with self._queue_lock:
            if len(self._request_queue) >= self.MAX_QUEUE_SIZE:
                raise Exception("Request queue full")
            # Add request to queue with timestamp
            self._request_queue.append((request_id, current_time))
            queue_position = len(self._request_queue)
        
        print(f"Request {request_id} queued. Position: {queue_position}")

        try:
            async with self._get_semaphore():
                current_time = time.time()
                    
                with self._last_call_lock:
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
                    
                # Only remove from queue after successful processing
                with self._queue_lock:
                    # Convert deque to list temporarily for removal
                    queue_list = list(self._request_queue)
                    # Find the request
                    for i, (rid, _) in enumerate(queue_list):
                        if rid == request_id:
                            # Remove from deque
                            self._request_queue.remove((rid, queue_list[i][1]))
                            break
                    remaining = len(self._request_queue)
                print(f"Request {request_id} for {model} starting. Remaining queue: {remaining}")
                    
                # Clean up old requests periodically
                await self.cleanup_old_requests()
                    
        except Exception as e:
            # Remove request from queue if there's any other error
            with self._queue_lock:
                # Convert deque to list temporarily for removal
                queue_list = list(self._request_queue)
                for i, (rid, _) in enumerate(queue_list):
                    if rid == request_id:
                        self._request_queue.remove((rid, queue_list[i][1]))
                        break
            raise e

    def get_queue_length(self) -> int:
        """Get current queue length"""
        with self._queue_lock:
            return len(self._request_queue)

    def get_queue_status(self) -> list:
        """Get status of all queued requests"""
        with self._queue_lock:
            return list(self._request_queue)

    async def cleanup_old_requests(self):
        """Clean up old requests from the queue"""
        current_time = time.time()
        if current_time - self._last_cleanup > self._cleanup_interval:
            with self._queue_lock:
                # Convert to list to find old requests
                queue_list = list(self._request_queue)
                for rid, timestamp in queue_list:
                    if current_time - timestamp > self.QUEUE_TIMEOUT:
                        self._request_queue.remove((rid, timestamp))
            self._last_cleanup = current_time

# Global instance
rate_limiter = ModelRateLimiter()
