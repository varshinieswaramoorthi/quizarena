const express = require('express');
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const router = express.Router();

// Middleware: require admin login
function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.redirect('/login');
  next();
}

// GET /dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select(`
      id, quiz_title, quiz_code, status, created_at,
      questions(count),
      participants(count)
    `)
    .eq('created_by', req.session.adminId)
    .order('created_at', { ascending: false });

  const formattedQuizzes = (quizzes || []).map(q => ({
    ...q,
    question_count: q.questions?.[0]?.count || 0,
    participant_count: q.participants?.[0]?.count || 0,
  }));

  res.render('dashboard', {
    quizzes: formattedQuizzes,
    adminUsername: req.session.adminUsername
  });
});

// GET /create-quiz
router.get('/create-quiz', requireAdmin, (req, res) => {
  res.render('create_quiz');
});

// POST /create-quiz
router.post('/create-quiz', requireAdmin, async (req, res) => {
  const { title, questions } = req.body;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: quiz, error: qErr } = await supabase
    .from('quizzes')
    .insert({ quiz_title: title, quiz_code: code, created_by: req.session.adminId, status: 'pending' })
    .select()
    .single();

  if (qErr || !quiz) {
    return res.status(500).send('Error creating quiz: ' + (qErr?.message || 'Unknown'));
  }

  if (questions && questions.length > 0) {
    const questionRows = questions.map((q, i) => ({
      quiz_id: quiz.id,
      question_text: q.text,
      option1: q.opt1,
      option2: q.opt2,
      option3: q.opt3,
      option4: q.opt4,
      correct_answer: parseInt(q.correct),
      timer_limit: parseInt(q.time),
      order_num: i + 1
    }));

    await supabase.from('questions').insert(questionRows);
  }

  res.redirect('/dashboard');
});

// GET /start-quiz/:id
router.get('/start-quiz/:id', requireAdmin, async (req, res) => {
  const quizId = parseInt(req.params.id);

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('created_by', req.session.adminId)
    .single();

  if (!quiz) return res.status(404).send('Quiz not found.');

  const { data: questions } = await supabase
    .from('questions')
    .select('id, order_num')
    .eq('quiz_id', quizId)
    .order('order_num');

  const { data: participants } = await supabase
    .from('participants')
    .select('name, score')
    .eq('quiz_code', quiz.quiz_code)
    .order('score', { ascending: false });

  const totalQuestions = questions?.length || 0;
  let currentNum = 0;
  if (quiz.current_question > 0 && questions) {
    const idx = questions.findIndex(q => q.id === quiz.current_question);
    if (idx !== -1) currentNum = idx + 1;
  }

  res.render('start_quiz', {
    quiz,
    questions: questions || [],
    participants: participants || [],
    totalQuestions,
    currentNum
  });
});

// POST /start-quiz/:id
router.post('/start-quiz/:id', requireAdmin, async (req, res) => {
  const quizId = parseInt(req.params.id);
  const { action } = req.body;

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('created_by', req.session.adminId)
    .single();

  if (!quiz) return res.status(404).send('Quiz not found.');

  const { data: questions } = await supabase
    .from('questions')
    .select('id, order_num')
    .eq('quiz_id', quizId)
    .order('order_num');

  if (action === 'start') {
    const firstQId = questions?.[0]?.id || 0;
    await supabase.from('quizzes')
      .update({ status: 'live', current_question: firstQId })
      .eq('id', quizId);
  } else if (action === 'next') {
    const currentQId = quiz.current_question;
    const currentIndex = questions.findIndex(q => q.id === currentQId);
    const nextQ = questions[currentIndex + 1];

    if (nextQ) {
      await supabase.from('quizzes')
        .update({ current_question: nextQ.id })
        .eq('id', quizId);
    } else {
      // End quiz - save results first
      await saveResults(quizId, quiz.quiz_code, supabase);
      await supabase.from('quizzes')
        .update({ status: 'ended', current_question: 0 })
        .eq('id', quizId);
    }
  } else if (action === 'finish') {
    await saveResults(quizId, quiz.quiz_code, supabase);
    await supabase.from('quizzes')
      .update({ status: 'ended', current_question: 0 })
      .eq('id', quizId);
  }

  res.redirect('/start-quiz/' + quizId);
});

// Save participant scores to results table when quiz ends
async function saveResults(quizId, quizCode, supabase) {
  const { data: participants } = await supabase
    .from('participants')
    .select('name, score, correct_answers, time_taken')
    .eq('quiz_code', quizCode);

  if (!participants || participants.length === 0) return;

  // Delete old results for this quiz first
  await supabase.from('results').delete().eq('quiz_id', quizId);

  const rows = participants.map(p => ({
    quiz_id: quizId,
    participant_name: p.name,
    score: p.score || 0,
    correct_answers: p.correct_answers || 0,
    time_taken: p.time_taken || '0s'
  }));

  await supabase.from('results').insert(rows);
}

// GET /export-pdf/:id
router.get('/export-pdf/:id', requireAdmin, async (req, res) => {
  const quizId = parseInt(req.params.id);

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('created_by', req.session.adminId)
    .single();

  if (!quiz) return res.status(404).send('Quiz not found.');
  if (quiz.status !== 'ended') return res.status(400).send('Quiz must be finished to generate a report.');

  const { data: results } = await supabase
    .from('results')
    .select('participant_name, score, correct_answers, time_taken')
    .eq('quiz_id', quizId)
    .order('score', { ascending: false });

  const { count: totalQuestions } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId);

  const doc = new PDFDocument({ margin: 50 });
  const filename = `quiz_report_${quiz.quiz_code}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('QuizArena - Quiz Report', { align: 'center' });
  doc.moveDown();

  // Details
  doc.fontSize(12).font('Helvetica-Bold').text('Quiz Name: ', { continued: true }).font('Helvetica').text(quiz.quiz_title);
  doc.font('Helvetica-Bold').text('Quiz Code: ', { continued: true }).font('Helvetica').text(quiz.quiz_code);
  doc.font('Helvetica-Bold').text('Total Questions: ', { continued: true }).font('Helvetica').text(String(totalQuestions || 0));
  doc.font('Helvetica-Bold').text('Total Participants: ', { continued: true }).font('Helvetica').text(String(results?.length || 0));
  doc.font('Helvetica-Bold').text('Quiz Date: ', { continued: true }).font('Helvetica').text(new Date(quiz.created_at).toLocaleDateString());
  doc.moveDown(2);

  // Table header
  const colWidths = [50, 150, 80, 80, 80];
  const headers = ['Rank', 'Name', 'Score', 'Correct', 'Time'];
  const startX = 50;
  let y = doc.y;

  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 24).fill('#d3d3d3');
  doc.fill('#000000');
  let x = startX;
  headers.forEach((h, i) => {
    doc.font('Helvetica-Bold').fontSize(11).text(h, x + 5, y + 6, { width: colWidths[i] - 10, align: 'center' });
    x += colWidths[i];
  });
  y += 24;

  // Rows
  (results || []).forEach((row, rank) => {
    if (y > 700) { doc.addPage(); y = 50; }
    const bg = rank % 2 === 0 ? '#ffffff' : '#f5f5f5';
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(bg);
    doc.fill('#000000');
    const cells = [String(rank + 1), row.participant_name, String(row.score), String(row.correct_answers), row.time_taken || '0s'];
    let cx = startX;
    cells.forEach((cell, i) => {
      doc.font('Helvetica').fontSize(10).text(cell, cx + 5, y + 5, { width: colWidths[i] - 10, align: i === 1 ? 'left' : 'center' });
      cx += colWidths[i];
    });
    y += 22;
    doc.y = y;
  });

  // Footer
  doc.moveDown(2);
  doc.fontSize(9).fillColor('#888888')
    .text(`Generated by QuizArena System  |  ${new Date().toLocaleString()}`, { align: 'center' });

  doc.end();
});

module.exports = router;
