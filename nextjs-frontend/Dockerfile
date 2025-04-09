FROM node:20-bookworm

# Set the working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# No need to copy files, install dependencies, or build
# as we'll mount the local directory including node_modules

# The node:20-bookworm image already has node user and group
# No need to create them again

# Set ownership of the app directory
RUN mkdir -p /app && chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3000

# Start the application
CMD ["./start.sh"]