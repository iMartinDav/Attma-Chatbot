"""
Tests for the Drizzle database connection layer.
"""
import asyncio
import pytest
import uuid
from unittest.mock import patch, AsyncMock
from asyncpg.pool import Pool

from app.models import User
from app.drizzle import (
    get_db_pool, 
    get_db_connection, 
    get_db_transaction,
    query, 
    execute,
    get_user_by_email, 
    sync_user_with_drizzle, 
    close_db_pool
)


@pytest.fixture
def mock_pool():
    """Mock AsyncPG connection pool."""
    with patch('app.drizzle._pool', new=AsyncMock(spec=Pool)) as mock:
        yield mock


@pytest.fixture
def mock_connection():
    """Mock AsyncPG connection."""
    connection = AsyncMock()
    connection.fetch.return_value = [{"id": "123", "email": "test@example.com"}]
    connection.execute.return_value = "INSERT 0 1"
    
    # Set up transaction context
    transaction = AsyncMock()
    connection.transaction.return_value.__aenter__.return_value = transaction
    connection.transaction.return_value.__aexit__.return_value = None
    
    return connection


@pytest.fixture
def mock_acquire(mock_pool, mock_connection):
    """Mock pool.acquire() context manager."""
    # Set up the pool's acquire context manager
    mock_pool.acquire.return_value.__aenter__.return_value = mock_connection
    mock_pool.acquire.return_value.__aexit__.return_value = None
    return mock_pool


@pytest.mark.asyncio
async def test_get_db_pool():
    """Test creating and retrieving the database connection pool."""
    with patch('asyncpg.create_pool', new=AsyncMock()) as mock_create_pool:
        mock_create_pool.return_value = AsyncMock(spec=Pool)
        
        # Call get_db_pool twice to test pool reuse
        pool1 = await get_db_pool()
        pool2 = await get_db_pool()
        
        # Verify create_pool was called only once
        mock_create_pool.assert_called_once()
        
        # Verify both calls returned the same pool
        assert pool1 is pool2


@pytest.mark.asyncio
async def test_get_db_connection(mock_acquire):
    """Test getting a database connection from the pool."""
    async with get_db_connection() as conn:
        # Verify we got the mock connection
        assert conn is mock_acquire.acquire().__aenter__.return_value


@pytest.mark.asyncio
async def test_get_db_transaction(mock_acquire, mock_connection):
    """Test getting a database transaction."""
    async with get_db_transaction() as (transaction, conn):
        # Verify we got the mock transaction and connection
        assert conn is mock_connection
        assert transaction is mock_connection.transaction().__aenter__.return_value


@pytest.mark.asyncio
async def test_query(mock_acquire, mock_connection):
    """Test executing a SQL query."""
    mock_connection.fetch.return_value = [
        {"id": "1", "name": "Test"}, 
        {"id": "2", "name": "Test2"}
    ]
    
    result = await query("SELECT * FROM test")
    
    # Verify fetch was called with the right query
    mock_connection.fetch.assert_called_once_with("SELECT * FROM test")
    
    # Verify the result is a list of dictionaries
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[1]["name"] == "Test2"


@pytest.mark.asyncio
async def test_execute(mock_acquire, mock_connection):
    """Test executing a SQL command."""
    result = await execute("INSERT INTO test VALUES ($1)", "value")
    
    # Verify execute was called with the right command and parameters
    mock_connection.execute.assert_called_once_with("INSERT INTO test VALUES ($1)", "value")
    
    # Verify the result is the status message
    assert result == "INSERT 0 1"


@pytest.mark.asyncio
async def test_get_user_by_email(mock_acquire, mock_connection):
    """Test getting a user by email."""
    mock_connection.fetch.return_value = [{"id": "123", "email": "test@example.com"}]
    
    result = await get_user_by_email("test@example.com")
    
    # Verify fetch was called with the right query and parameters
    mock_connection.fetch.assert_called_once()
    
    # Verify the result is the user data
    assert result["id"] == "123"
    assert result["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_get_user_by_email_not_found(mock_acquire, mock_connection):
    """Test getting a non-existent user by email."""
    mock_connection.fetch.return_value = []
    
    result = await get_user_by_email("nonexistent@example.com")
    
    # Verify fetch was called with the right query and parameters
    mock_connection.fetch.assert_called_once()
    
    # Verify the result is None
    assert result is None


@pytest.mark.asyncio
async def test_sync_user_with_drizzle_existing(mock_acquire, mock_connection):
    """Test syncing an existing user with Drizzle."""
    # Mock get_user_by_email to return a user
    mock_connection.fetch.side_effect = [
        [{"id": "123", "email": "test@example.com"}],  # For get_user_by_email
        [{"id": "123", "email": "test@example.com"}],  # For UPDATE query
    ]
    
    # Create a test user
    user = User(id=uuid.UUID("12345678-1234-5678-1234-567812345678"), email="test@example.com", hashed_password="hash")
    
    # Sync the user
    result = await sync_user_with_drizzle(user)
    
    # Verify fetch was called twice
    assert mock_connection.fetch.call_count == 2
    
    # Verify the result is the user data
    assert result["id"] == "123"
    assert result["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_sync_user_with_drizzle_new(mock_acquire, mock_connection):
    """Test syncing a new user with Drizzle."""
    # Mock get_user_by_email to return no user, then mock INSERT
    mock_connection.fetch.side_effect = [
        [],  # For get_user_by_email
        [{"id": "12345678-1234-5678-1234-567812345678", "email": "new@example.com"}],  # For INSERT query
    ]
    
    # Create a test user
    user = User(id=uuid.UUID("12345678-1234-5678-1234-567812345678"), email="new@example.com", hashed_password="hash")
    
    # Sync the user
    result = await sync_user_with_drizzle(user)
    
    # Verify fetch was called twice
    assert mock_connection.fetch.call_count == 2
    
    # Verify the result is the user data
    assert result["id"] == "12345678-1234-5678-1234-567812345678"
    assert result["email"] == "new@example.com"


@pytest.mark.asyncio
async def test_close_db_pool():
    """Test closing the database connection pool."""
    # Create a mock pool
    mock_pool = AsyncMock(spec=Pool)
    
    # Set the global pool to the mock
    with patch('app.drizzle._pool', mock_pool):
        # Close the pool
        await close_db_pool()
        
        # Verify close was called
        mock_pool.close.assert_called_once()