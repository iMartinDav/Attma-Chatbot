FROM node:20-bookworm

# Set the working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Set ownership of the app directory
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3000

# Start the application
CMD ["./start.sh"]
