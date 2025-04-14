from fastapi import APIRouter
from .route import router as grader_router

router = APIRouter(prefix="/grader")
router.include_router(grader_router)
