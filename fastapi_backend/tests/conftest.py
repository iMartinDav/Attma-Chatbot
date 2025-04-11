from httpx import AsyncClient, ASGITransport
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.password import PasswordHelper
import uuid
import asyncio
import os
from asyncpg.pool import Pool

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


@pytest_asyncio.fixture(scope="session")
async def drizzle_pool():
    """Create a test database pool for Drizzle ORM."""
    # Use a test-specific connection string if specified
    db_url = settings.TEST_DATABASE_URL or settings.DATABASE_URL
    
    # Create a connection pool with minimal connections for testing
    await connect_db_pool(db_url, min_size=1, max_size=2)
    
    yield get_db_pool()
    
    # Close all connections after tests
    await close_db_pool()


@pytest_asyncio.fixture(scope="function")
async def drizzle_transaction():
    """Create an isolated transaction for each test using Drizzle."""
    pool = get_db_pool()
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
    await execute(
        """
        INSERT INTO "user" (id, email, hashed_password, is_active, is_verified, is_superuser)
        VALUES ($1, $2, $3, true, true, false)
        """,
        user_id, email, hashed_password,
        connection=drizzle_transaction
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
    engine = create_async_engine(settings.TEST_DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

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
        await session.close()


@pytest_asyncio.fixture(scope="function")
async def test_client(db_session):
    """Fixture to create a test client that uses the test database session."""

    # FastAPI-Users database override (wraps session with user operation helpers)
    async def override_get_user_db():
        session = SQLAlchemyUserDatabase(db_session, User)
        try:
            yield session
        finally:
            await db_session.close()

    # General database override (raw session access)
    async def override_get_async_session():
        try:
            yield db_session
        finally:
            await db_session.close()

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

    # Return both the headers and the user data
    return {
        "headers": {"Authorization": f"Bearer {access_token}"},
        "user": user,
        "user_data": {"email": user_data["email"], "password": "TestPassword123#"},
    }
