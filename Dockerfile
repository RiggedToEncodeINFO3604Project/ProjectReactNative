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

# Accept build-time environment variables
ARG EXPO_PUBLIC_GEMINI_API_KEY
ARG GEMINI_API_KEY

# Set environment variables for the build
ENV EXPO_PUBLIC_GEMINI_API_KEY=$EXPO_PUBLIC_GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Expose port for Expo
EXPOSE 8081

# Build the web app
RUN npx expo export --platform web

# Default command - serve the built static files from the dist directory
CMD ["npx", "serve", "dist", "-l", "8081"]
