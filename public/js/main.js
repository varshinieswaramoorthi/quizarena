// QuizArena - Client-side quiz game logic
let currentQuestionId = null;
let timerInterval = null;
let timeRemaining = 0;
let questionStartTime = null;
let answered = false;
let pollTimeout = null;

const screens = {
  waiting: document.getElementById('waitingScreen'),
  question: document.getElementById('questionScreen'),
  feedback: document.getElementById('feedbackScreen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('d-none'));
  screens[name]?.classList.remove('d-none');
}

async function pollQuiz() {
  try {
    const res = await fetch(`/api/current-question?code=${QUIZ_CODE}`);
    const data = await res.json();

    if (data.status === 'ended') {
      document.getElementById('waitingText').textContent = 'Quiz has ended! Redirecting...';
      showScreen('waiting');
      setTimeout(() => { window.location.href = '/result'; }, 1500);
      return;
    }

    if (data.status === 'pending' || !data.question) {
      showScreen('waiting');
      pollTimeout = setTimeout(pollQuiz, 2000);
      return;
    }

    // New question arrived
    if (data.question.id !== currentQuestionId) {
      answered = false;
      currentQuestionId = data.question.id;
      showQuestion(data.question, data.current_num, data.total);
      return;
    }

    // Same question — if answered, wait; else keep polling (host hasn't moved on)
    if (answered) {
      showScreen('feedback');
    }
    pollTimeout = setTimeout(pollQuiz, 2000);

  } catch (e) {
    console.error('Poll error:', e);
    pollTimeout = setTimeout(pollQuiz, 3000);
  }
}

function showQuestion(q, num, total) {
  clearInterval(timerInterval);

  document.getElementById('qNum').textContent = num;
  document.getElementById('qTotal').textContent = total;
  document.getElementById('questionText').textContent = q.text;
  document.getElementById('opt1Text').textContent = q.option1;
  document.getElementById('opt2Text').textContent = q.option2;
  document.getElementById('opt3Text').textContent = q.option3;
  document.getElementById('opt4Text').textContent = q.option4;

  // Re-enable all option buttons
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('btn-success', 'btn-danger', 'btn-secondary', 'selected');
    btn.classList.add('quiz-option');
  });

  timeRemaining = q.timer_limit || 30;
  questionStartTime = Date.now();
  updateTimer(timeRemaining);

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimer(timeRemaining);
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      if (!answered) {
        // Auto-submit with 0 answer (timed out)
        handleTimeout();
      }
    }
  }, 1000);

  showScreen('question');
}

function updateTimer(seconds) {
  const el = document.getElementById('timerDisplay');
  el.textContent = Math.max(0, seconds);
  el.classList.toggle('text-danger', seconds <= 5);
  el.classList.toggle('text-warning', seconds > 5);
}

async function selectOption(btn, optionNum) {
  if (answered) return;
  answered = true;
  clearInterval(timerInterval);

  const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(2);

  // Disable all buttons
  document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
  btn.classList.add('selected');

  try {
    const fd = new FormData();
    fd.append('questionId', currentQuestionId);
    fd.append('answer', optionNum);
    fd.append('timeTaken', timeTaken);

    const res = await fetch('/api/submit-answer', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.alreadyAnswered) {
      showFeedback(false, 0, data.score);
      return;
    }

    // Highlight correct/incorrect
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((b, i) => {
      const num = i + 1;
      if (num === data.correctAnswer) b.classList.add('btn-success');
      else if (num === optionNum && !data.correct) b.classList.add('btn-danger');
      else b.classList.add('btn-secondary');
    });

    // Update score display
    document.getElementById('scoreDisplay').textContent = data.newScore;

    setTimeout(() => showFeedback(data.correct, data.points, data.newScore), 800);
  } catch (e) {
    console.error('Submit error:', e);
    showFeedback(false, 0, parseInt(document.getElementById('scoreDisplay').textContent));
  }
}

async function handleTimeout() {
  answered = true;
  document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);

  try {
    const fd = new FormData();
    fd.append('questionId', currentQuestionId);
    fd.append('answer', 0);
    fd.append('timeTaken', 9999);
    await fetch('/api/submit-answer', { method: 'POST', body: fd });
  } catch (e) {}

  showFeedback(false, 0, parseInt(document.getElementById('scoreDisplay').textContent));
}

function showFeedback(correct, points, newScore) {
  const icon = document.getElementById('feedbackIcon');
  const title = document.getElementById('feedbackTitle');
  const pts = document.getElementById('feedbackPoints');

  if (correct) {
    icon.innerHTML = '<i class="bi bi-check-circle-fill text-success" style="font-size:5rem;"></i>';
    title.textContent = 'Correct!';
    title.className = 'mb-3 fw-bold text-success';
  } else {
    icon.innerHTML = '<i class="bi bi-x-circle-fill text-danger" style="font-size:5rem;"></i>';
    title.textContent = timeRemaining <= 0 ? "Time's Up!" : 'Incorrect';
    title.className = 'mb-3 fw-bold text-danger';
  }

  pts.textContent = points;
  document.getElementById('scoreDisplay').textContent = newScore;

  showScreen('feedback');
  pollTimeout = setTimeout(pollQuiz, 2000);
}

// Start polling when page loads
document.addEventListener('DOMContentLoaded', () => {
  showScreen('waiting');
  pollQuiz();
});
