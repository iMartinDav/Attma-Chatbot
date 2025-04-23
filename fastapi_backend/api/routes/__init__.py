"""
API routes for the FastAPI backend.
"""

from fastapi import APIRouter

from .base import router as base_router
from .example import router as example_router
from .background_tasks import router as background_tasks_router

# Create main router
router = APIRouter()

# Include all routers
router.include_router(base_router)
router.include_router(example_router)
router.include_router(background_tasks_router)