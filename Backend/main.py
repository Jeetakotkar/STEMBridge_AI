# ─────────────────────────────────────────────────────────────────────────────
# STEMBridge AI — Backend API  (v2.1 — production-ready)
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

app = FastAPI(title="STEMBridge AI", version="2.1.0")

os.makedirs("simulations", exist_ok=True)
app.mount("/simulations", StaticFiles(directory="simulations"), name="simulations")

# ── CORS ──────────────────────────────────────────────────────────────────────
# AFTER you deploy the frontend on Vercel, replace "https://YOUR_APP.vercel.app"
# with the actual URL Vercel gives you (e.g. https://stembridge-ai.vercel.app).
# You can also add the URL in your Render environment: FRONTEND_URL=https://...
_frontend_url = os.getenv("FRONTEND_URL", "https://YOUR_APP.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server (local React)
        "http://localhost:3000",   # CRA dev server (local React)
        "https://stem-bridge-ai.vercel.app",             # your deployed Vercel frontend
        "https://stem-bridge-ai-git-main-jeet677.vercel.app",
        "https://stem-bridge-6x6510mxa-jeet677.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_origin_regex=r"https://stem-bridge-ai.*\.vercel\.app",
)

# ── Gemini setup ──────────────────────────────────────────────────────────────
# Set  GEMINI_API_KEY=your_key_here  in Render → Settings → Environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set. Add it to your environment variables.")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
client = genai.Client(api_key=GEMINI_API_KEY)

# ── Password hashing ──────────────────────────────────────────────────────────
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
    user_id: Optional[int] = None
    topic: Optional[str] = None

class QuizSubmit(BaseModel):
    user_id: int
    topic: str
    correct_answers: int
    total_questions: int
    time_taken: int


# ─────────────────────────────────────────────────────────────────────────────
# TASK 1 — Local STEM keyword classifier  (replaces Gemini-based guard)
# 1 request now = 1 Gemini API call instead of 2.
# ─────────────────────────────────────────────────────────────────────────────

# Topics that are clearly allowed
_STEM_KEYWORDS = {
    # Mathematics
    "math", "mathematics", "algebra", "calculus", "geometry", "trigonometry",
    "statistics", "probability", "differentiation", "integration", "derivative",
    "matrix", "matrices", "vector", "equation", "polynomial", "theorem",
    "proof", "logarithm", "arithmetic", "number theory", "set theory",
    "limit", "sequence", "series", "permutation", "combination", "binomial",
    "quadratic", "linear", "gradient", "divergence", "curl", "laplace",
    # Physics
    "physics", "mechanics", "kinematics", "dynamics", "force", "motion",
    "velocity", "acceleration", "momentum", "energy", "work", "power",
    "gravity", "friction", "thermodynamics", "heat", "temperature",
    "electromagnetism", "electric", "magnetic", "wave", "optics", "light",
    "quantum", "relativity", "oscillation", "pendulum", "projectile",
    "circuit", "resistance", "capacitor", "inductor", "current", "voltage",
    "pressure", "density", "buoyancy", "refraction", "diffraction",
    "nuclear", "radioactivity", "photoelectric", "semiconductor",
    # Chemistry
    "chemistry", "chemical", "atom", "molecule", "element", "compound",
    "reaction", "acid", "base", "ph", "organic", "inorganic", "periodic",
    "bond", "electron", "proton", "neutron", "molar", "solution",
    "titration", "oxidation", "reduction", "catalyst", "polymer",
    "enthalpy", "entropy", "equilibrium", "electrochemistry", "isomer",
    "hydrocarbon", "functional group", "stoichiometry",
    # Biology
    "biology", "cell", "dna", "rna", "gene", "genetics", "protein",
    "enzyme", "photosynthesis", "respiration", "evolution", "ecology",
    "organism", "bacteria", "virus", "mitosis", "meiosis", "chromosome",
    "anatomy", "physiology", "nervous", "immune", "digestion",
    "ecosystem", "taxonomy", "biotechnology", "heredity", "mutation",
    # Computer Science & Programming
    "computer", "programming", "algorithm", "data structure", "code",
    "python", "java", "javascript", "c++", "c#", "sql", "html", "css",
    "array", "linked list", "tree", "graph", "stack", "queue", "sorting",
    "searching", "recursion", "complexity", "big o", "database", "api",
    "software", "operating system", "network", "internet", "compiler",
    "object oriented", "class", "function", "loop", "variable", "pointer",
    "binary", "bit", "byte", "memory", "cpu", "hardware", "debugging",
    "syntax", "runtime", "pointer", "dynamic programming", "greedy",
    "backtracking", "hash", "heap", "trie", "segment tree",
    # AI / ML
    "machine learning", "deep learning", "neural network",
    "artificial intelligence", "ai", "ml", "model", "training",
    "dataset", "regression", "classification", "clustering", "nlp",
    "computer vision", "reinforcement learning", "gradient descent",
    "overfitting", "underfitting", "accuracy", "loss function",
    # Engineering
    "engineering", "electronics", "mechanical", "civil", "electrical",
    "signal", "control", "transistor", "logic gate", "microcontroller",
    "arduino", "raspberry pi", "embedded", "pcb", "amplifier",
    # General academic
    "theorem", "hypothesis", "experiment", "science", "stem",
    "study", "explain", "solve", "calculate", "derive", "prove",
    "formula", "concept", "problem", "question", "homework",
    "exam", "test", "lecture", "chapter", "textbook",
}

# Topics that should always be rejected
_BLOCK_KEYWORDS = {
    "movie", "film", "actor", "actress", "celebrity", "bollywood", "hollywood",
    "web series", "netflix", "song", "music", "lyrics", "singer", "dance",
    "dating", "girlfriend", "boyfriend", "love advice", "relationship advice",
    "marriage", "divorce", "horoscope", "astrology", "zodiac", "tarot",
    "politics", "politician", "election", "government", "party", "vote",
    "cricket", "ipl", "football", "match", "sports score",
    "gossip", "rumor", "news", "meme", "joke", "fun fact",
    "instagram", "tiktok", "youtube", "social media", "influencer",
    "recipe", "cook", "restaurant", "diet plan", "weight loss",
    "fashion", "clothes", "makeup", "skincare",
    "whatsapp", "chat", "hi", "hello", "how are you", "tell me about yourself",
}

_GUARD_REJECTION_MSG = (
    "STEMBridge AI only answers STEM and academic questions. "
    "Please ask something related to Science, Technology, Engineering, or Mathematics."
)

def academic_guard(text: str) -> None:
    """
    Local keyword classifier — zero extra Gemini API calls.

    Two-step logic:
      Step 1 — Hard block: if the input matches a clearly non-academic keyword,
               reject immediately (fast path).
      Step 2 — Allow list: the input must contain at least one recognised STEM
               keyword to proceed. If nothing matches, reject conservatively.

    Result: 1 request = exactly 1 Gemini API call (down from 2).
    """
    lower = text.lower()

    # Step 1: explicit block list (movies, celebs, politics, etc.)
    if any(kw in lower for kw in _BLOCK_KEYWORDS):
        raise HTTPException(status_code=403, detail=_GUARD_REJECTION_MSG)

    # Step 2: must contain at least one STEM keyword
    if not any(kw in lower for kw in _STEM_KEYWORDS):
        raise HTTPException(status_code=403, detail=_GUARD_REJECTION_MSG)


# ─────────────────────────────────────────────────────────────────────────────
# Gemini helper
# ─────────────────────────────────────────────────────────────────────────────
def call_gemini(prompt: str) -> str:
    try:
        return client.models.generate_content(
            model=GEMINI_MODEL, contents=prompt
        ).text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)}")


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
        password=pwd_ctx.hash(user.password),
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
# AI Tutor
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
    score_pct = round((data.correct_answers / data.total_questions) * 100, 1)

    db.add(models.QuizResult(
        user_id=data.user_id,
        topic=data.topic,
        score=score_pct,
        total_questions=data.total_questions,
        correct_answers=data.correct_answers,
        time_taken=data.time_taken,
    ))

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
3. First lines must be EXACTLY:
   import matplotlib
   matplotlib.use('Agg')
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

    # ── Force Agg backend so matplotlib works on headless servers (Render) ────
    # If Gemini didn't include it at the top, we inject it ourselves.
    # Without this, the script crashes on any server with no display.
    if "matplotlib.use('Agg')" not in clean_code:
        clean_code = "import matplotlib\nmatplotlib.use('Agg')\n" + clean_code

    unique_id       = str(uuid.uuid4())[:8]
    output_filename = f"sim_{unique_id}.gif"
    output_path     = os.path.abspath(f"simulations/{output_filename}")

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
        raise

    except Exception as e:
        if os.path.exists(tmp): os.remove(tmp)
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/progress/{user_id}", tags=["Analytics"])
def get_progress(user_id: int, db: Session = Depends(get_db)):
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
        "weak_areas":   [{"topic": p.topic_name, "accuracy": p.accuracy, "hints_used": p.hints_used} for p in weak],
        "strong_areas": [{"topic": p.topic_name, "accuracy": p.accuracy} for p in strong],
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
        .limit(20).all()
    )
    return {
        "count":  len(items),
        "doubts": [{"question": h.question, "topic": h.topic, "date": h.created_at} for h in items],
    }


@app.get("/history/simulations/{user_id}", tags=["History"])
def get_simulation_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(models.SimulationHistory)
        .filter_by(user_id=user_id)
        .order_by(models.SimulationHistory.created_at.desc())
        .limit(20).all()
    )
    return {
        "count":       len(items),
        "simulations": [{"concept": h.concept, "gif_url": h.gif_url, "date": h.created_at} for h in items],
    }


@app.get("/history/notes/{user_id}", tags=["History"])
def get_notes_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(models.NotesHistory)
        .filter_by(user_id=user_id)
        .order_by(models.NotesHistory.created_at.desc())
        .limit(20).all()
    )
    return {
        "count": len(items),
        "notes": [{"topic": h.topic, "date": h.created_at} for h in items],
    }