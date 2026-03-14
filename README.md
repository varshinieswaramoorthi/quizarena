# 🎮 QuizArena

A real-time interactive quiz platform — teachers host quizzes, students join with a code and compete live.

---

## 🚀 Deployment Guide (Supabase + Render)

### Step 1 — Set up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, give it a name, set a database password, choose a region
3. Once created, go to **SQL Editor** (left sidebar)
4. Copy the entire contents of `supabase_setup.sql` and paste it into the editor
5. Click **Run** — this creates all tables and a default admin account
6. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → this is your `SUPABASE_SERVICE_KEY`
   - ⚠️ Keep the service_role key secret — never expose it in the browser

---

### Step 2 — Deploy to Render

1. Push this project to a GitHub repository
2. Go to [render.com](https://render.com) and create a free account
3. Click **New → Web Service** and connect your GitHub repo
4. Configure the service:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SERVICE_KEY` | Your service_role key |
   | `SESSION_SECRET` | Any long random string (e.g. 32+ chars) |
   | `APP_URL` | Your Render app URL (e.g. `https://quizarena.onrender.com`) |
   | `NODE_ENV` | `production` |

6. Click **Create Web Service** — Render will build and deploy automatically

---

### Step 3 — First Login

1. Visit your Render app URL
2. Click **Teacher / Admin Login** at the bottom
3. Login with:
   - Username: `admin`
   - Password: `password123`
4. **⚠️ Important:** Change the password immediately after first login (update directly in Supabase Table Editor)

---

## 🎯 How to Use

### As a Teacher/Admin:
1. Login at `/login`
2. Create a quiz with questions and time limits
3. From the dashboard, click **Host** to make the quiz live
4. Share the 6-character code with students
5. Click **Start Quiz Now** when everyone has joined
6. Advance questions manually when ready
7. Download a PDF report when finished

### As a Student:
1. Visit the app URL
2. Enter the 6-character code and your nickname
3. Wait for the teacher to start
4. Answer each question before the timer runs out
5. Faster correct answers = more points (500–1000 per question)
6. See your final score and rank at the end

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# Run dev server
node server.js
# Visit http://localhost:3000
```

---

## 📁 Project Structure

```
quizarena/
├── server.js              # Express app entry point
├── render.yaml            # Render deployment config
├── supabase_setup.sql     # Database schema (run once in Supabase)
├── config/
│   └── supabase.js        # Supabase client
├── routes/
│   ├── auth.js            # Login/logout
│   ├── admin.js           # Dashboard, create quiz, host, PDF export
│   ├── quiz.js            # Join, play, result, leaderboard
│   └── api.js             # AJAX endpoints for live quiz
├── views/                 # EJS templates
│   ├── index.ejs          # Home/join page
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── create_quiz.ejs
│   ├── start_quiz.ejs     # Host control panel
│   ├── quiz.ejs           # Student game screen
│   ├── result.ejs
│   └── leaderboard.ejs
└── public/
    ├── css/style.css      # Glass-morphism styles
    └── js/main.js         # Client-side quiz polling logic
```

---

## 📊 Scoring System

Points per correct answer: **500–1000 pts**  
Formula: `500 + 500 × (1 - time_used / time_limit)`  
Answer instantly = 1000 pts | Answer at last second = ~500 pts | Wrong answer = 0 pts
