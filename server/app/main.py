import os
import sys
import asyncio
import logging
import colorlog
from contextlib import asynccontextmanager
import torch

# Add app directory to Python path for local development
if not os.getenv("DOCKER_ENV"):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = "/app"

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.extensions import UPLOAD_FOLDER, initialize_clients


# Configure colored logging globally
def setup_logging():
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove any existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create a colored formatter that only colors the level
    handler = colorlog.StreamHandler()
    formatter = colorlog.ColoredFormatter(
        "%(log_color)s%(levelname)s:%(reset)s     %(message)s",
        log_colors={
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "red,bg_white",
        },
        reset=True,
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    return root_logger


# Set up global logging
logger = setup_logging()


# Define lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # In Docker environment with GPU, preload the Whisper model
    if os.getenv("DOCKER_ENV"):
        # Initialize clients
        from app.extensions import initialize_clients

        initialize_clients()

        # Set CUDA memory fraction if specified
        if os.getenv("CUDA_MEMORY_FRACTION") and torch.cuda.is_available():
            memory_fraction = float(os.getenv("CUDA_MEMORY_FRACTION", "0.8"))
            torch.cuda.set_per_process_memory_fraction(memory_fraction)
            logger.info(f"Set CUDA memory fraction to {memory_fraction}")

        from app.config import model_manager

        logger.info("Preloading Whisper model in main process...")
        model_manager.initialize_whisper_model()
        logger.info("Whisper model preloaded successfully")

    yield
    # Cleanup code (if any) goes here


# Create FastAPI app with lifespan
def init_app():
    # Create FastAPI app with lifespan
    app = FastAPI(title="Scribe API", lifespan=lifespan)

    # Create a simple task queue
    global task_queue, processing_task
    task_queue = asyncio.Queue()
    processing_task = None

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Import latest version routers
    from app.routes.parse_route import router as parse_router
    from app.routes.chat_route import router as chat_router
    from app.routes.upload_route import router as upload_router
    from app.routes.download_route import router as download_router

    # Include latest version routers directly on app
    app.include_router(parse_router, prefix="/parse")
    app.include_router(chat_router, prefix="/chat")
    app.include_router(upload_router, prefix="/upload")
    app.include_router(download_router, prefix="/download")

    # Add routes
    @app.get("/", response_class=HTMLResponse)
    async def index():
        return "<h1>This is the Scribe API.</h1>"

    @app.get("/health")
    async def health():
        """Check if the server is healthy."""
        try:
            return {"status": "healthy"}
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail={"error": str(error), "name": type(error).__name__},
            )

    @app.get("/files/{filepath:path}")
    async def serve_file(filepath: str):
        """
        Serve files from the uploads directory.
        Supports nested folder structures through the filepath parameter.
        Access like: /files/folder1/folder2/image.jpg
        """
        file_path = os.path.join(UPLOAD_FOLDER, filepath)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(file_path)

    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        return JSONResponse(status_code=500, content={"error": str(exc)})

    # Add task to queue
    async def add_task(task_func, *args, **kwargs):
        await task_queue.put((task_func, args, kwargs))

        global processing_task
        if processing_task is None or processing_task.done():
            processing_task = asyncio.create_task(process_task_queue())

    # Add to app state
    app.state.add_task = add_task

    return app


# Task processor
async def process_task_queue():
    while True:
        task_func, args, kwargs = await task_queue.get()
        try:
            await task_func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error processing task: {str(e)}")
        finally:
            task_queue.task_done()


# Global variables
task_queue = None
processing_task = None

# Create the FastAPI app
app = init_app()

# Modify the if __name__ == "__main__" block for development mode
if __name__ == "__main__":
    import uvicorn
    from app.extensions import initialize_clients

    # Only initialize clients in the main process
    if not os.environ.get("UVICORN_STARTED"):
        os.environ["UVICORN_STARTED"] = "true"
        logger.info("Server starting up in development mode...")
        initialize_clients()

        from app.config import model_manager

        logger.info("Preloading Whisper model in development mode...")
        model_manager.initialize_whisper_model()
        logger.info("Whisper model preloaded successfully")

    port = 8000  # Always use 8000 for direct development
    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=port, reload=True, log_level="info"
    )
