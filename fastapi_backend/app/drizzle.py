"""
Drizzle database connection module for Python backend.

This module provides database connection utilities for interacting with the PostgreSQL 
database managed by Drizzle ORM in the frontend. It implements async connection 
pooling and transaction management.
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse

import asyncpg
from asyncpg.pool import Pool

from .config import settings
from .models import User

# Connection pool
_pool: Optional[Pool] = None
_pool_lock = asyncio.Lock()


async def get_db_pool() -> Pool:
    """
    Get or create the database connection pool.
    
    Returns:
        Pool: AsyncPG connection pool
    """
    global _pool
    
    if _pool is None:
        async with _pool_lock:
            if (_pool is None):
                # Parse the database URL to extract components
                parsed = urlparse(settings.DATABASE_URL)
                
                # Extract username, password, host, port, and database name
                user = parsed.username
                password = parsed.password
                host = parsed.hostname
                port = parsed.port or 5432
                database = parsed.path.lstrip('/')
                
                # Create a connection pool
                _pool = await asyncpg.create_pool(
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                    database=database,
                    min_size=5,
                    max_size=20,
                    timeout=30,
                )
    
    return _pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Get a database connection from the pool.
    
    Yields:
        asyncpg.Connection: Database connection
    """
    pool = await get_db_pool()
    async with pool.acquire() as connection:
        yield connection


@asynccontextmanager
async def get_db_transaction() -> AsyncGenerator[Tuple[asyncpg.transaction.Transaction, asyncpg.Connection], None]:
    """
    Start a database transaction.
    
    Yields:
        Tuple[asyncpg.transaction.Transaction, asyncpg.Connection]: Database transaction and connection
    """
    pool = await get_db_pool()
    async with pool.acquire() as connection:
        async with connection.transaction() as transaction:
            yield transaction, connection


async def query(sql: str, *args: Any) -> List[Dict[str, Any]]:
    """
    Execute a SQL query and return the results as a list of dictionaries.
    
    Args:
        sql: SQL query string
        args: Query parameters
        
    Returns:
        List[Dict[str, Any]]: Query results
    """
    async with get_db_connection() as conn:
        results = await conn.fetch(sql, *args)
        return [dict(row) for row in results]


async def execute(sql: str, *args: Any) -> str:
    """
    Execute a SQL command and return the status.
    
    Args:
        sql: SQL command string
        args: Command parameters
        
    Returns:
        str: Command status
    """
    async with get_db_connection() as conn:
        return await conn.execute(sql, *args)


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by email from the Drizzle managed database.
    
    Args:
        email: User email
        
    Returns:
        Optional[Dict[str, Any]]: User data or None if not found
    """
    sql = 'SELECT * FROM "User" WHERE email = $1'
    results = await query(sql, email)
    return results[0] if results else None


async def sync_user_with_drizzle(user: User) -> Dict[str, Any]:
    """
    Sync a user from the SQLAlchemy model to the Drizzle database.
    
    Args:
        user: FastAPI SQLAlchemy user model
        
    Returns:
        Dict[str, Any]: Drizzle user data
    """
    # Check if the user exists in Drizzle database
    drizzle_user = await get_user_by_email(user.email)
    
    if drizzle_user:
        # Update the existing user
        sql = """
        UPDATE "User" 
        SET "email" = $2,
            "password" = $3
        WHERE "id" = $1
        RETURNING *
        """
        results = await query(sql, str(user.id), user.email, user.hashed_password)
        return results[0]
    else:
        # Create a new user
        sql = """
        INSERT INTO "User" ("id", "email", "password")
        VALUES ($1, $2, $3)
        RETURNING *
        """
        results = await query(sql, str(user.id), user.email, user.hashed_password)
        return results[0]


async def close_db_pool() -> None:
    """Close the database pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None