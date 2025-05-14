#!/bin/bash

# This script helps deploy the frontend to Vercel
# Run from the project root directory

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI is not installed. Installing..."
    npm install -g vercel
fi

# Change to frontend directory
cd nextjs-frontend

# Deploy to Vercel with production flag
echo "Deploying frontend to Vercel..."
vercel --prod

echo "Deployment complete! Check your Vercel dashboard for details."
