import asyncio
from typing import Callable
from werkzeug.datastructures import FileStorage
import threading
from concurrent.futures import ThreadPoolExecutor
import os

class ProgressFileStorage:
    def __init__(self, file_storage: FileStorage, filename: str, update_callback: Callable[[float], None]):
        self.file_storage = file_storage
        self.filename = filename
        # Get the actual content length from the file storage
        self.total_size = int(file_storage.content_length or file_storage.stream.seek(0, 2))
        # Reset stream position after getting size
        if not file_storage.content_length:
            file_storage.stream.seek(0)
        self.bytes_read = 0
        self.update_callback = update_callback
        self.chunk_size = self.get_optimal_chunk_size(self.total_size)
        self._lock = threading.Lock()

    def save(self, dst):
        # Ensure directory exists
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        
        with ThreadPoolExecutor() as executor:
            with open(dst, 'wb') as f:
                future_chunks = []
                
                while True:
                    chunk = self.file_storage.stream.read(self.chunk_size)
                    if not chunk:
                        break
                    
                    # Submit chunk writing to thread pool
                    future = executor.submit(self._write_chunk, f, chunk)
                    future_chunks.append(future)
                    
                    # Update progress after each chunk
                    with self._lock:
                        self.bytes_read += len(chunk)
                        if self.total_size > 0:  # Prevent division by zero
                            progress = (self.bytes_read / self.total_size) * 100
                            self.update_callback(progress)
                
                # Wait for all chunks to be written
                for future in future_chunks:
                    future.result()

                # Ensure we show 100% at the end
                if self.bytes_read > 0:
                    self.update_callback(100)

    def _write_chunk(self, file_obj, chunk):
        """Thread-safe chunk writing"""
        with self._lock:
            file_obj.write(chunk)
    
    def _update_progress(self):
        if self.total_size > 0:  # Prevent division by zero
            progress = (self.bytes_read / self.total_size) * 100
            self.update_callback(progress)

    @classmethod
    def get_optimal_chunk_size(cls, file_size: int) -> int:
        """Dynamically calculate optimal chunk size based on file size"""
        if file_size > 1024 * 1024 * 1024:  # > 1GB
            return 5 * 1024 * 1024  # 5MB chunks
        elif file_size > 100 * 1024 * 1024:  # > 100MB
            return 2 * 1024 * 1024  # 2MB chunks
        else:
            return 1024 * 1024  # 1MB chunks
