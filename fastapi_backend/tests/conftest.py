from httpx import AsyncClient, ASGITransport
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.password import PasswordHelper
import uuid
import asyncio
import os
from asyncpg.pool import Pool
from dotenv import load_dotenv
import pathlib

# Load test environment variables from .env.test file first
test_env_path = pathlib.Path(__file__).parents[1] / ".env.test"
if test_env_path.exists():
    load_dotenv(test_env_path, override=True)

from app.config import settings
from app.models import User, Base
from app.drizzle import (
    close_db_pool,
    connect_db_pool,
    get_db_pool,
    query,
    execute
)

from app.database import get_user_db, get_async_session
from app.main import app
from app.users import get_jwt_strategy

# Print database connection info for debugging
print(f"TEST_DATABASE_URL: {settings.TEST_DATABASE_URL}")
print(f"DATABASE_URL: {settings.DATABASE_URL}")

# Add the pytest-mock fixture explicitly to ensure it's available
pytest_plugins = ["pytest_mock"]

@pytest_asyncio.fixture(scope="session")
async def drizzle_pool():
    """Create a test database pool for Drizzle ORM."""
    # Use a test-specific connection string if specified
    db_url = settings.TEST_DATABASE_URL or settings.DATABASE_URL
    print(f"Connecting to database: {db_url}")
    
    # Create a connection pool with minimal connections for testing
    await connect_db_pool(db_url, min_size=1, max_size=2)
    
    yield get_db_pool()
    
    # Close all connections after tests
    await close_db_pool()


@pytest_asyncio.fixture(scope="function")
async def drizzle_transaction():
    """Create an isolated transaction for each test using Drizzle."""
    pool = await get_db_pool()
    connection = await pool.acquire()
    transaction = connection.transaction()
    await transaction.start()
    
    try:
        yield connection
    finally:
        await transaction.rollback()
        await pool.release(connection)


@pytest_asyncio.fixture(scope="function")
async def authenticated_drizzle_user(test_client, drizzle_transaction):
    """Create an authenticated user using Drizzle database layer."""
    user_id = uuid.uuid4()
    email = "test_drizzle@example.com"
    password = "TestPassword123#"
    hashed_password = PasswordHelper().hash(password)
    
    # Create user directly with Drizzle
    await drizzle_transaction.execute(
        """
        INSERT INTO "user" (id, email, hashed_password, is_active, is_verified, is_superuser)
        VALUES ($1, $2, $3, true, true, false)
        """,
        user_id, email, hashed_password
    )
    
    # Generate token using the strategy directly
    user = User(
        id=user_id,
        email=email,
        hashed_password=hashed_password,
        is_active=True,
        is_verified=True,
        is_superuser=False
    )
    
    strategy = get_jwt_strategy()
    access_token = await strategy.write_token(user)
    
    # Return both the headers and the user data
    return {
        "headers": {"Authorization": f"Bearer {access_token}"},
        "user_id": user_id,
        "email": email,
        "password": password,
    }


@pytest_asyncio.fixture(scope="function")
async def engine():
    """Create a fresh test database engine for each test function."""
    try:
        # Ensure we're using the asyncpg driver by explicitly setting it in the URL
        test_db_url = settings.TEST_DATABASE_URL
        
        # If the URL doesn't already have the asyncpg driver, add it
        if not test_db_url.startswith("postgresql+asyncpg://"):
            test_db_url = test_db_url.replace("postgresql://", "postgresql+asyncpg://")
        
        # Use echo=False for less verbose output
        engine = create_async_engine(test_db_url, echo=False)

        # Create all tables
        async with engine.begin() as conn:
            # Create SQLAlchemy model tables
            await conn.run_sync(Base.metadata.create_all)
            
            # Create bioflow tables one by one to avoid "cannot insert multiple commands into a prepared statement" error
            # Table for tracking uploaded bioinformatics files
            await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                original_filename TEXT NOT NULL,
                file_size BIGINT NOT NULL,
                file_type TEXT NOT NULL,
                content_type TEXT NOT NULL,
                storage_type TEXT NOT NULL DEFAULT 'local',
                storage_path TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """))

            # Table for tracking analysis jobs
            await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_jobs (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                file_id UUID NOT NULL,
                status TEXT NOT NULL,
                file_name TEXT NOT NULL,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """))

            # Table for storing analysis results
            await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_results (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                analysis_type TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                metadata JSONB,
                result_type TEXT NOT NULL,
                storage_type TEXT NOT NULL,
                result_location TEXT,
                small_result JSONB,
                large_result_blob_id UUID
            )
            """))

        yield engine

        # Drop all tables after tests
        async with engine.begin() as conn:
            # Drop SQLAlchemy model tables
            await conn.run_sync(Base.metadata.drop_all)
            
            # Drop bioflow tables one by one
            await conn.execute(text("DROP TABLE IF EXISTS analysis_jobs"))
            await conn.execute(text("DROP TABLE IF EXISTS analysis_results"))
            await conn.execute(text("DROP TABLE IF EXISTS uploaded_files"))
    finally:
        # Always dispose the engine
        await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(engine):
    """Create a fresh database session for each test."""
    async_session_maker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def test_client(db_session):
    """Fixture to create a test client that uses the test database session."""

    # FastAPI-Users database override (wraps session with user operation helpers)
    async def override_get_user_db():
        yield SQLAlchemyUserDatabase(db_session, User)

    # General database override (raw session access)
    async def override_get_async_session():
        yield db_session

    # Set up test database overrides
    app.dependency_overrides[get_user_db] = override_get_user_db
    app.dependency_overrides[get_async_session] = override_get_async_session

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:8000"
    ) as client:
        yield client


@pytest_asyncio.fixture(scope="function")
async def authenticated_user(test_client, db_session):
    """Fixture to create and authenticate a test user directly in the database."""

    # Create user data
    user_data = {
        "id": uuid.uuid4(),
        "email": "test@example.com",
        "hashed_password": PasswordHelper().hash("TestPassword123#"),
        "is_active": True,
        "is_superuser": False,
        "is_verified": True,
    }

    # Create user directly in database
    user = User(**user_data)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Generate token using the strategy directly
    strategy = get_jwt_strategy()
    access_token = await strategy.write_token(user)

    # Return both the headers and the user data with access_token explicitly included
    return {
        "headers": {"Authorization": f"Bearer {access_token}"},
        "user": user,
        "access_token": access_token,  # Add this line to include the token directly
        "user_data": {"email": user_data["email"], "password": "TestPassword123#"},
    }


# Add a fixture for the mock app
@pytest.fixture
def mock_app(mocker):
    """Return a mocked FastAPI app for testing."""
    from fastapi import FastAPI
    return mocker.Mock(spec=FastAPI)
