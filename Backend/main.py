# ─────────────────────────────────────────────────────────────────────────────
# STEMBridge AI — Backend API  (v2.0)
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google import genai
from passlib.context import CryptContext
from dotenv import load_dotenv
from typing import Optional
import models, os, sys, uuid, json, subprocess
from database import engine, SessionLocal, Base

load_dotenv()

# ── App & static files ────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="STEMBridge AI", version="2.0.0")

os.makedirs("simulations", exist_ok=True)
app.mount("/simulations", StaticFiles(directory="simulations"), name="simulations")

# ── CORS ─────────────────────────────────────────────────────────────────────
# After deploying your frontend to Vercel, replace the placeholder below with
# your actual Vercel URL, e.g. "https://stembridge.vercel.app"
# To find it: Vercel dashboard → your project → Settings → Domains
_ALLOWED_ORIGINS = [
    "http://localhost:5173",                    # local Vite dev server
    "http://localhost:3000",                    # fallback for CRA / Next dev
    "https://YOUR_VERCEL_APP.vercel.app",       # ← replace after Vercel deployment
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# ── Gemini setup ──────────────────────────────────────────────────────────────
# Add  GEMINI_API_KEY=your_key_here  to your .env file — never hardcode keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set. Add it to your .env file.")

# You can also override the model in .env: GEMINI_MODEL=gemini-2.0-flash
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

client = genai.Client(api_key=GEMINI_API_KEY)

# ── Password hashing ──────────────────────────────────────────────────────────
# pip install passlib[bcrypt]
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── DB dependency ─────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: str
    age: int
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class Question(BaseModel):
    text: str
    language: str = "English"
    user_id: Optional[int] = None   # enables history + progress tracking
    topic: Optional[str] = None     # optional tag for analytics

class QuizSubmit(BaseModel):
    user_id: int
    topic: str
    correct_answers: int
    total_questions: int
    time_taken: int   # seconds


# ─────────────────────────────────────────────────────────────────────────────
# Gemini helpers
# ─────────────────────────────────────────────────────────────────────────────
def call_gemini(prompt: str) -> str:
    """Raw Gemini call — no academic filter applied here."""
    try:
        return client.models.generate_content(
            model=GEMINI_MODEL, contents=prompt
        ).text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)}")


def academic_guard(text: str) -> None:
    """
    Raises HTTP 403 if the input is clearly NOT a STEM / academic question.

    How it works (zero Gemini calls):
      - Checks the normalised text against a STEM keyword allowlist first.
        Any match → immediately allowed (fast path).
      - If no STEM keyword is found, checks against a blocklist of obviously
        off-topic categories (movies, celebs, politics, dating, …).
        Any match → HTTP 403.
      - If neither list matches we allow the request; Gemini itself will give
        a sensible answer or politely decline.

    This keeps 1 request = 1 Gemini API call.
    """
    normalised = text.lower()

    # ── STEM / academic allowlist ─────────────────────────────────────────────
    STEM_KEYWORDS = {
        # Core STEM disciplines
        "math", "maths", "mathematics", "algebra", "calculus", "geometry",
        "trigonometry", "statistics", "probability", "arithmetic", "number theory",
        "linear algebra", "differential", "integral", "equation", "theorem",
        "physics", "mechanics", "thermodynamics", "electromagnetism", "optics",
        "quantum", "relativity", "kinematics", "dynamics", "force", "energy",
        "momentum", "gravity", "wave", "frequency", "voltage", "current", "circuit",
        "chemistry", "organic", "inorganic", "reaction", "element", "compound",
        "molecule", "atom", "electron", "proton", "neutron", "periodic table",
        "acid", "base", "ph", "bond", "polymer", "titration", "mole",
        "biology", "cell", "dna", "rna", "genetics", "evolution", "ecology",
        "photosynthesis", "respiration", "enzyme", "protein", "virus", "bacteria",
        "anatomy", "physiology", "taxonomy", "mitosis", "meiosis",
        "computer science", "programming", "algorithm", "data structure",
        "code", "coding", "python", "java", "javascript", "c++", "c#",
        "html", "css", "sql", "database", "array", "linked list", "tree",
        "graph", "sorting", "searching", "recursion", "object oriented",
        "machine learning", "deep learning", "neural network", "ai",
        "artificial intelligence", "nlp", "computer vision", "model",
        "engineering", "circuit", "signal", "mechanical", "electrical",
        "civil", "software", "hardware", "semiconductor", "microprocessor",
        # School / college subjects
        "science", "theorem", "formula", "proof", "hypothesis", "experiment",
        "homework", "exam", "test", "assignment", "lecture", "textbook",
        "school", "college", "university", "syllabus", "subject", "chapter",
        "exercise", "problem", "solution", "study", "revision", "notes",
        "explain", "definition", "concept", "principle", "law", "theory",
        # Common academic verbs / phrases
        "how does", "what is", "why does", "derive", "calculate", "solve",
        "prove", "simplify", "differentiate", "integrate", "factorise", "factorize",
    }

    if any(kw in normalised for kw in STEM_KEYWORDS):
        return   # fast-path: clearly academic

    # ── Off-topic blocklist ───────────────────────────────────────────────────
    BLOCKED_KEYWORDS = {
        # Entertainment / pop culture
        "movie", "film", "actor", "actress", "celebrity", "celebrity",
        "hollywood", "bollywood", "tv show", "television", "series", "netflix",
        "song", "singer", "musician", "band", "concert", "album", "lyrics",
        "sports team", "cricket score", "football score", "ipl", "match score",
        # Politics & news
        "politician", "prime minister", "president", "election", "party",
        "government policy", "news", "breaking news",
        # Dating / personal / random chat
        "dating", "girlfriend", "boyfriend", "relationship advice", "propose",
        "marriage", "breakup", "crush", "flirt", "love advice",
        "tell me a joke", "what's up", "how are you", "bored",
        "recommend a movie", "recommend a song",
    }

    if any(kw in normalised for kw in BLOCKED_KEYWORDS):
        raise HTTPException(
            status_code=403,
            detail=(
                "STEMBridge AI only answers STEM and academic questions. "
                "Please ask something related to Science, Technology, "
                "Engineering, or Mathematics."
            ),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/register", tags=["Auth"])
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    new_user = models.User(
        name=user.name,
        email=user.email,
        age=user.age,
        password=pwd_ctx.hash(user.password),   # 🔒 bcrypt — NEVER store plain text
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Registration successful", "user_id": new_user.id}


@app.post("/login", tags=["Auth"])
def login(user: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not pwd_ctx.verify(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    return {
        "message": f"Welcome back, {db_user.name}!",
        "user_id": db_user.id,
        "name": db_user.name,
    }


@app.get("/user/{user_id}", tags=["Auth"])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"id": user.id, "name": user.name, "email": user.email, "age": user.age}


# ─────────────────────────────────────────────────────────────────────────────
# AI Tutor  (all endpoints guarded by academic_guard)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/doubt", tags=["AI Tutor"])
def doubt_solver(q: Question, db: Session = Depends(get_db)):
    academic_guard(q.text)

    prompt = (
        f"You are a helpful STEM tutor. Always respond in {q.language}.\n"
        "Structure your answer exactly like this:\n"
        "1. Concept Explanation (simple, 2-3 lines)\n"
        "2. Step-by-Step Solution\n"
        "3. Formula or Logic Used\n"
        "4. A Simple Worked Example\n\n"
        f"Student question: {q.text}"
    )
    answer = call_gemini(prompt)

    if q.user_id:
        db.add(models.DoubtHistory(
            user_id=q.user_id,
            question=q.text,
            answer=answer,
            topic=q.topic or "General",
        ))
        db.commit()

    return {"result": answer}


@app.post("/hint", tags=["AI Tutor"])
def hint_generator(q: Question):
    academic_guard(q.text)

    prompt = (
        f"You are a helpful STEM tutor. Always respond in {q.language}.\n"
        "Rules:\n"
        "1. Give ONLY a single hint — do NOT solve the problem\n"
        "2. Maximum 2 lines\n"
        "3. Focus on the one key idea that unlocks the solution\n"
        "4. Keep it beginner-friendly\n\n"
        f"Student question: {q.text}"
    )
    return {"result": call_gemini(prompt)}


@app.post("/practice_questions", tags=["AI Tutor"])
def practice_question(q: Question):
    academic_guard(q.text)

    prompt = (
        f"You are a helpful STEM tutor. Always respond in {q.language}.\n"
        "Generate exactly 5 practice questions on the topic below.\n"
        "Rules:\n"
        "1. Start easy (Q1) → increase difficulty to hard (Q5)\n"
        "2. Do NOT give answers\n"
        "3. Label them Q1, Q2, Q3, Q4, Q5\n"
        "4. Each question must test a slightly deeper understanding\n\n"
        f"Topic: {q.text}"
    )
    return {"result": call_gemini(prompt)}


@app.post("/notes", tags=["AI Tutor"])
def notes_generator(q: Question, db: Session = Depends(get_db)):
    """Generate structured revision notes for a topic and optionally save them."""
    academic_guard(q.text)

    prompt = (
        f"You are an expert STEM tutor. Always respond in {q.language}.\n"
        "Generate revision notes in this exact format:\n\n"
        "## Topic Overview\n(2-3 lines)\n\n"
        "## Key Concepts\n- (5-7 bullet points)\n\n"
        "## Important Formulas / Rules\n- (each with a brief explanation)\n\n"
        "## Common Mistakes to Avoid\n- (3-4 bullet points)\n\n"
        "## Quick Summary\n- (3 bullets for last-minute revision)\n\n"
        f"Topic: {q.text}"
    )
    notes = call_gemini(prompt)

    if q.user_id:
        db.add(models.NotesHistory(
            user_id=q.user_id,
            topic=q.topic or q.text[:100],
            notes=notes,
        ))
        db.commit()

    return {"result": notes}


@app.post("/learning_path", tags=["AI Tutor"])
def learning_path(q: Question):
    """Generate a personalized step-by-step learning roadmap."""
    academic_guard(q.text)

    prompt = (
        f"You are an expert STEM curriculum designer. Always respond in {q.language}.\n"
        "Generate a structured learning path in this exact format:\n\n"
        "## Learning Path: [Subject Name]\n\n"
        "### Phase 1 — Foundations\n- subtopic\n\n"
        "### Phase 2 — Core Concepts\n- subtopic\n\n"
        "### Phase 3 — Advanced Topics\n- subtopic\n\n"
        "### Recommended Practice\n- types of problems to solve\n\n"
        "### Estimated Time per Phase\n\n"
        f"Subject: {q.text}"
    )
    return {"result": call_gemini(prompt)}


# ─────────────────────────────────────────────────────────────────────────────
# Quiz Engine
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/quiz/generate", tags=["Quiz"])
def generate_quiz(q: Question):
    """
    Generate 5 MCQ questions as structured JSON.
    Difficulty: Q1-Q2 easy → Q3 medium → Q4-Q5 hard.
    """
    academic_guard(q.text)

    prompt = (
        f"You are a STEM quiz generator. Always respond in {q.language}.\n"
        "Generate exactly 5 MCQ questions on the topic below.\n\n"
        "RETURN ONLY VALID JSON — no markdown, no backticks, no extra text:\n"
        '{\n'
        '  "topic": "...",\n'
        '  "questions": [\n'
        '    {\n'
        '      "id": 1,\n'
        '      "question": "...",\n'
        '      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n'
        '      "correct": "A",\n'
        '      "explanation": "one-line explanation"\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        "Rules:\n"
        "- Q1-Q2 easy, Q3 medium, Q4-Q5 hard\n"
        "- Exactly 4 options (A B C D) per question\n"
        "- 'correct' must be A, B, C, or D\n"
        "- Explanations must be ≤ 2 lines\n\n"
        f"Topic: {q.text}"
    )

    raw = call_gemini(prompt)
    try:
        clean = raw.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Quiz generation failed. Gemini returned invalid JSON. Please retry."
        )


@app.post("/quiz/submit", tags=["Quiz"])
def submit_quiz(data: QuizSubmit, db: Session = Depends(get_db)):
    """
    Store quiz results and upsert the user's progress for this topic.
    Score is a rolling average across all attempts on the same topic.
    """
    score_pct = round((data.correct_answers / data.total_questions) * 100, 1)

    # Always save the raw quiz attempt
    db.add(models.QuizResult(
        user_id=data.user_id,
        topic=data.topic,
        score=score_pct,
        total_questions=data.total_questions,
        correct_answers=data.correct_answers,
        time_taken=data.time_taken,
    ))

    # Upsert UserProgress: update existing row or create a new one
    progress = (
        db.query(models.UserProgress)
        .filter_by(user_id=data.user_id, topic_name=data.topic)
        .first()
    )
    if progress:
        progress.score    = score_pct
        progress.accuracy = round((progress.accuracy + score_pct) / 2, 1)
        progress.questions_solved += data.total_questions
        progress.time_taken       += data.time_taken
    else:
        db.add(models.UserProgress(
            user_id=data.user_id,
            topic_name=data.topic,
            score=score_pct,
            accuracy=score_pct,
            questions_solved=data.total_questions,
            time_taken=data.time_taken,
        ))

    db.commit()

    return {
        "score": score_pct,
        "correct": data.correct_answers,
        "total": data.total_questions,
        "message": "Great job! 🎉" if score_pct >= 70 else "Keep practicing — you'll get there!",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Simulation Lab
# ─────────────────────────────────────────────────────────────────────────────
_SIM_SYSTEM_PROMPT = """You are an expert at writing Python matplotlib animations.
Generate a complete Python script that visually animates the STEM concept provided.

STRICT RULES — every rule must be followed or the script will fail:
1. Use ONLY: matplotlib, matplotlib.animation, numpy, math
2. Do NOT import any other library
3. First lines must be:
   import numpy as np
   import matplotlib.pyplot as plt
   import matplotlib.animation as animation
4. Figure setup: fig, ax = plt.subplots(figsize=(7, 5))
5. Dark background: fig.patch.set_facecolor('#0d0e24') and ax.set_facecolor('#141428')
6. Use bright visible colors: #00F5A0  #FF3CAC  #7B2FFF  #FFD700
7. Title and axis labels must be white
8. The animation MUST show movement (ball moving, wave oscillating, arrows rotating, etc.)
9. The very last line of code MUST be exactly:
   ani.save('OUTPUT_PATH', writer='pillow', fps=24, dpi=100)
10. Output ONLY raw Python code — no explanation, no markdown, no backticks"""


@app.post("/simulate", tags=["Simulation"])
def simulate(q: Question, db: Session = Depends(get_db)):
    academic_guard(q.text)

    code = call_gemini(_SIM_SYSTEM_PROMPT + f"\n\nSTEM concept: {q.text}")
    clean_code = (
        code.replace("```python", "").replace("```py", "").replace("```", "").strip()
    )

    unique_id        = str(uuid.uuid4())[:8]
    output_filename  = f"sim_{unique_id}.gif"
    output_path      = os.path.abspath(f"simulations/{output_filename}")

    # Replace the OUTPUT_PATH placeholder Gemini was told to use
    clean_code = (
        clean_code
        .replace("OUTPUT_PATH", output_path)
        .replace("'output.gif'",  f"'{output_path}'")
        .replace('"output.gif"',  f'"{output_path}"')
    )

    tmp = f"simulations/tmp_{unique_id}.py"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(clean_code)

    try:
        # sys.executable ensures we use the SAME Python that is running FastAPI
        result = subprocess.run(
            [sys.executable, tmp],
            capture_output=True, text=True, timeout=40,
        )
        os.remove(tmp)

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Animation script error:\n{result.stderr[-400:]}",
            )
        if not os.path.exists(output_path):
            raise HTTPException(
                status_code=500,
                detail="GIF was not created. Retry with a different concept.",
            )

        gif_url = f"/simulations/{output_filename}"

        if q.user_id:
            db.add(models.SimulationHistory(
                user_id=q.user_id, concept=q.text, gif_url=gif_url
            ))
            db.commit()

        return {"gif_url": gif_url}

    except subprocess.TimeoutExpired:
        if os.path.exists(tmp): os.remove(tmp)
        raise HTTPException(status_code=504, detail="Simulation timed out. Try a simpler concept.")

    except HTTPException:
        raise   # re-raise our own HTTP errors without wrapping them

    except Exception as e:
        if os.path.exists(tmp): os.remove(tmp)
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/progress/{user_id}", tags=["Analytics"])
def get_progress(user_id: int, db: Session = Depends(get_db)):
    """Return all topics studied + overall stats for the dashboard."""
    progress = (
        db.query(models.UserProgress)
        .filter_by(user_id=user_id)
        .order_by(models.UserProgress.time_stamp.desc())
        .all()
    )
    quizzes = (
        db.query(models.QuizResult)
        .filter_by(user_id=user_id)
        .order_by(models.QuizResult.created_at.desc())
        .limit(10)
        .all()
    )

    avg_accuracy = (
        round(sum(p.accuracy for p in progress) / len(progress), 1)
        if progress else 0.0
    )

    return {
        "topics_studied": len({p.topic_name for p in progress}),
        "average_accuracy": avg_accuracy,
        "progress": [
            {
                "topic":            p.topic_name,
                "accuracy":         p.accuracy,
                "questions_solved": p.questions_solved,
                "hints_used":       p.hints_used,
                "last_studied":     p.time_stamp,
            }
            for p in progress
        ],
        "recent_quizzes": [
            {
                "topic":   r.topic,
                "score":   r.score,
                "correct": r.correct_answers,
                "total":   r.total_questions,
                "date":    r.created_at,
            }
            for r in quizzes
        ],
    }


@app.get("/weakness/{user_id}", tags=["Analytics"])
def get_weaknesses(user_id: int, db: Session = Depends(get_db)):
    """
    Identify weak areas (accuracy < 60%) and strong areas (accuracy >= 80%).
    Generates a plain-English recommendation for the student.
    """
    progress = db.query(models.UserProgress).filter_by(user_id=user_id).all()

    if not progress:
        return {"message": "Complete some quizzes first to see your weakness analysis!"}

    weak   = sorted([p for p in progress if p.accuracy < 60],  key=lambda p: p.accuracy)
    strong = sorted([p for p in progress if p.accuracy >= 80], key=lambda p: -p.accuracy)

    recommendation = (
        f"Focus on: {', '.join(p.topic_name for p in weak[:3])}"
        if weak
        else "You're performing well across all topics! Challenge yourself with advanced problems."
    )

    return {
        "weak_areas": [
            {"topic": p.topic_name, "accuracy": p.accuracy, "hints_used": p.hints_used}
            for p in weak
        ],
        "strong_areas": [
            {"topic": p.topic_name, "accuracy": p.accuracy}
            for p in strong
        ],
        "recommendation": recommendation,
    }


# ─────────────────────────────────────────────────────────────────────────────
# History
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/history/doubts/{user_id}", tags=["History"])
def get_doubt_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(models.DoubtHistory)
        .filter_by(user_id=user_id)
        .order_by(models.DoubtHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "count": len(items),
        "doubts": [
            {"question": h.question, "topic": h.topic, "date": h.created_at}
            for h in items
        ],
    }


@app.get("/history/simulations/{user_id}", tags=["History"])
def get_simulation_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(models.SimulationHistory)
        .filter_by(user_id=user_id)
        .order_by(models.SimulationHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "count": len(items),
        "simulations": [
            {"concept": h.concept, "gif_url": h.gif_url, "date": h.created_at}
            for h in items
        ],
    }


@app.get("/history/notes/{user_id}", tags=["History"])
def get_notes_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(models.NotesHistory)
        .filter_by(user_id=user_id)
        .order_by(models.NotesHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "count": len(items),
        "notes": [
            {"topic": h.topic, "date": h.created_at}
            for h in items
        ],
    }