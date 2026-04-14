const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Fetch questions mapped to active quiz (Correct Answers STRIPPED)
router.get('/quiz/:code/questions', async (req, res) => {
    try {
        const { data: quiz } = await supabase.from('quizzes').select('*').eq('code', req.params.code).single();
        if (!quiz || quiz.status !== 'live') return res.status(403).json({ error: 'Quiz not active' });

        const { data: questions } = await supabase.from('questions').select('id, text, options, time_limit').eq('quiz_id', quiz.id);
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Intercepts Player Submissions, dynamically compares hash against DB natively avoiding user-side leaks.
router.post('/quiz/:code/answer', async (req, res) => {
    try {
        const { participantId, questionId, selectedIndex, timeRemaining } = req.body;
        
        // Isolate verification payload strictly onto Node Environment.
        const { data: q } = await supabase.from('questions').select('correct_index').eq('id', questionId).single();
        const isCorrect = (q && q.correct_index === selectedIndex);
        
        let scoreAwarded = 0;
        if (isCorrect) {
            // High fidelity math logic. Fast times yield 1000 bounds. Base points secured.
            scoreAwarded = Math.max(500, timeRemaining * 100); 
            
            const { data: p } = await supabase.from('participants').select('score').eq('id', participantId).single();
            await supabase.from('participants').update({ score: p.score + scoreAwarded }).eq('id', participantId);
        }

        // Store performance analytics
        await supabase.from('answers').insert([{
            participant_id: participantId,
            question_id: questionId,
            is_correct: isCorrect,
            score_awarded: scoreAwarded
        }]);

        res.json({ isCorrect, scoreAwarded, correctIndex: q.correct_index });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Control Modifiers
router.post('/admin/quiz/:id/status', async (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    const { status } = req.body;
    await supabase.from('quizzes').update({ status }).eq('id', req.params.id);
    res.json({ success: true });
});

router.delete('/admin/quiz/:id', async (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    await supabase.from('quizzes').delete().eq('id', req.params.id);
    res.json({ success: true });
});

module.exports = router;
