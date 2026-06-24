/**
 * STEMBridge AI — Frontend  (v2.0)
 * Stack : React + recharts + lucide-react
 * Setup : npm create vite@latest stembridge -- --template react
 *         npm install recharts lucide-react
 *         Copy this file to src/App.jsx, then npm run dev
 *
 * Change API_BASE below to match your FastAPI server.
 */

import { useState, useEffect, createContext, useContext } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Home, Brain, Star, FlaskConical, BarChart2, History,
  LogOut, Menu, Send, CheckCircle, AlertCircle,
  MessageSquare, Lightbulb, BookOpen, FileText, Navigation,
  Target, Award, Clock,
} from "lucide-react";

/* ─── CONFIG ──────────────────────────────────────────────────────────────── */
const API_BASE = import.meta.env.VITE_API_URL;

// Fail loudly at boot-time in dev so misconfiguration is caught immediately.
// In production the Vercel environment variable must be set.
if (!API_BASE) {
  console.error(
    "[STEMBridge] VITE_API_URL is not set.\n" +
    "Create a .env file in the project root with:\n" +
    "  VITE_API_URL=https://your-backend.onrender.com\n" +
    "Then restart the dev server."
  );
}

/** Classify a fetch error and return a user-readable message. */
function friendlyError(err) {
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return "Unable to connect to the server. Please check your connection and try again.";
  }
  if (err.message === "Request failed") {
    return "The server returned an error. Please try again.";
  }
  return err.message || "Something went wrong. Please try again.";
}

/* ─── TRANSLATIONS ────────────────────────────────────────────────────────── */
const T = {
  en: {
    appName:"STEMBridge AI", tagline:"Your AI-powered STEM learning companion",
    nav_dash:"Dashboard", nav_tutor:"AI Tutor", nav_quiz:"Quiz Engine",
    nav_sim:"Simulation Lab", nav_analytics:"Analytics", nav_history:"History",
    logout:"Logout",
    login:"Log In", register:"Sign Up", email:"Email address",
    password:"Password", fullName:"Full Name", age:"Age",
    noAccount:"Don't have an account?", hasAccount:"Already have an account?",
    signupFree:"Sign up free →",
    tab_doubt:"Doubt Solver", tab_hint:"Hint Generator",
    tab_practice:"Practice", tab_notes:"Notes", tab_path:"Learning Path",
    askPH:"Ask any STEM question — Physics, Math, Chemistry, CS…",
    topicPH:"Enter a topic (e.g. Newton's Laws, Integration)…",
    generate:"Generate", loading:"Thinking…", copy:"Copy", clear:"Clear",
    quizTopic:"Quiz topic", genQuiz:"Generate Quiz",
    quizLoading:"Preparing your quiz…",
    selectAll:"Please answer every question before submitting.",
    submitQuiz:"Submit & See Score", yourScore:"Your Score",
    tryAgain:"Try Again", newQuiz:"New Quiz",
    conceptPH:"Enter a STEM concept to animate (e.g. Projectile Motion)…",
    genAnim:"Generate Animation",
    simLoading:"Generating animation — this takes ~30 s…",
    examples:"Try an example →",
    topicsStudied:"Topics Studied", avgAcc:"Avg. Accuracy",
    recentQuizzes:"Recent Quizzes",
    weakAreas:"Weak Areas", strongAreas:"Strong Areas", tip:"Study Tip",
    accChart:"Accuracy by Topic",
    noProgress:"Complete a quiz to unlock your analytics!",
    hist_d:"Doubts", hist_s:"Simulations", hist_n:"Notes",
    noHistory:"No history yet — start learning!",
    welcome:"Welcome back", quickActions:"Quick Actions",
    recentActivity:"Recent Activity", noActivity:"No recent activity.",
    correct:"Correct", explanation:"Explanation",
    stemOnly:"Only STEM & academic questions are accepted.",
    errMsg:"Something went wrong. Please try again.",
    viewGif:"View GIF →", answerReview:"Answer Review",
  },
  hi: {
    appName:"STEMBridge AI", tagline:"आपका AI-संचालित STEM शिक्षा सहायक",
    nav_dash:"डैशबोर्ड", nav_tutor:"AI शिक्षक", nav_quiz:"प्रश्नोत्तरी",
    nav_sim:"सिमुलेशन लैब", nav_analytics:"विश्लेषण", nav_history:"इतिहास",
    logout:"लॉग आउट",
    login:"लॉगिन", register:"पंजीकरण", email:"ईमेल पता",
    password:"पासवर्ड", fullName:"पूरा नाम", age:"आयु",
    noAccount:"खाता नहीं है?", hasAccount:"पहले से खाता है?",
    signupFree:"मुफ़्त में जुड़ें →",
    tab_doubt:"समस्या समाधान", tab_hint:"संकेत जनरेटर",
    tab_practice:"अभ्यास", tab_notes:"नोट्स", tab_path:"शिक्षा मार्ग",
    askPH:"कोई भी STEM प्रश्न पूछें — भौतिकी, गणित, रसायन, CS…",
    topicPH:"विषय दर्ज करें (जैसे: न्यूटन के नियम)…",
    generate:"बनाएं", loading:"सोच रहे हैं…", copy:"कॉपी", clear:"साफ़",
    quizTopic:"प्रश्नोत्तरी विषय", genQuiz:"प्रश्नोत्तरी बनाएं",
    quizLoading:"प्रश्नोत्तरी तैयार हो रही है…",
    selectAll:"जमा करने से पहले सभी प्रश्नों के उत्तर चुनें।",
    submitQuiz:"जमा करें और अंक देखें", yourScore:"आपका अंक",
    tryAgain:"पुनः प्रयास", newQuiz:"नई प्रश्नोत्तरी",
    conceptPH:"अवधारणा दर्ज करें (जैसे: प्रक्षेप्य गति)…",
    genAnim:"एनिमेशन बनाएं",
    simLoading:"एनिमेशन बन रहा है — ~30 सेकंड…",
    examples:"उदाहरण →",
    topicsStudied:"अध्ययन विषय", avgAcc:"औसत सटीकता",
    recentQuizzes:"हाल की प्रश्नोत्तरी",
    weakAreas:"कमजोर क्षेत्र", strongAreas:"मजबूत क्षेत्र", tip:"अध्ययन सुझाव",
    accChart:"विषय अनुसार सटीकता",
    noProgress:"विश्लेषण के लिए एक प्रश्नोत्तरी करें!",
    hist_d:"प्रश्न", hist_s:"सिमुलेशन", hist_n:"नोट्स",
    noHistory:"कोई इतिहास नहीं — अभी पढ़ना शुरू करें!",
    welcome:"वापसी का स्वागत है", quickActions:"त्वरित क्रियाएं",
    recentActivity:"हाल की गतिविधि", noActivity:"कोई हाल की गतिविधि नहीं।",
    correct:"सही", explanation:"स्पष्टीकरण",
    stemOnly:"केवल STEM और शैक्षणिक प्रश्न स्वीकार्य हैं।",
    errMsg:"कुछ गलत हुआ। कृपया पुनः प्रयास करें।",
    viewGif:"GIF देखें →", answerReview:"उत्तर समीक्षा",
  },
};

/* ─── LANGUAGE CONTEXT ────────────────────────────────────────────────────── */
const LangCtx = createContext({ t: k => k, lang: "en", setLang: () => {} });
const useLang = () => useContext(LangCtx);

/* ─── API HELPERS ─────────────────────────────────────────────────────────── */
const api = {
  post: async (path, body) => {
    let r;
    try {
      r = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // Credentials omitted intentionally — the backend issues user_id tokens
        // via the login response body; add credentials:"include" only if you
        // switch to cookie-based sessions.
      });
    } catch (netErr) {
      throw new Error(friendlyError(netErr));
    }
    if (!r.ok) {
      let detail = "Request failed";
      try { detail = (await r.json()).detail || detail; } catch {}
      throw new Error(detail);
    }
    return r.json();
  },
  get: async (path) => {
    let r;
    try {
      r = await fetch(`${API_BASE}${path}`);
    } catch (netErr) {
      throw new Error(friendlyError(netErr));
    }
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  },
};

/* ─── GLOBAL CSS ──────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100vh;background:#070F1C;color:#E5F2FC;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
:root{
  --bg0:#070F1C; --bg1:#0B1829; --sf1:#0F2035; --sf2:#142840; --sf3:#1A3455;
  --bd:#1C3D60;  --bds:#0D1F35; --bglow:rgba(79,142,247,.15);
  --blue:#4F8EF7; --blue2:#3A70D8;
  --teal:#0ED9B4; --green:#22C55E; --amber:#F59E0B; --red:#F4625A; --purple:#9E79F5;
  --t1:#E5F2FC; --t2:#8BB8D6; --t3:#4A7A9B; --t4:#2B5470;
  --fd:'Space Grotesk',sans-serif; --fb:'Inter',sans-serif;
  --r:12px; --rs:8px; --rl:18px;
}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--bg0)}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}

/* ── DOT GRID — scientific graph paper signature ── */
.dot{background-image:radial-gradient(circle,var(--bds) 1.3px,transparent 1.3px);background-size:28px 28px}

/* ── LAYOUT ── */
.shell{display:flex;min-height:100vh}
.sidebar{
  width:232px;min-height:100vh;background:var(--sf1);
  border-right:1px solid var(--bds);
  display:flex;flex-direction:column;
  position:fixed;left:0;top:0;bottom:0;z-index:100;
  transition:transform .22s ease;
}
.main{flex:1;margin-left:232px;min-height:100vh;display:flex;flex-direction:column}

/* ── SIDEBAR ── */
.s-logo{padding:20px 16px 18px;border-bottom:1px solid var(--bds);display:flex;align-items:center;gap:10px}
.s-icon{
  width:34px;height:34px;border-radius:9px;flex-shrink:0;
  background:linear-gradient(135deg,#4F8EF7,#9E79F5);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--fd);font-weight:700;font-size:15px;color:#fff;
}
.s-name{font-family:var(--fd);font-weight:700;font-size:14px;color:var(--t1)}
.s-tag{font-size:10px;color:var(--t4);margin-top:1px}
.nav{padding:10px 8px;flex:1;overflow-y:auto}
.nav-lbl{font-size:9.5px;font-weight:700;letter-spacing:.14em;color:var(--t4);text-transform:uppercase;padding:10px 8px 6px}
.ni{
  display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--rs);
  cursor:pointer;transition:all .13s;color:var(--t2);font-size:13px;font-weight:500;
  margin-bottom:2px;border:1px solid transparent;user-select:none;
}
.ni:hover{background:var(--sf2);color:var(--t1)}
.ni.act{background:var(--bglow);color:#4F8EF7;border-color:rgba(79,142,247,.22)}
.ni svg{width:15px;height:15px;flex-shrink:0}
.s-bot{padding:10px 8px;border-top:1px solid var(--bds)}
.u-chip{display:flex;align-items:center;gap:9px;padding:8px 10px;margin-bottom:6px}
.u-av{
  width:28px;height:28px;border-radius:50%;flex-shrink:0;
  background:linear-gradient(135deg,#4F8EF7,#0ED9B4);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:#fff;
}
.u-nm{font-size:12.5px;font-weight:500;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:145px}
.lrow{display:flex;background:var(--bg1);border-radius:var(--rs);padding:3px;gap:2px;border:1px solid var(--bds);margin-bottom:6px}
.lb{flex:1;padding:5px 4px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;background:transparent;color:var(--t3);font-family:var(--fb);transition:all .13s}
.lb.on{background:#4F8EF7;color:#fff}
.lo{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:var(--rs);border:none;cursor:pointer;background:transparent;color:var(--t3);font-size:12.5px;font-weight:500;font-family:var(--fb);transition:all .13s}
.lo:hover{background:rgba(244,98,90,.1);color:var(--red)}
.lo svg{width:13px;height:13px}

/* ── TOP BAR ── */
.topbar{padding:13px 24px;border-bottom:1px solid var(--bds);background:var(--sf1);display:flex;align-items:center;gap:12px;flex-shrink:0}
.tb-title{font-family:var(--fd);font-size:16px;font-weight:700;color:var(--t1)}
.mb{display:none;background:none;border:none;cursor:pointer;color:var(--t2);padding:2px}

/* ── CONTENT ── */
.content{flex:1;padding:24px;overflow-y:auto}
.content>div{max-width:860px}

/* ── CARDS ── */
.card{background:var(--sf1);border:1px solid var(--bds);border-radius:var(--r);padding:20px}
.card-p{padding:26px}
.glow{border-color:rgba(79,142,247,.26);box-shadow:0 0 0 1px rgba(79,142,247,.06),0 8px 32px rgba(0,0,0,.35)}

/* ── STAT GRID ── */
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:13px;margin-bottom:20px}
.sc{background:var(--sf1);border:1px solid var(--bds);border-radius:var(--r);padding:16px}
.si{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.sl{font-size:10.5px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
.sv{font-family:var(--fd);font-size:25px;font-weight:700;color:var(--t1);line-height:1}
.ssf{font-size:13px;color:var(--t3)}

/* ── FORMS ── */
textarea.inp,input.inp{
  width:100%;background:var(--bg1);border:1px solid var(--bd);border-radius:var(--rs);
  padding:10px 13px;color:var(--t1);font-family:var(--fb);font-size:13.5px;
  transition:border-color .15s,box-shadow .15s;resize:none;outline:none;
}
textarea.inp:focus,input.inp:focus{border-color:#4F8EF7;box-shadow:0 0 0 3px rgba(79,142,247,.15)}
textarea.inp::placeholder,input.inp::placeholder{color:var(--t4)}
.field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.field label{font-size:12px;font-weight:500;color:var(--t2)}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 18px;border-radius:var(--rs);border:none;font-family:var(--fb);font-size:13px;font-weight:600;cursor:pointer;transition:all .13s;white-space:nowrap}
.bp{background:#4F8EF7;color:#fff;box-shadow:0 3px 12px rgba(79,142,247,.25)}
.bp:hover:not(:disabled){background:#3A70D8;transform:translateY(-1px)}
.bp:disabled{opacity:.5;cursor:not-allowed;transform:none}
.bgh{background:transparent;color:var(--t2);border:1px solid var(--bd)}
.bgh:hover{background:var(--sf2);color:var(--t1)}
.bsm{padding:6px 12px;font-size:12px}
.bfw{width:100%}

/* ── TABS ── */
.tabs{display:flex;gap:3px;background:var(--bg1);border-radius:var(--rs);padding:3px;border:1px solid var(--bds);overflow-x:auto;margin-bottom:18px}
.tab{padding:7px 13px;border-radius:6px;border:none;cursor:pointer;font-family:var(--fb);font-size:12px;font-weight:600;background:transparent;color:var(--t3);transition:all .12s;white-space:nowrap}
.tab.on{background:#4F8EF7;color:#fff;box-shadow:0 2px 8px rgba(79,142,247,.3)}
.tab:hover:not(.on){background:var(--sf2);color:var(--t1)}

/* ── RESULT BOX ── */
.rb{
  background:var(--bg1);border:1px solid var(--bds);border-radius:var(--rs);
  padding:18px;margin-top:14px;font-size:13.5px;line-height:1.85;color:var(--t1);
  white-space:pre-wrap;font-family:var(--fb);min-height:60px;position:relative;
}

/* ── QUIZ ── */
.qo{
  padding:11px 15px;border-radius:var(--rs);border:1px solid var(--bd);
  margin-bottom:7px;cursor:pointer;transition:all .12s;
  display:flex;align-items:center;gap:11px;color:var(--t1);font-size:13.5px;
  background:var(--bg1);
}
.qo:hover{border-color:#4F8EF7;background:var(--bglow)}
.qo.sel{border-color:#4F8EF7;background:var(--bglow)}
.qo.cor{border-color:#22C55E;background:rgba(34,197,94,.1);color:#22C55E}
.qo.wrg{border-color:#F4625A;background:rgba(244,98,90,.1);color:#F4625A}
.qk{width:23px;height:23px;border-radius:5px;background:var(--sf2);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0}

/* ── SCORE RING ── */
.sring{width:92px;height:92px;border-radius:50%;border:4px solid var(--sf3);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--fd)}
.sring.ok{border-color:#22C55E;box-shadow:0 0 22px rgba(34,197,94,.2)}
.sring.no{border-color:#F4625A}
.srp{font-size:24px;font-weight:700;line-height:1}
.srl{font-size:10px;color:var(--t3);margin-top:2px}

/* ── EXPLANATION ── */
.exp{background:rgba(79,142,247,.07);border:1px solid rgba(79,142,247,.18);border-radius:var(--rs);padding:10px 13px;font-size:12.5px;color:var(--t2);line-height:1.7;margin-top:8px}

/* ── AUTH ── */
.auth-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{width:100%;max-width:390px;background:var(--sf1);border:1px solid var(--bds);border-radius:var(--rl);padding:32px;box-shadow:0 24px 64px rgba(0,0,0,.55)}

/* ── ALERTS ── */
.al{padding:10px 13px;border-radius:var(--rs);font-size:13px;display:flex;align-items:flex-start;gap:8px;margin-top:10px}
.ae{background:rgba(244,98,90,.1);border:1px solid rgba(244,98,90,.25);color:#F4625A}
.ai{background:rgba(79,142,247,.12);border:1px solid rgba(79,142,247,.25);color:#7AB4FF}
.al svg{width:13px;height:13px;flex-shrink:0;margin-top:2px}

/* ── SPINNER ── */
.sp{width:15px;height:15px;border:2px solid rgba(255,255,255,.18);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}
.bb{background:rgba(79,142,247,.13);color:#7AB4FF;border:1px solid rgba(79,142,247,.22)}
.bg{background:rgba(34,197,94,.1);color:#22C55E;border:1px solid rgba(34,197,94,.22)}
.br{background:rgba(244,98,90,.1);color:#F4625A;border:1px solid rgba(244,98,90,.22)}
.ba{background:rgba(245,158,11,.1);color:#F59E0B;border:1px solid rgba(245,158,11,.22)}

/* ── MISC ── */
.div{height:1px;background:var(--bds);margin:16px 0}
.st{font-family:var(--fd);font-size:17px;font-weight:700;color:var(--t1);margin-bottom:3px}
.ss{font-size:12.5px;color:var(--t3);margin-bottom:16px}
.row{display:flex;align-items:center}
.rbet{display:flex;align-items:center;justify-content:space-between}
.col{display:flex;flex-direction:column}
.gap2{gap:8px}.gap3{gap:12px}
.wf{width:100%}
.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}
.nls{font-size:10px;font-weight:700;letter-spacing:.13em;color:var(--t4);text-transform:uppercase;margin-bottom:8px}

/* ── BANNER ── */
.banner{
  background:linear-gradient(115deg,#0F2545 0%,#142D54 100%);
  border:1px solid var(--bd);border-radius:var(--rl);
  padding:22px 26px;margin-bottom:20px;position:relative;overflow:hidden;
}
.banner::after{content:'';position:absolute;right:-30px;top:-30px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(79,142,247,.1) 0%,transparent 70%)}
.bt{font-family:var(--fd);font-size:19px;font-weight:700;color:var(--t1);margin-bottom:3px}
.bsub{font-size:12.5px;color:var(--t2)}

/* ── QUICK ACTIONS ── */
.qag{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin-bottom:20px}
.qa{
  padding:14px 10px;border-radius:var(--r);cursor:pointer;
  border:1px solid var(--bds);background:var(--sf1);transition:all .13s;
  text-align:center;display:flex;flex-direction:column;align-items:center;gap:7px;user-select:none;
}
.qa:hover{border-color:#4F8EF7;background:var(--bglow);transform:translateY(-2px)}
.qa svg{width:18px;height:18px}
.qa-l{font-size:11.5px;font-weight:600;color:var(--t2)}

/* ── HISTORY ITEM ── */
.hi{padding:12px 14px;border-radius:var(--rs);margin-bottom:5px;background:var(--bg1);border:1px solid var(--bds)}
.hi-t{font-size:13px;font-weight:500;color:var(--t1);margin-bottom:3px}
.hi-m{font-size:11px;color:var(--t3);display:flex;align-items:center;gap:10px;flex-wrap:wrap}

/* ── TOPIC BAR ── */
.tbar{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:var(--rs);background:var(--bg1);border:1px solid var(--bds);margin-bottom:5px}
.tnm{font-size:13px;font-weight:500;color:var(--t1);flex:1}

/* ── GIF ── */
.gif-wrap{border-radius:var(--r);overflow:hidden;background:var(--bg1);border:1px solid var(--bds);display:flex;align-items:center;justify-content:center;min-height:160px;margin-top:14px}
.gif-wrap img{width:100%;max-width:580px;display:block}

/* ── EXAMPLE CHIPS ── */
.ex-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ex-chip{background:rgba(79,142,247,.12);color:#7AB4FF;border:1px solid rgba(79,142,247,.2);border-radius:20px;font-size:11.5px;padding:4px 11px;cursor:pointer;transition:all .12s}
.ex-chip:hover{background:rgba(79,142,247,.22)}

/* ── 2-COL GRID ── */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}

/* ── OVERLAY (mobile) ── */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:90;backdrop-filter:blur(2px)}

@media(max-width:768px){
  .main{margin-left:0!important}
  .mb{display:block!important}
  .sidebar{transform:translateX(-232px)}
  .sidebar.mo{transform:translateX(0)}
  .overlay.sh{display:block}
  .content{padding:14px}
  .topbar{padding:11px 14px}
  .grid2{grid-template-columns:1fr}
  .sg{grid-template-columns:repeat(2,1fr)}
}
`;

/* ─── REUSABLE TINY COMPONENTS ───────────────────────────────────────────── */
const Spin   = () => <div className="sp" />;
const ErrBox = ({ msg }) => msg ? <div className="al ae"><AlertCircle /><span>{msg}</span></div> : null;
const OkBox  = ({ msg }) => msg ? <div className="al ai"><CheckCircle /><span>{msg}</span></div> : null;

function CopyBtn({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn bgh bsm"
      style={{ position: "absolute", top: 8, right: 8 }}
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
    >
      {done ? "✓" : label}
    </button>
  );
}

/* ─── AUTH PAGE ───────────────────────────────────────────────────────────── */
function AuthPage({ onLogin }) {
  const { t, lang, setLang } = useLang();
  const [mode, setMode] = useState("login");
  const [f, setF]       = useState({ name:"", email:"", age:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr]   = useState("");

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "register") {
        if (!f.name || !f.email || !f.age || !f.password) throw new Error("Please fill all fields.");
        await api.post("/register", { name:f.name, email:f.email, age:parseInt(f.age), password:f.password });
        setMode("login"); setF(p => ({ ...p, name:"", age:"" }));
      } else {
        if (!f.email || !f.password) throw new Error("Please enter email and password.");
        const r = await api.post("/login", { email:f.email, password:f.password });
        onLogin({ id: r.user_id, name: r.name, email: f.email });
      }
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="auth-root dot">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:8 }}>
            <div className="s-icon" style={{ width:40, height:40, fontSize:16, borderRadius:12 }}>S</div>
            <span style={{ fontFamily:"var(--fd)", fontSize:21, fontWeight:700, color:"var(--t1)" }}>STEMBridge AI</span>
          </div>
          <p style={{ fontSize:12.5, color:"var(--t3)" }}>{t("tagline")}</p>
        </div>

        {/* Language toggle */}
        <div className="lrow" style={{ marginBottom:20 }}>
          <button className={`lb ${lang==="en"?"on":""}`} onClick={() => setLang("en")}>English</button>
          <button className={`lb ${lang==="hi"?"on":""}`} onClick={() => setLang("hi")}>हिंदी</button>
        </div>

        {/* Register-only fields */}
        {mode === "register" && <>
          <div className="field">
            <label>{t("fullName")}</label>
            <input className="inp" value={f.name} onChange={set("name")} placeholder="Arjun Sharma"
              onKeyDown={e => e.key==="Enter" && submit()} />
          </div>
          <div className="field">
            <label>{t("age")}</label>
            <input className="inp" type="number" value={f.age} onChange={set("age")} placeholder="18"
              min="10" max="99" onKeyDown={e => e.key==="Enter" && submit()} />
          </div>
        </>}

        <div className="field">
          <label>{t("email")}</label>
          <input className="inp" type="email" value={f.email} onChange={set("email")} placeholder="you@email.com"
            onKeyDown={e => e.key==="Enter" && submit()} />
        </div>
        <div className="field">
          <label>{t("password")}</label>
          <input className="inp" type="password" value={f.password} onChange={set("password")} placeholder="••••••••"
            onKeyDown={e => e.key==="Enter" && submit()} />
        </div>

        <ErrBox msg={err} />

        <button className="btn bp bfw mt3" onClick={submit} disabled={loading}>
          {loading ? <><Spin />{t(mode==="login"?"login":"register")}</> : t(mode==="login"?"login":"register")}
        </button>

        <p style={{ textAlign:"center", fontSize:12.5, color:"var(--t3)", marginTop:14 }}>
          {mode==="login" ? t("noAccount") : t("hasAccount")}{" "}
          <span style={{ color:"#4F8EF7", cursor:"pointer", fontWeight:600 }}
            onClick={() => { setMode(mode==="login"?"register":"login"); setErr(""); }}>
            {mode==="login" ? t("signupFree") : t("login")}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ─── SIDEBAR ─────────────────────────────────────────────────────────────── */
function Sidebar({ page, setPage, user, lang, setLang, onLogout, mob, setMob }) {
  const { t } = useLang();
  const NAV = [
    { id:"dash",      icon:Home,        label:t("nav_dash")      },
    { id:"tutor",     icon:Brain,       label:t("nav_tutor")     },
    { id:"quiz",      icon:Star,        label:t("nav_quiz")      },
    { id:"sim",       icon:FlaskConical, label:t("nav_sim")      },
    { id:"analytics", icon:BarChart2,   label:t("nav_analytics") },
    { id:"history",   icon:History,     label:t("nav_history")   },
  ];
  const go = id => { setPage(id); setMob(false); };

  return (
    <>
      <div className={`overlay ${mob?"sh":""}`} onClick={() => setMob(false)} />
      <div className={`sidebar ${mob?"mo":""}`}>
        <div className="s-logo">
          <div className="s-icon">S</div>
          <div><div className="s-name">STEMBridge</div><div className="s-tag">AI Platform</div></div>
        </div>

        <div className="nav">
          <div className="nav-lbl">Navigation</div>
          {NAV.map(({ id, icon:Icon, label }) => (
            <div key={id} className={`ni ${page===id?"act":""}`} onClick={() => go(id)}>
              <Icon />{label}
            </div>
          ))}
        </div>

        <div className="s-bot">
          <div className="u-chip">
            <div className="u-av">{(user.name||"U")[0].toUpperCase()}</div>
            <div className="u-nm">{user.name}</div>
          </div>
          <div className="lrow">
            <button className={`lb ${lang==="en"?"on":""}`} onClick={() => setLang("en")}>English</button>
            <button className={`lb ${lang==="hi"?"on":""}`} onClick={() => setLang("hi")}>हिंदी</button>
          </div>
          <button className="lo" onClick={onLogout}><LogOut />{t("logout")}</button>
        </div>
      </div>
    </>
  );
}

/* ─── TOP BAR ─────────────────────────────────────────────────────────────── */
function TopBar({ page, onMenu }) {
  const { t } = useLang();
  const labels = {
    dash:t("nav_dash"), tutor:t("nav_tutor"), quiz:t("nav_quiz"),
    sim:t("nav_sim"), analytics:t("nav_analytics"), history:t("nav_history"),
  };
  return (
    <div className="topbar">
      <button className="mb" onClick={onMenu}><Menu size={20} /></button>
      <span className="tb-title">{labels[page] || "STEMBridge AI"}</span>
    </div>
  );
}

/* ─── DASHBOARD ───────────────────────────────────────────────────────────── */
function DashPage({ user, setPage }) {
  const { t } = useLang();
  const [prog, setProg] = useState(null);
  const [hist, setHist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get(`/progress/${user.id}`), api.get(`/history/doubts/${user.id}`)])
      .then(([p, h]) => { setProg(p); setHist(h.doubts || []); })
      .catch(e => setErr(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [user.id]);

  const STATS = prog ? [
    { lbl:t("topicsStudied"), val:prog.topics_studied||0, sfx:"",  col:"#4F8EF7", bg:"rgba(79,142,247,.12)",  icon:BookOpen },
    { lbl:t("avgAcc"),        val:prog.average_accuracy||0, sfx:"%", col:"#22C55E", bg:"rgba(34,197,94,.12)",   icon:Target  },
    { lbl:t("recentQuizzes"), val:(prog.recent_quizzes||[]).length, sfx:"", col:"#9E79F5", bg:"rgba(158,121,245,.12)", icon:Award  },
    { lbl:t("hist_d"),        val:hist.length, sfx:"",             col:"#F59E0B", bg:"rgba(245,158,11,.12)",   icon:Clock   },
  ] : [];

  const QA = [
    { label:t("tab_doubt"), icon:MessageSquare, color:"#4F8EF7", p:"tutor" },
    { label:t("tab_hint"),  icon:Lightbulb,     color:"#F59E0B", p:"tutor" },
    { label:t("nav_quiz"),  icon:Star,          color:"#9E79F5", p:"quiz"  },
    { label:t("nav_sim"),   icon:FlaskConical,  color:"#0ED9B4", p:"sim"   },
  ];

  return (
    <div>
      <div className="banner">
        <div className="bt">{t("welcome")}, {user.name} 👋</div>
        <div className="bsub">{t("tagline")}</div>
      </div>

      {loading && (
        <div style={{ display:"flex", justifyContent:"center", marginTop:28 }}><Spin /></div>
      )}

      {err && <ErrBox msg={err} />}

      {!loading && !err && STATS.length > 0 && (
        <div className="sg">
          {STATS.map(({ lbl, val, sfx, col, bg, icon:Icon }) => (
            <div key={lbl} className="sc">
              <div className="si" style={{ background:bg }}><Icon size={14} color={col} /></div>
              <div className="sl">{lbl}</div>
              <div className="sv">{val}<span className="ssf">{sfx}</span></div>
            </div>
          ))}
        </div>
      )}

      {!loading && !err && <>
      <div className="nls">{t("quickActions")}</div>
      <div className="qag">
        {QA.map(({ label, icon:Icon, color, p }) => (
          <div key={label} className="qa" onClick={() => setPage(p)}>
            <Icon size={18} color={color} />
            <div className="qa-l">{label}</div>
          </div>
        ))}
      </div>

      <div className="nls">{t("recentActivity")}</div>
      {hist.length === 0
        ? <div className="card" style={{ textAlign:"center", color:"var(--t3)", fontSize:13, padding:28 }}>{t("noActivity")}</div>
        : hist.slice(0, 5).map((h, i) => (
          <div key={i} className="hi">
            <div className="hi-t">{h.question}</div>
            <div className="hi-m">
              <span className="badge bb">{h.topic}</span>
              <span>{new Date(h.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))
      }
      </>}
    </div>
  );
}

/* ─── AI TUTOR ────────────────────────────────────────────────────────────── */
function TutorPage({ user }) {
  const { t, lang } = useLang();
  const [tab,   setTab]   = useState("doubt");
  const [input, setInput] = useState("");
  const [result,setResult]= useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const TABS = [
    { id:"doubt",    ep:"/doubt",              icon:MessageSquare, label:t("tab_doubt")    },
    { id:"hint",     ep:"/hint",               icon:Lightbulb,     label:t("tab_hint")     },
    { id:"practice", ep:"/practice_questions", icon:Target,        label:t("tab_practice") },
    { id:"notes",    ep:"/notes",              icon:FileText,      label:t("tab_notes")    },
    { id:"path",     ep:"/learning_path",      icon:Navigation,    label:t("tab_path")     },
  ];

  const go = async () => {
    if (!input.trim()) return;
    setResult(""); setErr(""); setLoading(true);
    try {
      const { ep } = TABS.find(tb => tb.id === tab);
      const r = await api.post(ep, { text:input, language:lang, user_id:user.id, topic:input.slice(0,60) });
      setResult(r.result);
    } catch(e) { setErr(friendlyError(e)); }
    setLoading(false);
  };

  const switchTab = id => { setTab(id); setResult(""); setErr(""); };

  return (
    <div>
      <div className="st">{t("nav_tutor")}</div>
      <div className="ss">Ask questions, get hints, generate structured notes and learning paths.</div>

      <div className="tabs">
        {TABS.map(({ id, label }) => (
          <button key={id} className={`tab ${tab===id?"on":""}`} onClick={() => switchTab(id)}>{label}</button>
        ))}
      </div>

      <div className="card card-p">
        <textarea
          className="inp" rows={4} value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={tab==="doubt" ? t("askPH") : t("topicPH")}
          onKeyDown={e => e.ctrlKey && e.key==="Enter" && go()}
        />
        <p style={{ fontSize:11, color:"var(--t4)", marginTop:5 }}>Ctrl + Enter to generate</p>

        <div className="row mt3" style={{ justifyContent:"flex-end", gap:8 }}>
          {result && <button className="btn bgh bsm" onClick={() => { setResult(""); setErr(""); }}>{t("clear")}</button>}
          <button className="btn bp" onClick={go} disabled={loading || !input.trim()}>
            {loading ? <><Spin />{t("loading")}</> : <><Send size={13} />{t("generate")}</>}
          </button>
        </div>

        <ErrBox msg={err} />

        {result && (
          <div className="rb">
            <CopyBtn text={result} label={t("copy")} />
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── QUIZ ENGINE ─────────────────────────────────────────────────────────── */
function QuizPage({ user }) {
  const { t, lang } = useLang();
  const [topic,     setTopic]     = useState("");
  const [quiz,      setQuiz]      = useState(null);
  const [answers,   setAnswers]   = useState({});   // { qId: optionKey }
  const [submitted, setSubmitted] = useState(false);
  const [score,     setScore]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  const [warn,      setWarn]      = useState("");
  const [startMs,   setStartMs]   = useState(null);

  /* Generate quiz */
  const generate = async () => {
    if (!topic.trim()) return;
    setErr(""); setLoading(true);
    setQuiz(null); setAnswers({}); setSubmitted(false); setScore(null);
    try {
      const r = await api.post("/quiz/generate", { text:topic, language:lang, user_id:user.id });
      setQuiz(r); setStartMs(Date.now());
    } catch(e) { setErr(friendlyError(e)); }
    setLoading(false);
  };

/* Submit answers */
const submit = async () => {
  if (!quiz) return;

  if (quiz.questions.some(q => !answers[q.id])) {
    setWarn(t("selectAll"));
    return;
  }

  setWarn("");
  setSaving(true);

  const correct = quiz.questions.filter(
    q => answers[q.id] === q.correct
  ).length;

  const total = quiz.questions.length;

  setScore({
    correct,
    total,
    pct: Math.round((correct / total) * 100),
  });

  setSubmitted(true);

  try {
    await api.post("/quiz/submit", {
      user_id: user.id,
      topic,
      correct_answers: correct,
      total_questions: total,
      time_taken: Math.round((Date.now() - startMs) / 1000),
    });
  } catch {
    /* Score is already shown to the user; analytics save failure is non-fatal. */
  }

  setSaving(false);
};
  const reset = () => {
    setQuiz(null); setAnswers({}); setSubmitted(false);
    setScore(null); setTopic(""); setErr(""); setWarn("");
  };

  /* ── Topic input screen ── */
  if (!quiz) return (
    <div>
      <div className="st">{t("nav_quiz")}</div>
      <div className="ss">Generate a 5-question adaptive quiz on any STEM topic.</div>
      <div className="card card-p">
        <div className="field">
          <label>{t("quizTopic")}</label>
          <input className="inp" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder={t("topicPH")} onKeyDown={e => e.key==="Enter" && generate()} />
        </div>
        <ErrBox msg={err} />
        <button className="btn bp bfw mt2" onClick={generate} disabled={loading || !topic.trim()}>
          {loading ? <><Spin />{t("quizLoading")}</> : <><Star size={13} />{t("genQuiz")}</>}
        </button>
      </div>
    </div>
  );

  /* ── Results screen ── */
  if (submitted && score) return (
    <div>
      <div className="st">{t("nav_quiz")}</div>
      <div className="ss">{quiz.topic}</div>
      <div className="card card-p">
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <div className={`sring ${score.pct>=70?"ok":"no"}`} style={{ margin:"0 auto 12px" }}>
            <div className="srp" style={{ color:score.pct>=70?"#22C55E":"#F4625A" }}>{score.pct}%</div>
            <div className="srl">{t("yourScore")}</div>
          </div>
          <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:700, color:"var(--t1)", marginBottom:4 }}>
            {score.correct}/{score.total} {t("correct")}
          </div>
          <div style={{ fontSize:13, color:"var(--t3)" }}>
            {score.pct >= 70 ? "🎉 Great job! Keep it up." : "📖 Keep practicing — review the explanations below."}
          </div>
        </div>

        <div className="div" />
        <div style={{ fontFamily:"var(--fd)", fontWeight:600, fontSize:13.5, color:"var(--t1)", marginBottom:14 }}>
          {t("answerReview")}
        </div>

        {quiz.questions.map((q, qi) => {
          const ua = answers[q.id]; const ok = ua === q.correct;
          return (
            <div key={q.id} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13.5, fontWeight:500, color:"var(--t1)", marginBottom:8 }}>
                Q{qi+1}. {q.question}
              </div>
              {Object.entries(q.options).map(([k, v]) => (
                <div key={k} className={`qo ${k===q.correct?"cor":k===ua&&!ok?"wrg":""}`} style={{ cursor:"default" }}>
                  <div className="qk">{k}</div><span>{v}</span>
                  {k===q.correct && <CheckCircle size={13} style={{ marginLeft:"auto", flexShrink:0 }} />}
                </div>
              ))}
              {q.explanation && <div className="exp">💡 {q.explanation}</div>}
              {qi < quiz.questions.length-1 && <div className="div" />}
            </div>
          );
        })}

        <div className="row gap3 mt3">
          <button className="btn bgh" onClick={reset}>{t("tryAgain")}</button>
          <button className="btn bp" onClick={() => { setQuiz(null); setTopic(""); setAnswers({}); setSubmitted(false); setScore(null); }}>
            {t("newQuiz")} →
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Quiz taking screen ── */
  const answered = Object.keys(answers).length;
  const pct = (answered / quiz.questions.length) * 100;

  return (
    <div>
      <div className="st">{t("nav_quiz")}</div>
      <div className="ss">{quiz.topic}</div>
      <div className="card card-p">
        <div className="rbet" style={{ marginBottom:10 }}>
          <span className="badge bb">{answered}/{quiz.questions.length} answered</span>
          <button className="btn bgh bsm" onClick={reset}>← Back</button>
        </div>
        <div style={{ height:4, background:"var(--sf3)", borderRadius:2, marginBottom:18, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"#4F8EF7", borderRadius:2, transition:"width .3s" }} />
        </div>

        {quiz.questions.map((q, qi) => (
          <div key={q.id} style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--t3)", marginBottom:4 }}>
              Q{qi+1} &nbsp;
              {answers[q.id] && <span style={{ color:"#22C55E", fontSize:11 }}>✓ answered</span>}
            </div>
            <div style={{ fontSize:14, fontWeight:500, color:"var(--t1)", marginBottom:10 }}>{q.question}</div>
            {Object.entries(q.options).map(([k, v]) => (
              <div key={k} className={`qo ${answers[q.id]===k?"sel":""}`}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: k }))}>
                <div className="qk">{k}</div><span>{v}</span>
              </div>
            ))}
            {qi < quiz.questions.length-1 && <div className="div" />}
          </div>
        ))}

        {warn && <div className="al ae"><AlertCircle /><span>{warn}</span></div>}
        <button className="btn bp bfw mt3" onClick={submit} disabled={saving}>
          {saving ? <><Spin />{t("submitQuiz")}</> : t("submitQuiz")}
        </button>
      </div>
    </div>
  );
}

/* ─── SIMULATION LAB ──────────────────────────────────────────────────────── */
function SimPage({ user }) {
  const { t, lang } = useLang();
  const [concept, setConcept] = useState("");
  const [gif,     setGif]     = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const EXAMPLES = [
    "Projectile Motion", "Simple Harmonic Motion", "Wave Interference",
    "Electric Field Lines", "Magnetic Field", "Newton's Cradle",
  ];

  const generate = async () => {
    if (!concept.trim()) return;
    setErr(""); setGif(""); setLoading(true);
    try {
      const r = await api.post("/simulate", { text:concept, language:lang, user_id:user.id });
      setGif(`${API_BASE}${r.gif_url}`);
    } catch(e) { setErr(friendlyError(e)); }
    setLoading(false);
  };

  return (
    <div>
      <div className="st">{t("nav_sim")}</div>
      <div className="ss">Watch any STEM concept come to life as a custom matplotlib animation.</div>
      <div className="card card-p">
        <div className="field">
          <label>{t("conceptPH")}</label>
          <input className="inp" value={concept} onChange={e => setConcept(e.target.value)}
            placeholder={t("conceptPH")} onKeyDown={e => e.key==="Enter" && generate()} />
        </div>

        <div style={{ fontSize:11, color:"var(--t3)", marginBottom:6 }}>{t("examples")}</div>
        <div className="ex-chips">
          {EXAMPLES.map(ex => (
            <span key={ex} className="ex-chip" onClick={() => setConcept(ex)}>{ex}</span>
          ))}
        </div>

        <ErrBox msg={err} />

        <button className="btn bp bfw" onClick={generate} disabled={loading || !concept.trim()}>
          {loading
            ? <><Spin />{t("simLoading")}</>
            : <><FlaskConical size={14} />{t("genAnim")}</>}
        </button>

        {loading && (
          <div className="card mt3" style={{ textAlign:"center", padding:28 }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}><Spin /></div>
            <div style={{ fontSize:13, color:"var(--t3)" }}>
              Generating your STEM animation...<br />
              <span style={{ fontSize:11, color:"var(--t4)" }}>This calls Gemini to write & run matplotlib code — it takes ~20-40 seconds.</span>
            </div>
          </div>
        )}

        {gif && (
          <>
            <OkBox msg="Animation ready ↓" />
            <div className="gif-wrap"><img src={gif} alt={concept} /></div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── ANALYTICS ───────────────────────────────────────────────────────────── */
function AnalyticsPage({ user }) {
  const { t } = useLang();
  const [prog, setProg] = useState(null);
  const [weak, setWeak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.get(`/progress/${user.id}`), api.get(`/weakness/${user.id}`)])
      .then(([p, w]) => { setProg(p); setWeak(w); })
      .catch(e => setErr(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [user.id]);

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", marginTop:48 }}><Spin /></div>
  );

  if (err) return (
    <div>
      <div className="st">{t("nav_analytics")}</div>
      <div className="ss">Track performance, spot patterns, and focus your study time.</div>
      <ErrBox msg={err} />
    </div>
  );

  if (!prog?.progress?.length) return (
    <div>
      <div className="st">{t("nav_analytics")}</div>
      <div className="ss">Track performance, spot patterns, and focus your study time.</div>
      <div className="card" style={{ textAlign:"center", padding:48 }}>
        <BarChart2 size={40} style={{ margin:"0 auto 12px", opacity:.18 }} />
        <div style={{ fontSize:14, color:"var(--t3)" }}>{t("noProgress")}</div>
      </div>
    </div>
  );

  const chartData = (prog.progress || []).slice(0, 8).map(p => ({
    name: p.topic.length > 12 ? p.topic.slice(0, 12) + "…" : p.topic,
    accuracy: p.accuracy,
  }));

  return (
    <div>
      <div className="st">{t("nav_analytics")}</div>
      <div className="ss">Track performance, spot patterns, and focus your study time.</div>

      <div className="sg">
        {[
          { lbl:t("topicsStudied"), val:prog.topics_studied||0, sfx:"",  col:"#4F8EF7", bg:"rgba(79,142,247,.12)",  icon:BookOpen },
          { lbl:t("avgAcc"),        val:prog.average_accuracy||0, sfx:"%", col:"#22C55E", bg:"rgba(34,197,94,.12)",   icon:Target  },
        ].map(({ lbl, val, sfx, col, bg, icon:Icon }) => (
          <div key={lbl} className="sc">
            <div className="si" style={{ background:bg }}><Icon size={14} color={col} /></div>
            <div className="sl">{lbl}</div>
            <div className="sv">{val}<span className="ssf">{sfx}</span></div>
          </div>
        ))}
      </div>

      {/* Accuracy chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:"var(--t2)", marginBottom:14 }}>{t("accChart")}</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} margin={{ top:0, right:0, left:-22, bottom:0 }}>
              <XAxis dataKey="name" tick={{ fill:"#4A7A9B", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fill:"#4A7A9B", fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:"#142840", border:"1px solid #1C3D60", borderRadius:8, color:"#E5F2FC", fontSize:12 }} />
              <Bar dataKey="accuracy" radius={[4,4,0,0]}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.accuracy>=80?"#22C55E":e.accuracy>=60?"#4F8EF7":"#F4625A"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weak / Strong split */}
      <div className="grid2">
        <div className="card">
          <div style={{ fontSize:12.5, fontWeight:700, color:"#F4625A", marginBottom:10 }}>⚠ {t("weakAreas")}</div>
          {(weak?.weak_areas||[]).length === 0
            ? <div style={{ fontSize:12.5, color:"var(--t3)" }}>No weak areas — great work!</div>
            : (weak.weak_areas||[]).map((w,i) => (
              <div key={i} className="tbar">
                <div className="tnm">{w.topic}</div>
                <span className="badge br">{w.accuracy}%</span>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div style={{ fontSize:12.5, fontWeight:700, color:"#22C55E", marginBottom:10 }}>✓ {t("strongAreas")}</div>
          {(weak?.strong_areas||[]).length === 0
            ? <div style={{ fontSize:12.5, color:"var(--t3)" }}>Keep quizzing to unlock!</div>
            : (weak.strong_areas||[]).map((s,i) => (
              <div key={i} className="tbar">
                <div className="tnm">{s.topic}</div>
                <span className="badge bg">{s.accuracy}%</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Recommendation */}
      {weak?.recommendation && (
        <div className="card mt3">
          <div style={{ fontSize:11.5, fontWeight:700, color:"#F59E0B", marginBottom:5 }}>💡 {t("tip")}</div>
          <div style={{ fontSize:13.5, color:"var(--t1)" }}>{weak.recommendation}</div>
        </div>
      )}

      {/* Recent quizzes */}
      {(prog.recent_quizzes||[]).length > 0 && (
        <div className="card mt3">
          <div style={{ fontSize:12.5, fontWeight:600, color:"var(--t2)", marginBottom:12 }}>{t("recentQuizzes")}</div>
          {prog.recent_quizzes.map((q,i) => (
            <div key={i} className="hi">
              <div className="rbet">
                <div className="hi-t">{q.topic}</div>
                <span className={`badge ${q.score>=70?"bg":"br"}`}>{q.score}%</span>
              </div>
              <div className="hi-m mt2">
                <span>{q.correct}/{q.total} {t("correct")}</span>
                <span>{new Date(q.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── HISTORY ─────────────────────────────────────────────────────────────── */
function HistoryPage({ user }) {
  const { t } = useLang();
  const [tab,  setTab]  = useState("d");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async (type) => {
    setLoading(true); setErr("");
    try {
      const eps = {
        d: `/history/doubts/${user.id}`,
        s: `/history/simulations/${user.id}`,
        n: `/history/notes/${user.id}`,
      };
      const r = await api.get(eps[type]);
      setData(prev => ({ ...prev, [type]: r }));
    } catch(e) { setErr(friendlyError(e)); }
    setLoading(false);
  };

  useEffect(() => { load(tab); }, [tab]);

  const TABS = [
    { id:"d", label:t("hist_d") },
    { id:"s", label:t("hist_s") },
    { id:"n", label:t("hist_n") },
  ];

  const items = tab==="d" ? data.d?.doubts : tab==="s" ? data.s?.simulations : data.n?.notes;

  return (
    <div>
      <div className="st">{t("nav_history")}</div>
      <div className="ss">Review your past questions, simulations, and generated notes.</div>
      <div className="tabs">
        {TABS.map(tb => (
          <button key={tb.id} className={`tab ${tab===tb.id?"on":""}`} onClick={() => setTab(tb.id)}>{tb.label}</button>
        ))}
      </div>
      {loading
        ? <div style={{ display:"flex", justifyContent:"center", marginTop:28 }}><Spin /></div>
        : err
        ? <ErrBox msg={err} />
        : !items?.length
        ? <div className="card" style={{ textAlign:"center", padding:40, color:"var(--t3)", fontSize:13 }}>{t("noHistory")}</div>
        : items.map((item, i) => (
          <div key={i} className="hi">
            <div className="hi-t">
              {tab==="d" ? item.question : tab==="s" ? item.concept : item.topic}
            </div>
            <div className="hi-m">
              {tab==="d" && <span className="badge bb">{item.topic}</span>}
              {tab==="s" && item.gif_url && (
                <a href={`${API_BASE}${item.gif_url}`} target="_blank" rel="noreferrer"
                  style={{ color:"#4F8EF7", fontSize:11 }}>{t("viewGif")}</a>
              )}
              <span>{new Date(item.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── APP ROOT ────────────────────────────────────────────────────────────── */
export default function App() {
  const [user,  setUser]  = useState(null);
  const [page,  setPage]  = useState("dash");
  const [lang,  setLang]  = useState("en");
  const [mob,   setMob]   = useState(false);

  /* Translation helper — supports string and function values */
  const t = (key, ...args) => {
    const v = T[lang]?.[key] ?? T.en?.[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  };

  /* Auth screen */
  if (!user) return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{CSS}</style>
      <AuthPage onLogin={setUser} />
    </LangCtx.Provider>
  );

  const PAGES = {
    dash:      <DashPage      user={user} setPage={setPage} />,
    tutor:     <TutorPage     user={user} />,
    quiz:      <QuizPage      user={user} />,
    sim:       <SimPage       user={user} />,
    analytics: <AnalyticsPage user={user} />,
    history:   <HistoryPage   user={user} />,
  };

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <style>{CSS}</style>
      <div className="shell dot">
        <Sidebar
          page={page} setPage={setPage} user={user}
          lang={lang} setLang={setLang}
          onLogout={() => { setUser(null); setPage("dash"); }}
          mob={mob} setMob={setMob}
        />
        <div className="main">
          <TopBar page={page} onMenu={() => setMob(m => !m)} />
          <div className="content">
            {PAGES[page]}
          </div>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
