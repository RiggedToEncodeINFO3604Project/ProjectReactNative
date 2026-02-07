# Docker Deployment

This project can be deployed using Docker.

## Build and Run Locally

```bash
# Build the image
docker build -t expo-app .

# Run the container
docker run -p 8081:8081 expo-app
```

## Using Docker Compose

```bash
# Build and start the service
docker-compose up --build

# Start the service (without rebuilding)
docker-compose up

# Stop the service
docker-compose down
```

## Environment Variables

The following environment variables can be passed to the container:

- `EXPO_PUBLIC_GEMINI_API_KEY`: Gemini API key for the chatbot

## Notes

- The container builds the Expo web app and serves it using `npx serve`
- The web app is served on port 8081
- The container uses Node.js 20 Alpine base image
