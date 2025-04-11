"""
Database test utilities for working with Drizzle in test environments.
"""
import uuid
import asyncio
from typing import Dict, Any, List, Optional, Callable, AsyncGenerator
import asyncpg
from asyncpg.connection import Connection
from fastapi_users.password import PasswordHelper

from app.drizzle import execute, query


async def create_test_user(
    connection: Connection,
    email: str = "test@example.com",
    password: str = "TestPassword123#",
    is_verified: bool = True,
    is_active: bool = True,
    is_superuser: bool = False,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a test user in the Drizzle database.
    
    Args:
        connection: Database connection
        email: User email
        password: User password
        is_verified: Whether the user is verified
        is_active: Whether the user is active
        is_superuser: Whether the user is a superuser
        name: User name
        
    Returns:
        Dict[str, Any]: Created user data
    """
    user_id = str(uuid.uuid4())
    hashed_password = PasswordHelper().hash(password)
    
    sql = """
    INSERT INTO "User" (
        "id", "email", "password", "name", "emailVerified",
        "createdAt", "updatedAt"
    )
    VALUES (
        $1, $2, $3, $4, 
        CASE WHEN $5 THEN NOW() ELSE NULL END,
        NOW(), NOW()
    )
    RETURNING *
    """
    
    results = await connection.fetch(
        sql,
        user_id,
        email,
        hashed_password,
        name,
        is_verified
    )
    
    if results:
        return dict(results[0])
    return {}


async def create_test_chat(
    connection: Connection,
    user_id: str,
    title: str = "Test Chat"
) -> Dict[str, Any]:
    """
    Create a test chat in the Drizzle database.
    
    Args:
        connection: Database connection
        user_id: User ID
        title: Chat title
        
    Returns:
        Dict[str, Any]: Created chat data
    """
    chat_id = str(uuid.uuid4())
    
    sql = """
    INSERT INTO "Chat" (
        "id", "userId", "title", "createdAt", "updatedAt"
    )
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
    """
    
    results = await connection.fetch(sql, chat_id, user_id, title)
    
    if results:
        return dict(results[0])
    return {}


async def create_test_message(
    connection: Connection,
    chat_id: str,
    content: str = "Test message",
    role: str = "user"
) -> Dict[str, Any]:
    """
    Create a test message in the Drizzle database.
    
    Args:
        connection: Database connection
        chat_id: Chat ID
        content: Message content
        role: Message role
        
    Returns:
        Dict[str, Any]: Created message data
    """
    message_id = str(uuid.uuid4())
    
    sql = """
    INSERT INTO "Message" (
        "id", "chatId", "content", "role", "createdAt", "updatedAt", "isDeleted"
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW(), false)
    RETURNING *
    """
    
    results = await connection.fetch(sql, message_id, chat_id, content, role)
    
    if results:
        return dict(results[0])
    return {}


async def clean_test_data(connection: Connection) -> None:
    """
    Clean test data from the database.
    
    Args:
        connection: Database connection
    """
    # Delete in order to respect foreign key constraints
    await connection.execute('DELETE FROM "Message"')
    await connection.execute('DELETE FROM "Chat"')
    await connection.execute('DELETE FROM "Session"')
    await connection.execute('DELETE FROM "PasswordReset"')
    await connection.execute('DELETE FROM "Account"')
    await connection.execute('DELETE FROM "User" WHERE "email" LIKE \'%test%\'')


class DBTestSession:
    """
    Database test session that automatically rolls back changes.
    """
    
    def __init__(self, connection: Connection):
        """
        Initialize a database test session.
        
        Args:
            connection: Database connection
        """
        self.connection = connection
        self.transaction = None
        
    async def __aenter__(self) -> 'DBTestSession':
        """Start a transaction."""
        self.transaction = self.connection.transaction()
        await self.transaction.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Rollback the transaction."""
        if self.transaction:
            await self.transaction.rollback()
    
    async def execute(self, sql: str, *args) -> str:
        """Execute a SQL command."""
        return await self.connection.execute(sql, *args)
    
    async def fetch(self, sql: str, *args) -> List[Dict[str, Any]]:
        """Execute a SQL query."""
        results = await self.connection.fetch(sql, *args)
        return [dict(row) for row in results]
    
    async def fetchval(self, sql: str, *args) -> Any:
        """Execute a SQL query and return a single value."""
        return await self.connection.fetchval(sql, *args)


async def with_db_transaction(
    func: Callable[..., AsyncGenerator]
) -> AsyncGenerator:
    """
    Decorator to run a test function in a transaction.
    
    Args:
        func: Test function
        
    Returns:
        AsyncGenerator: Test function results
    """
    from app.drizzle import get_db_pool
    
    pool = get_db_pool()
    conn = await pool.acquire()
    
    try:
        async with DBTestSession(conn) as session:
            yield func(session)
    finally:
        await pool.release(conn)