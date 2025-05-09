import uuid
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

# Simple User model that mimics the structure needed for FastAPI dependency injection
@dataclass
class User:
    """
    Lightweight User model that represents a user from the NextJS/Drizzle "User" table.
    This is a compatible replacement for the SQLAlchemy model to work with existing routes.
    """
    id: uuid.UUID
    email: str
    is_active: bool = True
    
    @property
    def is_verified(self) -> bool:
        """For compatibility with FastAPI Users"""
        return True
    
    @property
    def is_superuser(self) -> bool:
        """For compatibility with FastAPI Users"""
        return False

    @classmethod
    def from_db_record(cls, record: Dict[str, Any]) -> "User":
        """Create a User instance from a database record"""
        if not record:
            return None
        return cls(
            id=uuid.UUID(record["id"]) if isinstance(record["id"], str) else record["id"],
            email=record["email"],
            is_active=True  # NextJS schema doesn't have is_active field
        )
