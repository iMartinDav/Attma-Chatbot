"""
API routes for the FastAPI backend.
"""

from fastapi import APIRouter

# Import existing route modules
from .background_tasks import router as background_tasks_router
from .bioflow_visualization import router as bioflow_visualization_router
from .single_cell_routes import router as single_cell_routes_router

# Create main router
router = APIRouter()

# Include all routers
router.include_router(background_tasks_router)
router.include_router(bioflow_visualization_router)
router.include_router(single_cell_routes_router)