const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Handle specific index.html frontend post payload
router.post('/join', async (req, res) => {
    const { code, name } = req.body;
    try {
        const codeUpper = code.toUpperCase().trim();
        const { data: quiz, error } = await supabase.from('quizzes').select('*').eq('code', codeUpper).single();
        
        if (error || !quiz) {
            return res.send('<h2>Invalid Quiz Code</h2><br><a href="/">Return to Lobby</a>');
        }
        if (quiz.status !== 'live') {
            return res.send('<h2>Quiz is not currently live. Wait for Admin instructions.</h2><br><a href="/">Return to Lobby</a>');
        }

        // Append to participant logs
        const { data: participant } = await supabase.from('participants').insert([{
            quiz_id: quiz.id,
            name: name
        }]).select().single();

        // Link temporary cookies safely allowing secure REST endpoints
        req.session.participantId = participant.id;
        res.redirect(`/play/${codeUpper}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('<h1>Server Environment Crash</h1>');
    }
});

// Game Board Layout Delivery
router.get('/play/:code', async (req, res) => {
    if (!req.session.participantId) {
        return res.redirect('/');
    }
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('code', req.params.code).single();
    if (!quiz) return res.redirect('/');

    const { data: participant } = await supabase.from('participants').select('*').eq('id', req.session.participantId).single();
    
    // Defer visualization strictly to frontend layout views/play.ejs
    res.render('play', { quiz, participant });
});

module.exports = router;
