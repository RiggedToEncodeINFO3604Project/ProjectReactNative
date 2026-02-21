# SkeduleIt - Scheduling Service Application

A full-stack scheduling service built with React Native Expo (frontend) and FastAPI (backend) using MongoDB (NoSQL database). The system allows customers to book appointments with service providers.

## Features

### Customer Features

- Register and login
- Search providers by name or Provider ID
- View provider services and availability
- Interactive calendar with color-coded booking status:
  - Red: Fully booked days
  - Yellow: 60%+ of available time booked
  - Green: Available days
  - Gray: Provider unavailable
- Book appointments with time slot selection
- View and manage bookings
- Cancel bookings

### Provider Features

- Register and login
- Set weekly availability schedules
- Manage services (add services with pricing)
- View pending booking requests
- Accept or reject booking requests

## Technology Stack

### Frontend

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Language**: TypeScript
- **State Management**: React Context
- **HTTP Client**: Axios
- **Theme**: Custom light/dark mode support

### Backend

- **Framework**: FastAPI (Python)
- **Database**: MongoDB (NoSQL)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt

## Project Structure

```
├── app/                          # Expo Router screens
│   ├── _layout.tsx              # Root layout with auth routing
│   ├── (auth)/                  # Authentication screens
│   │   ├── login.tsx
│   │   └── register/
│   │       ├── index.tsx
│   │       ├── customer.tsx
│   │       └── provider.tsx
│   ├── (customer)/              # Customer screens
│   │   ├── index.tsx
│   │   ├── bookings.tsx
│   │   └── provider/[id].tsx
│   ├── (provider)/              # Provider screens
│   │   ├── index.tsx
│   │   ├── services.tsx
│   │   ├── availability.tsx
│   │   └── pending.tsx
│   └── (tabs)/                  # Main app tabs
├── backend/                      # FastAPI backend
│   ├── main.py                  # App entry point
│   ├── config.py                # Configuration
│   ├── database.py              # MongoDB connection
│   ├── models.py                # Pydantic models
│   ├── auth.py                  # JWT authentication
│   └── routes/                  # API endpoints
│       ├── auth_routes.py
│       ├── customer_routes.py
│       └── provider_routes.py
├── components/                   # Reusable components
├── context/                      # React Context providers
│   ├── AuthContext.tsx          # Authentication state
│   └── ThemeContext.tsx         # Theme state
├── services/                     # API services
│   └── schedulingApi.ts         # Backend API client
├── types/                        # TypeScript types
│   └── scheduling.ts            # Scheduling types
└── constants/                    # App constants
    └── theme.ts                 # Theme colors
```

## Prerequisites

- Node.js 18+
- Python 3.8+
- MongoDB (local or MongoDB Atlas)
- Expo CLI

## Installation & Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env with your MongoDB connection
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=scheduling_db
# SECRET_KEY=your-secret-key

# Run the server
python main.py
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Create .env file for API URL
cp .env.example .env

# Edit .env if needed
# EXPO_PUBLIC_API_URL=http://localhost:8000

# Start the app
npm start
```

Run on device/emulator:

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go for physical device

## API Endpoints

### Authentication

- `POST /auth/register/customer` - Register as customer
- `POST /auth/register/provider` - Register as provider
- `POST /auth/login` - Login (returns JWT token)

### Customer Endpoints

- `GET /customer/providers/search` - Search providers
- `GET /customer/providers/{provider_id}/availability/{date}` - Get available slots
- `GET /customer/providers/{provider_id}/calendar/{year}/{month}` - Get monthly calendar
- `POST /customer/bookings` - Create booking request
- `GET /customer/bookings` - Get my bookings
- `DELETE /customer/bookings/{booking_id}` - Cancel booking

### Provider Endpoints

- `POST /provider/services` - Add service
- `GET /provider/services` - Get my services
- `POST /provider/availability` - Set availability
- `GET /provider/availability` - Get availability
- `GET /provider/bookings/pending` - Get pending bookings
- `POST /provider/bookings/{booking_id}/accept` - Accept booking
- `POST /provider/bookings/{booking_id}/reject` - Reject booking

## Database Schema

### Collections

1. **users** - User accounts
2. **customers** - Customer profiles
3. **providers** - Provider profiles
4. **services** - Provider services
5. **availability** - Provider availability schedules
6. **client_records** - Bookings

## Usage Flow

### Customer Journey

1. Register/Login as Customer
2. Search for providers by name or ID
3. Select a provider to view their services
4. View calendar with availability
5. Select date, service, and time slot
6. Submit booking request
7. Wait for provider approval
8. View/manage bookings in "My Bookings"

### Provider Journey

1. Register/Login as Provider
2. Add services with pricing
3. Set weekly availability schedule
4. Review pending booking requests
5. Accept or reject bookings

## Deployment

### Backend (Render)

1. Create a MongoDB Atlas cluster (free tier)
2. Push code to GitHub
3. Create a Web Service on Render:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `MONGODB_URL`: MongoDB Atlas connection string
   - `DATABASE_NAME`: scheduling_db
   - `SECRET_KEY`: Secure random key

### Frontend

Update `EXPO_PUBLIC_API_URL` in `.env` to point to your Render backend URL.

Build options:

- **Android APK**: `eas build --platform android`
- **iOS**: `eas build --platform ios`
- **Expo Go**: Use `npx expo start` for development

## Development Notes

- All passwords are hashed using bcrypt
- JWT tokens expire after 30 minutes (configurable)
- Time format: "HH:MM" (24-hour format)
- Date format: "YYYY-MM-DD"
- Days of week: 0 = Monday, 6 = Sunday

## Troubleshooting

### Backend Issues

- **MongoDB Connection Error**: Verify MongoDB is running and connection string is correct
- **Import Errors**: Run `pip install -r requirements.txt`
- **Port Already in Use**: Change port in main.py or stop other services

### Frontend Issues

- **Network Error**: Verify backend is running and `EXPO_PUBLIC_API_URL` is correct
- **Cannot Connect on Physical Device**: Use your computer's IP address instead of localhost
- **Expo Issues**: Try clearing cache with `npx expo start -c`

## License

This is an undergraduate project for educational purposes.

## Contributors

Project team members can be listed here.
