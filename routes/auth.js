const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'mock-key';
const supabase = createClient(supabaseUrl, supabaseKey);

router.get('/login', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.render('login', { error: 'Please fill in both fields.' });
    }

    try {
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !admin) {
            return res.render('login', { error: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (isMatch) {
            req.session.admin = { id: admin.id, username: admin.username };
            return res.redirect('/dashboard');
        } else {
            return res.render('login', { error: 'Invalid username or password.' });
        }
    } catch (err) {
        console.error(err);
        return res.render('login', { error: 'Server error processing authentication.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
