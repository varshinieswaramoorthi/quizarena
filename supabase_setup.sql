-- ================================================
-- QuizArena - Supabase Database Setup
-- Run this in Supabase SQL Editor (supabase.com)
-- ================================================

-- 1. Admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    quiz_title VARCHAR(255) NOT NULL,
    quiz_code VARCHAR(20) NOT NULL UNIQUE,
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'ended')),
    current_question INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option1 VARCHAR(255) NOT NULL,
    option2 VARCHAR(255) NOT NULL,
    option3 VARCHAR(255) NOT NULL,
    option4 VARCHAR(255) NOT NULL,
    correct_answer INTEGER NOT NULL CHECK (correct_answer IN (1,2,3,4)),
    timer_limit INTEGER DEFAULT 30,
    order_num INTEGER NOT NULL
);

-- 4. Participants table
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    quiz_code VARCHAR(20) NOT NULL,
    score INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    time_taken VARCHAR(50) DEFAULT '0s',
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Results table (for PDF reports after quiz ends)
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    participant_name VARCHAR(100) NOT NULL,
    score INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    time_taken VARCHAR(50) DEFAULT '0s',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Indexes for performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_quizzes_code ON quizzes(quiz_code);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, order_num);
CREATE INDEX IF NOT EXISTS idx_participants_code ON participants(quiz_code);
CREATE INDEX IF NOT EXISTS idx_results_quiz ON results(quiz_id);

-- ================================================
-- Default admin account
-- Username: admin
-- Password: password123  (CHANGE THIS after first login!)
-- ================================================
-- NOTE: Generate a bcrypt hash of your password and insert it here.
-- You can generate one at: https://bcrypt-generator.com/
-- Or run: node -e "const b=require('bcryptjs');console.log(b.hashSync('password123',10))"
-- Then replace the hash below:

INSERT INTO admins (username, password)
VALUES (
    'admin',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'  -- password = "password123"
)
ON CONFLICT (username) DO NOTHING;

-- ================================================
-- RLS (Row Level Security) - DISABLE for service key usage
-- ================================================
-- Since we use the service key server-side, RLS is bypassed.
-- But if you want extra security, you can enable it:
-- ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE results ENABLE ROW LEVEL SECURITY;
