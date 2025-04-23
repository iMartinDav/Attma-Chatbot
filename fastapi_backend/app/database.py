from typing import AsyncGenerator, List, Dict, Any, Optional
from urllib.parse import urlparse

from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base

from .config import settings

# Create a Base class for SQLAlchemy models
Base = declarative_base()

parsed_db_url = urlparse(settings.DATABASE_URL)

async_db_connection_url = (
    f"postgresql+asyncpg://{parsed_db_url.username}:{parsed_db_url.password}@"
    f"{parsed_db_url.hostname}{':' + str(parsed_db_url.port) if parsed_db_url.port else ''}"
    f"{parsed_db_url.path}"
)

# Disable connection pooling for serverless environments like Vercel
engine = create_async_engine(async_db_connection_url, poolclass=NullPool)

async_session_maker = async_sessionmaker(
    engine, expire_on_commit=settings.EXPIRE_ON_COMMIT
)


async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    # Import User here to avoid circular imports
    from .models import User
    yield SQLAlchemyUserDatabase(session, User)


# Direct database query functions for use in bioflow module
async def query_db(query: str, *args) -> List[Dict[str, Any]]:
    """
    Execute a raw SQL query and return the results as a list of dictionaries.
    
    Args:
        query: SQL query string with placeholders ($1, $2, etc.)
        *args: Values to substitute into the query
        
    Returns:
        List of dictionaries representing query results
    """
    async with async_session_maker() as session:
        try:
            # Fix parameter passing - convert args to a dictionary for SQLAlchemy
            params = {}
            if args:
                if len(args) == 1 and isinstance(args[0], (dict, tuple)):
                    # If a single dict or tuple is passed, use it directly
                    params = args[0]
                else:
                    # Otherwise create a parameter dict with positional names
                    params = {f"p{i}": arg for i, arg in enumerate(args)}
                    # Replace $1, $2 style params with :p0, :p1 style
                    for i in range(len(args)):
                        query = query.replace(f"${i+1}", f":p{i}")
            
            result = await session.execute(text(query), params)
            column_names = result.keys()
            rows = result.fetchall()
            
            # Convert rows to list of dictionaries
            return [
                {column: value for column, value in zip(column_names, row)}
                for row in rows
            ]
        except Exception as e:
            # Log the error here if needed
            print(f"Database query error: {str(e)}")
            raise


async def execute_db(query: str, *args) -> Optional[int]:
    """
    Execute a raw SQL statement (INSERT, UPDATE, DELETE) and return affected rows.
    
    Args:
        query: SQL query string with placeholders ($1, $2, etc.)
        *args: Values to substitute into the query
        
    Returns:
        Number of rows affected, or None if not applicable
    """
    async with async_session_maker() as session:
        try:
            # Fix parameter passing - convert args to a dictionary for SQLAlchemy
            params = {}
            if args:
                if len(args) == 1 and isinstance(args[0], (dict, tuple)):
                    # If a single dict or tuple is passed, use it directly
                    params = args[0]
                else:
                    # Otherwise create a parameter dict with positional names
                    params = {f"p{i}": arg for i, arg in enumerate(args)}
                    # Replace $1, $2 style params with :p0, :p1 style
                    for i in range(len(args)):
                        query = query.replace(f"${i+1}", f":p{i}")
            
            result = await session.execute(text(query), params)
            await session.commit()
            return result.rowcount
        except Exception as e:
            await session.rollback()
            # Log the error here if needed
            print(f"Database execution error: {str(e)}")
            raise
