const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('FATAL ERROR: SUPABASE_URL and SUPABASE_KEY must be provided.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Auto-create default admin if not exists
async function ensureDefaultAdmin() {
    try {
        const { data, error } = await supabase
            .from('admins')
            .select('id')
            .eq('username', 'admin')
            .single();
            
        if (!data && error?.code === 'PGRST116') { // Correct error code for no rows returned
            console.log('Admin user not found. Attempting to seed default admin...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const { error: insertError } = await supabase.from('admins').insert([{
                username: 'admin',
                password: hashedPassword
            }]);
            if (insertError) throw insertError;
            console.log('Default admin user created successfully.');
        } else if (error && error.code !== 'PGRST116') {
             console.error('Query error checking default admin:', error.message);
        } else {
             console.log('Admin user already exists in database.');
        }
    } catch (err) {
        console.error('Error ensuring default admin:', err.message);
    }
}
ensureDefaultAdmin();

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
