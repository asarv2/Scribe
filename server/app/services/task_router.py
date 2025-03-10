import os
import asyncio
from fastapi import HTTPException

# Global task queue for GPU operations
gpu_task_queue = asyncio.Queue()
processing_task = None

async def process_gpu_task_queue():
    while True:
        task_func, args, kwargs, future = await gpu_task_queue.get()
        try:
            # Ensure GPU_WORKER environment variable is set before processing
            os.environ['GPU_WORKER'] = 'true'
            result = await task_func(*args, **kwargs)
            future.set_result(result)
        except Exception as e:
            future.set_exception(e)
        finally:
            gpu_task_queue.task_done()

async def route_to_gpu_worker(task_func, *args, **kwargs):
    """Route a task to the GPU worker and wait for result"""
    # If this is already the GPU worker, execute directly
    if os.environ.get('GPU_WORKER') == 'true':
        return await task_func(*args, **kwargs)
    
    # Otherwise, queue the task and wait for result
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    
    global processing_task
    if processing_task is None or processing_task.done():
        processing_task = asyncio.create_task(process_gpu_task_queue())
    
    await gpu_task_queue.put((task_func, args, kwargs, future))
    
    # Wait for result with timeout
    try:
        return await asyncio.wait_for(future, timeout=600)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="GPU processing timed out") 