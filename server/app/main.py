import os
import sys

# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.extensions import UPLOAD_FOLDER

# Create FastAPI app
app = FastAPI(title="Scribe API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers after app creation
from app.routes.parse import router as parse_router
from app.routes.evaluate import router as evaluate_router
from app.routes.generate import router as generate_router

# Include routers
app.include_router(parse_router, prefix="/parse")
app.include_router(evaluate_router, prefix="/evaluate")
app.include_router(generate_router, prefix="/generate")

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
            detail={
                "error": str(error),
                "name": type(error).__name__
            }
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
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    print("Server starting up...")
    print("Supabase connection established...")
    
    port = 5000 if os.getenv('DOCKER_ENV') else 8000
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
