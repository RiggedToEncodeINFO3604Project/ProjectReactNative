# Base image
FROM node:20-alpine AS base

# Install dependencies for Expo
RUN apk add --no-cache \
    ruby \
    ruby-dev \
    build-base \
    python3 \
    git \
    && gem install bundler

# Install Expo CLI globally
RUN npm install -g expo-cli@latest


# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port for Expo
EXPOSE 8081

# Build the web app
RUN npx expo export --platform web

# Default command - run the Express server with API proxy
CMD ["npm", "run", "serve"]
