FROM node:24-bookworm

# Set the working directory
WORKDIR /app

# Install bun globally
RUN npm install -g bun

# Copy dependency files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Set ownership of the app directory
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3000

# Start the application
CMD ["./start.sh"]
