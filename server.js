const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// Ensure required ENV vars exist for production capability
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.SESSION_SECRET) {
    console.error("FATAL ERROR: Missing required environment variables (SUPABASE_URL, SUPABASE_KEY, SESSION_SECRET). Server cannot start.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const playerRoutes = require('./routes/player');

// Attach specific operational controllers
app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/api', apiRoutes);
app.use('/', playerRoutes);

// Serve the Landing Page specifically on the root trajectory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
