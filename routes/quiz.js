const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

// POST /join
router.post('/join', async (req, res) => {
  const code = (req.body.code || '').toUpperCase().trim();
  const name = (req.body.name || 'Guest').trim();

  if (!code || !name) return res.redirect('/');

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, status')
    .eq('quiz_code', code)
    .single();

  if (!quiz) return res.send('Invalid Quiz Code. <a href="/">Go back</a>');
  if (quiz.status === 'ended') return res.send('This quiz has already ended. <a href="/">Go back</a>');

  const { data: participant } = await supabase
    .from('participants')
    .insert({ name, quiz_code: code, score: 0, correct_answers: 0, time_taken: '0s' })
    .select()
    .single();

  if (!participant) return res.send('Error joining quiz. <a href="/">Go back</a>');

  req.session.participantId = participant.id;
  req.session.participantName = name;
  req.session.quizCode = code;
  req.session.score = 0;
  req.session.correctAnswers = 0;
  req.session.totalTimeTaken = 0;
  req.session.answeredQuestions = [];

  res.redirect('/quiz');
});

// GET /quiz
router.get('/quiz', (req, res) => {
  if (!req.session.participantId || !req.session.quizCode) return res.redirect('/');
  res.render('quiz', {
    name: req.session.participantName,
    score: req.session.score,
    quizCode: req.session.quizCode
  });
});

// GET /result
router.get('/result', async (req, res) => {
  if (!req.session.participantId) return res.redirect('/');

  const code = req.session.quizCode;
  const name = req.session.participantName;
  const score = req.session.score;

  // Get rank
  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_code', code)
    .gt('score', score);

  const rank = (count || 0) + 1;

  // Top 3
  const { data: top3 } = await supabase
    .from('participants')
    .select('name, score')
    .eq('quiz_code', code)
    .order('score', { ascending: false })
    .limit(3);

  // Clear participant session
  delete req.session.participantId;
  delete req.session.participantName;
  delete req.session.quizCode;
  delete req.session.score;
  delete req.session.correctAnswers;
  delete req.session.totalTimeTaken;
  delete req.session.answeredQuestions;

  res.render('result', { name, score, rank, top3: top3 || [] });
});

// GET /leaderboard
router.get('/leaderboard', async (req, res) => {
  const code = req.query.code || req.session.quizCode;
  if (!code) return res.send('Quiz code required.');

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('quiz_title, status')
    .eq('quiz_code', code)
    .single();

  if (!quiz) return res.send('Invalid quiz.');

  const { data: participants } = await supabase
    .from('participants')
    .select('name, score')
    .eq('quiz_code', code)
    .order('score', { ascending: false })
    .limit(10);

  res.render('leaderboard', {
    quiz,
    participants: participants || [],
    hasParticipantSession: !!req.session.participantId
  });
});

module.exports = router;
