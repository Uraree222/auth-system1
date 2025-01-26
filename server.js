require('dotenv').config();
const express = require('express');
const session = require('express-session');
const {RedisStore} = require('connect-redis');
const { createClient } = require('redis');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// In-memory storage fallback
const memoryUsers = new Map();

// Create Redis client with error handling
const redisClient = createClient({
    url: 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000
    }
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

// Connect to Redis
(async () => {
    try {
        await redisClient.connect();
        console.log('Redis client connected!');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        // Continue running the app, but sessions will be stored in memory
    }
})();

// Configure session store based on Redis connection
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 30,
    }
};

// Use Redis store if connected, otherwise use memory store
if (redisClient.isOpen) {
    const redisStore = new RedisStore({ client: redisClient });
    sessionConfig.store = redisStore;
    console.log('Using Redis session store');
} else {
    console.log('Using memory session store');
}

// Middleware to parse JSON
app.use(express.json());
app.use(express.static('public'));
app.use(express.static('views')); // Serve files from views directory as well

// Configure session middleware
app.use(session(sessionConfig));

// Helper functions for Redis user operations
async function createUser(username, password) {
    try {
        // If Redis is not connected, use memory storage
        if (!redisClient.isOpen) {
            console.log('Using memory storage for user creation');
            if (memoryUsers.has(username)) {
                console.log('User already exists in memory:', username);
                return false;
            }
            memoryUsers.set(username, {
                username,
                password,
                createdAt: new Date().toISOString()
            });
            console.log('User created in memory:', username);
            return true;
        }

        const userKey = `user:${username}`;
        console.log('Checking if user exists:', userKey);
        const exists = await redisClient.exists(userKey);
        
        if (exists) {
            console.log('User already exists:', username);
            return false;
        }

        console.log('Creating new user:', username);
        // Fix the hSet command format
        await redisClient.hSet(userKey, 'username', username);
        await redisClient.hSet(userKey, 'password', password);
        await redisClient.hSet(userKey, 'createdAt', new Date().toISOString());
        
        console.log('User created successfully:', username);
        return true;
    } catch (error) {
        console.error('Error in createUser:', error);
        throw error;
    }
}

async function getUser(username) {
    try {
        // If Redis is not connected, use memory storage
        if (!redisClient.isOpen) {
            console.log('Using memory storage for user lookup');
            const user = memoryUsers.get(username);
            return user || null;
        }

        const userKey = `user:${username}`;
        console.log('Fetching user:', userKey);
        const user = await redisClient.hGetAll(userKey);
        console.log('User data retrieved:', Object.keys(user).length > 0);
        return Object.keys(user).length > 0 ? user : null;
    } catch (error) {
        console.error('Error in getUser:', error);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    console.log('Registration attempt:', { username });

    // Validate input
    if (!username || !password) {
        console.log('Registration failed: Missing username or password');
        return res.status(400).json({ message: 'Username and password are required' });
    }

    if (username.length < 3) {
        console.log('Registration failed: Username too short');
        return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
        console.log('Registration failed: Password too short');
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        // Check Redis connection
        if (!redisClient.isOpen) {
            console.error('Redis client is not connected');
            return res.status(500).json({ message: 'Database connection error' });
        }

        const success = await createUser(username, password);
        if (!success) {
            console.log('Registration failed: Username already exists');
            return res.status(400).json({ message: 'Username already exists' });
        }

        console.log('Registration successful for user:', username);
        res.json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error during registration: ' + error.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', { username });
    
    try {
        // Special test account
        if (username === 'test' && password === 'test123') {
            req.session.user = { username };
            console.log('Login successful (test account), session:', req.session);
            return res.json({ message: 'Login successful!' });
        }

        const user = await getUser(username);
        if (user && user.password === password) {
            req.session.user = { username };
            console.log('Login successful, session:', req.session);
            res.json({ message: 'Login successful!' });
        } else {
            console.log('Login failed: Invalid credentials');
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error during login' });
    }
});

app.get('/dashboard', (req, res) => {
    console.log('Dashboard access attempt, session:', req.session);
    if (req.session.user) {
        console.log('Dashboard access granted for user:', req.session.user.username);
        res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
    } else {
        console.log('Dashboard access denied: No session');
        res.redirect('/login');
    }
});

app.get('/api/dashboard', (req, res) => {
    console.log('Dashboard API access, session:', req.session);
    if (req.session.user) {
        console.log('Dashboard API access granted for user:', req.session.user.username);
        res.json({ message: req.session.user.username });
    } else {
        console.log('Dashboard API access denied: No session');
        res.status(401).json({ message: 'Unauthorized access' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ message: 'Logout failed' });
        } else {
            res.json({ message: 'Logout successful' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
