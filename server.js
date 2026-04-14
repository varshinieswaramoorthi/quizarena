const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

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
    secret: 'quizarena_secret_2026',
    resave: false,
    saveUninitialized: true
}));

// Routes
const authRoutes = require('./routes/auth');

app.use('/', authRoutes);

// Mock Dashboard Route (since logic was moved out of dashboard.php)
app.get('/dashboard', (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/login');
    }
    // You should fetch quizzes from Supabase here in a real implementation
    res.render('dashboard', { admin: req.session.admin, quizzes: [] });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
