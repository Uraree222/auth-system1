# User Authentication System

A Node.js web application with user authentication using Express and Redis.

## Prerequisites

Before running this application, make sure you have the following installed:
- Node.js (v14 or higher)
- Redis Server
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone <your-repository-url>
cd <repository-folder>
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:
```
PORT=3000
SESSION_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
```

4. Make sure Redis is running on your system:
- Windows: Start Redis server using the Redis Windows Service or redis-server command
- Linux/Mac: `redis-server`

## Running the Application

1. Start the server:
```bash
node server.js
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

## Features

- User Registration
- User Login
- Session Management with Redis
- Protected Dashboard
- Secure Password Storage

## Development

- The application uses Redis for session storage and user data
- Express.js for the web server
- Bootstrap for the UI

## Important Notes

1. Make sure Redis is running before starting the application
2. Never commit the `.env` file to version control
3. For production, update the session secret and use proper security measures

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
