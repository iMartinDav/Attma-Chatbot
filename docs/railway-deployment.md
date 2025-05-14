# Railway Deployment Guide

The backend for Attma Chatbot is deployed on Railway. This document provides information about managing and maintaining the deployment.

## Deployment URL

The backend is accessible at: [attma-chatbot-production.up.railway.app](https://attma-chatbot-production.up.railway.app)

API documentation is available at: [attma-chatbot-production.up.railway.app/docs](https://attma-chatbot-production.up.railway.app/docs)

## Managing the Deployment

### Accessing Railway Dashboard

1. Log in to [Railway](https://railway.app/dashboard)
2. Navigate to the Attma project

### Deploying Updates

When changes are pushed to the main branch, Railway automatically deploys updates. For manual deployments:

```bash
cd fastapi_backend
railway up
```

### Environment Variables

Environment variables can be managed through the Railway dashboard:
1. Go to your project
2. Click on "Variables"
3. Add or modify as needed

### Monitoring

Railway provides built-in monitoring tools:
1. Go to your project
2. Click on "Metrics" to view resource usage
3. Click on "Logs" to view application logs

### Scaling

To scale your application:
1. Go to your project settings
2. Adjust the resource allocation as needed

## Rollback Procedure

If you need to roll back to a previous version:
1. Go to your project on Railway
2. Navigate to "Deployments"
3. Select the previous working deployment
4. Click "Rollback to this"
