"""
Test script to verify the FastAPI server can start correctly
"""

import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "FastAPI server is running correctly"}

if __name__ == "__main__":
    print("Starting test FastAPI server...")
    uvicorn.run("test_server:app", host="127.0.0.1", port=8000, reload=True)