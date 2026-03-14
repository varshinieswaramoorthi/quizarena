const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

// GET /api/current-question?code=XXXXXX
router.get('/current-question', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.json({ error: 'No code' });

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('status, current_question')
    .eq('quiz_code', code)
    .single();

  if (!quiz) return res.json({ error: 'Quiz not found' });

  if (quiz.status === 'ended') {
    return res.json({ status: 'ended' });
  }

  if (quiz.status === 'pending' || !quiz.current_question) {
    return res.json({ status: 'pending' });
  }

  // Get the current question (without revealing correct answer)
  const { data: question } = await supabase
    .from('questions')
    .select('id, question_text, option1, option2, option3, option4, timer_limit, order_num, quiz_id')
    .eq('id', quiz.current_question)
    .single();

  if (!question) return res.json({ status: 'pending' });

  // Get total questions count
  const { count: total } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', question.quiz_id);

  res.json({
    status: 'live',
    question: {
      id: question.id,
      text: question.question_text,
      option1: question.option1,
      option2: question.option2,
      option3: question.option3,
      option4: question.option4,
      timer_limit: question.timer_limit,
      order_num: question.order_num
    },
    current_num: question.order_num,
    total: total || 0
  });
});

// POST /api/submit-answer
router.post('/submit-answer', async (req, res) => {
  if (!req.session.participantId) {
    return res.json({ error: 'Not in a quiz session' });
  }

  const { questionId, answer, timeTaken } = req.body;
  const participantId = req.session.participantId;

  // Prevent answering the same question twice
  if (!req.session.answeredQuestions) req.session.answeredQuestions = [];
  if (req.session.answeredQuestions.includes(parseInt(questionId))) {
    return res.json({ alreadyAnswered: true, score: req.session.score });
  }

  // Get correct answer
  const { data: question } = await supabase
    .from('questions')
    .select('correct_answer, timer_limit')
    .eq('id', questionId)
    .single();

  if (!question) return res.json({ error: 'Question not found' });

  const isCorrect = parseInt(answer) === question.correct_answer;
  let points = 0;

  if (isCorrect) {
    // Points based on time - faster = more points (max 1000, min 500)
    const timeLimit = question.timer_limit || 30;
    const timeUsed = Math.min(parseFloat(timeTaken) || timeLimit, timeLimit);
    const ratio = 1 - (timeUsed / timeLimit);
    points = Math.round(500 + 500 * ratio);
  }

  // Update session
  req.session.answeredQuestions.push(parseInt(questionId));
  req.session.score = (req.session.score || 0) + points;
  if (isCorrect) req.session.correctAnswers = (req.session.correctAnswers || 0) + 1;
  req.session.totalTimeTaken = (req.session.totalTimeTaken || 0) + parseFloat(timeTaken || 0);

  // Update participant in DB
  await supabase
    .from('participants')
    .update({
      score: req.session.score,
      correct_answers: req.session.correctAnswers,
      time_taken: Math.round(req.session.totalTimeTaken) + 's'
    })
    .eq('id', participantId);

  res.json({
    correct: isCorrect,
    correctAnswer: question.correct_answer,
    points,
    newScore: req.session.score
  });
});

// POST /api/host  (admin only)
router.post('/host', async (req, res) => {
  if (!req.session.adminId) return res.json({ error: 'Unauthorized' });

  const quizId = parseInt(req.body.id);

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('status')
    .eq('id', quizId)
    .eq('created_by', req.session.adminId)
    .single();

  if (!quiz) return res.json({ error: 'Quiz not found' });

  await supabase.from('quizzes')
    .update({ status: 'live' })
    .eq('id', quizId);

  res.json({ success: true });
});

// POST /api/rehost  (admin only)
router.post('/rehost', async (req, res) => {
  if (!req.session.adminId) return res.json({ error: 'Unauthorized' });

  const quizId = parseInt(req.body.id);

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('quiz_code, status')
    .eq('id', quizId)
    .eq('created_by', req.session.adminId)
    .single();

  if (!quiz) return res.json({ error: 'Quiz not found' });

  // Clear participants and results
  await supabase.from('participants').delete().eq('quiz_code', quiz.quiz_code);
  await supabase.from('results').delete().eq('quiz_id', quizId);

  // Reset quiz to pending
  await supabase.from('quizzes')
    .update({ status: 'pending', current_question: 0 })
    .eq('id', quizId);

  res.json({ success: true });
});

module.exports = router;
