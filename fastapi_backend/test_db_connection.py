import asyncio
import sys

# Add the current directory to the path so we can import app modules
sys.path.append(".")

from app.drizzle import connect_db_pool, query, close_db_pool
from app.config import settings


async def test_database_connection():
    """Test connection to the Neon PostgreSQL database."""
    print(f"Testing connection to database at: {settings.DATABASE_URL}")
    
    try:
        # Connect to the database
        print("Connecting to database pool...")
        await connect_db_pool(min_size=1, max_size=2)
        
        # Try a simple query
        print("Executing query...")
        tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        
        # Output the tables found
        print("\nDatabase connected successfully!")
        print(f"Found {len(tables)} tables in the public schema:")
        for table in tables:
            print(f"  - {table['table_name']}")
            
        return True
    except Exception as e:
        print(f"Error connecting to database: {str(e)}")
        return False
    finally:
        # Close the connection pool
        print("\nClosing database pool...")
        await close_db_pool()


if __name__ == "__main__":
    success = asyncio.run(test_database_connection())
    
    # Exit with appropriate status code
    if success:
        print("\nTest completed successfully!")
        sys.exit(0)
    else:
        print("\nTest failed.")
        sys.exit(1)