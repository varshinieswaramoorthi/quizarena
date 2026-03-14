const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const router = express.Router();

// GET /
router.get('/', (req, res) => {
  res.render('index');
});

// GET /login
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Please fill in both fields.' });
  }

  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, password')
    .eq('username', username)
    .single();

  if (error || !admin) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  req.session.adminId = admin.id;
  req.session.adminUsername = username;
  res.redirect('/dashboard');
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
