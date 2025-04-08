#!/bin/bash

# Exit on error
set -e

echo "Starting Attma Chatbot Frontend..."

# Start Next.js development server
echo "Starting Next.js development server..."
pnpm run dev

# Wait for the process to complete
wait