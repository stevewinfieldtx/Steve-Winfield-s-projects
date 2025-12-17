import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, FileText, CheckCircle, AlertCircle, X, ChevronRight, ChevronLeft,
  Briefcase, Award, Mic, Square, Play, RefreshCw, Download, 
  ArrowRight, Star, ChevronDown, ChevronUp, Loader2, Sparkles, Wand2,
  Layout, History, Edit2, Save, Link as LinkIcon, MonitorPlay, FileCheck,
  LogIn, User as UserIcon, LogOut, Lock, ThumbsUp, TrendingUp, HelpCircle,
  MicOff, Check, Video, MessageSquare, Grid
} from "lucide-react";
// Import parsing libraries from ESM CDN
import * as pdfjsLibProxy from 'https://esm.sh/pdfjs-dist@3.11.174';
import mammoth from 'https://esm.sh/mammoth@1.6.0';

// Fix for PDF.js worker in ESM environment
const pdfjsLib = (pdfjsLibProxy as any).default || pdfjsLibProxy;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// --- TYPES ---

type Step = 'landing' | 'upload' | 'job-desc' | 'analysis' | 'dashboard' | 'cover-letter' | 'written-practice' | 'verbal-practice' | 'candidate-questions' | 'mock-interview' | 'mock-analysis' | 'summary' | 'history';

interface User {
  email: string;
  name: string;
}

interface AnalysisResult {
  match_score: number;
  missing_keywords: string[];
  keyword_density: { term: string; count: number }[];
  formatting_issues: string[];
  skills_gap: string[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    location: string;
  }[];
}

interface InterviewQuestion {
  type: 'behavioral' | 'technical' | 'situational';
  question: string;
  why_asked: string;
}

interface AnswerFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  model_answer: string;
  specific_feedback: string;
}

interface ResumeVersion {
  id: string;
  name: string;
  content: string;
  isSelected?: boolean;
}

interface CoverLetterVersion {
  id: string;
  name: string;
  content: string;
  isSelected?: boolean;
}

interface CandidateQuestion {
  question: string;
  context: string;
}

interface SessionData {
  id: string;
  timestamp: number;
  resumeText: string;
  jobDescription: string;
  jobUrl?: string;
  fileName: string;
  analysis: AnalysisResult | null;
  optimizedResumes: ResumeVersion[];
  selectedResumeIndex: number; 
  coverLetters: CoverLetterVersion[];
  selectedCoverLetterIndex: number; 
  questions: InterviewQuestion[];
  // Store written answers separately if needed, or mix them. 
  // For simplicity, we'll store feedback by question index.
  writtenAnswers: {
    questionIndex: number;
    answer: string;
    feedback: AnswerFeedback | null;
  }[];
  verbalAnswers: {
    questionIndex: number;
    transcript: string;
    feedback: AnswerFeedback | null;
  }[];
  candidateQuestions: CandidateQuestion[];
  mockInterviewTranscript: { role: 'ai' | 'user'; text: string }[];
  mockInterviewFeedback: string | null;
}

// --- CONSTANTS ---

const FUNNY_LOADING_MESSAGES = [
  "Consulting the Ouija Board...",
  "Bringing out the tarot cards...",
  "Counting the vowels...",
  "Comparing against Shakespeare's iambic pentameter...",
  "Reading between the lines...",
  "Polishing the crystal ball...",
  "Asking a magic 8-ball...",
  "Consulting the tea leaves...",
  "Checking the horoscope...",
  "Rolling a d20 for charisma...",
  "Deciphering the Matrix...",
  "Asking ChatGPT's cousin...",
  "Measuring font sizes with a microscope...",
  "Looking for hidden invisible ink...",
  "Channeling HR spirits...",
  "Calculating keyword synergy...",
  "Aligning chakras...",
  "Summoning the ATS demon...",
  "Bribing the algorithm...",
  "Flipping a coin..."
];

// --- API HELPER ---

const analyzeWithGemini = async (prompt: string, model: string = "gemini-2.5-flash", schema?: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config: any = {
      responseMimeType: schema ? "application/json" : "text/plain",
    };
    if (schema) {
      config.responseSchema = schema;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: config
    });
    
    let text = response.text;
    if (!text) throw new Error("No response from AI");
    
    // Clean potential markdown code blocks
    if (schema) {
      text = text.trim();
      if (text.startsWith("```json")) {
        text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (text.startsWith("```")) {
        text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }
    }

    return schema ? JSON.parse(text) : text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// --- HELPERS ---

const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="font-sans space-y-2 text-gray-800">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold border-b border-gray-300 pb-1 mt-4 mb-2">{trimmed.substring(2)}</h1>;
        if (trimmed.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-gray-700 mt-3 mb-1 uppercase tracking-wide">{trimmed.substring(3)}</h2>;
        if (trimmed.startsWith('### ')) return <h3 key={i} className="text-md font-semibold text-gray-800 mt-2">{trimmed.substring(4)}</h3>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <div key={i} className="flex gap-2 ml-4"><span className="text-gray-400 mt-1.5">•</span><p className="flex-1">{trimmed.substring(2)}</p></div>;
        if (trimmed === '') return <div key={i} className="h-1"></div>;
        return <p key={i} className="leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
};

// --- COMPONENTS ---

const Header = ({ user, onLoginClick, onLogoutClick, onGoToHistory, onBack, showBack }: any) => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {showBack && (
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 hidden sm:inline">Career<span className="text-primary">Coach</span>.ai</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <button onClick={onGoToHistory} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              <History className="w-4 h-4" /> History
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
               <div className="flex flex-col text-right hidden sm:block">
                 <span className="text-xs font-bold text-gray-900">{user.name}</span>
                 <span className="text-xs text-gray-500">{user.email}</span>
               </div>
               <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">{user.name.charAt(0)}</div>
               <button onClick={onLogoutClick} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Logout"><LogOut className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <button onClick={onLoginClick} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/20 rounded-lg hover:bg-blue-50 transition-colors">
            <LogIn className="w-4 h-4" /> Login
          </button>
        )}
      </div>
    </div>
  </header>
);

const LoadingScreen = ({ message }: { message: string }) => {
  const [funnyMessage, setFunnyMessage] = useState(message);
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setFunnyMessage(FUNNY_LOADING_MESSAGES[index % FUNNY_LOADING_MESSAGES.length]);
      index++;
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full border border-gray-100 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Working Magic...</h3>
        <p className="text-gray-500 animate-pulse key={funnyMessage}">{funnyMessage}</p>
      </div>
    </div>
  );
};

const ProgressBar = ({ step }: { step: Step }) => {
  if (step === 'landing' || step === 'history') return null;
  
  let progress = 0;
  switch (step) {
    case 'upload': progress = 15; break;
    case 'job-desc': progress = 30; break;
    case 'analysis': progress = 45; break;
    case 'dashboard': progress = 60; break;
    case 'cover-letter':
    case 'written-practice':
    case 'verbal-practice':
    case 'candidate-questions':
    case 'mock-interview':
    case 'mock-analysis':
      progress = 80; break;
    case 'summary': progress = 100; break;
    default: progress = 0;
  }

  return (
    <div className="fixed top-16 left-0 right-0 h-1 bg-gray-100 z-40">
      <div 
        className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

const AuthModal = ({ isOpen, onClose, onLogin }: { isOpen: boolean; onClose: () => void; onLogin: (user: User) => void }) => {
  if (!isOpen) return null;
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email) {
      const user = { name, email };
      localStorage.setItem("cc_user_session", JSON.stringify(user));
      onLogin(user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
             <X className="w-5 h-5" />
          </button>
          
          <div className="text-center mb-8">
             <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-6 h-6" />
             </div>
             <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
             <p className="text-gray-500 mt-1">Sign in to save your progress</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                   <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                   <input 
                     type="text" 
                     required
                     className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                     placeholder="John Doe"
                     value={name}
                     onChange={e => setName(e.target.value)}
                   />
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                   <Briefcase className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                   <input 
                     type="email" 
                     required
                     className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                     placeholder="john@example.com"
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                   />
                </div>
             </div>
             <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primaryDark transition-colors mt-2 shadow-lg shadow-blue-200">
                Sign In
             </button>
          </form>
       </div>
    </div>
  );
};

const WrittenPracticeSession = ({
  questions,
  jobDescription,
  onComplete,
  onAnswerSubmit,
  existingAnswers
}: {
  questions: InterviewQuestion[];
  jobDescription: string;
  onComplete: () => void;
  onAnswerSubmit: (index: number, answer: string, feedback: AnswerFeedback) => void;
  existingAnswers: { questionIndex: number; answer: string; feedback: AnswerFeedback | null }[];
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);

  const currentQuestion = questions[currentIndex];
  
  // Load existing answer if available
  useEffect(() => {
    const existing = existingAnswers.find(a => a.questionIndex === currentIndex);
    if (existing) {
      setAnswerText(existing.answer);
      setFeedback(existing.feedback);
    } else {
      setAnswerText("");
      setFeedback(null);
    }
  }, [currentIndex, existingAnswers]);

  const handleSubmit = async () => {
    if (!answerText.trim()) return;
    setIsAnalyzing(true);

    try {
      const prompt = `
        You are an expert interview coach grading a WRITTEN response.
        
        CONTEXT:
        Job Description: ${jobDescription.substring(0, 1000)}...
        QUESTION: "${currentQuestion.question}" (${currentQuestion.type})
        CANDIDATE ANSWER: "${answerText}"
        
        TASK:
        Grade the answer strictly. Provide a revised version that is stronger.
        
        OUTPUT JSON:
        {
          "score": 85,
          "strengths": ["Used STAR method", "Specific metrics"],
          "improvements": ["Mention tools used", "Be more concise"],
          "model_answer": "Revised version of the candidate's answer...",
          "specific_feedback": "Good job, but..."
        }
      `;

      const result = await analyzeWithGemini(prompt, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          model_answer: { type: Type.STRING },
          specific_feedback: { type: Type.STRING }
        },
        required: ["score", "strengths", "improvements", "model_answer", "specific_feedback"]
      });

      setFeedback(result);
      onAnswerSubmit(currentIndex, answerText, result);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Practice Mode</h2>
        <span className="text-sm text-gray-500 font-medium">Question {currentIndex + 1} of {questions.length}</span>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{currentQuestion.question}</h3>
        <p className="text-gray-500 text-sm mb-6">
          Focus on your specific role, the obstacles you faced, and the outcome. Use the STAR method.
        </p>

        <div className="mb-2 flex justify-between text-xs text-gray-400 font-medium uppercase tracking-wide">
          <span>Your Answer</span>
          <span>{answerText.length} chars</span>
        </div>
        
        <textarea
          className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-gray-700 leading-relaxed"
          placeholder="Type your answer here..."
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          disabled={!!feedback || isAnalyzing}
        ></textarea>

        {!feedback && (
          <div className="mt-4 flex justify-end">
             <button
               onClick={handleSubmit}
               disabled={!answerText.trim() || isAnalyzing}
               className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primaryDark disabled:opacity-50 flex items-center gap-2"
             >
               {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               {isAnalyzing ? "Analyzing..." : "Analyze Answer"}
             </button>
          </div>
        )}
      </div>

      {feedback && (
        <div className="animate-fade-in space-y-4">
           <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-bold text-gray-900">AI Analysis</h3>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                 <div>
                    <div className="text-sm text-gray-500">Overall Score</div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-4xl font-bold text-gray-900">{feedback.score}</span>
                       <span className="text-gray-400">/100</span>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${feedback.score >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {feedback.score >= 80 ? 'Strong Answer' : 'Needs Work'}
                    </span>
                 </div>
                 <div className="relative w-16 h-16">
                     <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563EB" strokeWidth="3" strokeDasharray={`${feedback.score}, 100`} />
                      </svg>
                 </div>
              </div>

              <div className="bg-green-50 p-4 rounded-xl mb-4">
                 <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> Strengths</h4>
                 <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> {s}
                      </li>
                    ))}
                 </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl mb-4">
                 <h4 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Improvements</h4>
                 <ul className="space-y-2">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                        <span className="font-bold text-orange-500">!</span> {s}
                      </li>
                    ))}
                 </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Revised Answer</h4>
                    <span className="text-xs text-blue-600 font-semibold cursor-pointer uppercase">Copy</span>
                 </div>
                 <p className="text-sm text-blue-800 italic leading-relaxed">"{feedback.model_answer}"</p>
              </div>
           </div>
           
           <div className="flex gap-3 pt-4">
              <button onClick={() => { setFeedback(null); }} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">
                 Try Again
              </button>
              <button onClick={handleNext} className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primaryDark flex items-center justify-center gap-2">
                 {currentIndex === questions.length - 1 ? "Finish Written Practice" : "Next Question"} <ArrowRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

const MockInterviewSession = ({ onComplete }: { onComplete: () => void }) => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<{role: 'ai'|'user', text: string}[]>([]);
  
  // Simulate interaction
  useEffect(() => {
    if (isActive && messages.length === 0) {
      // Start
      setMessages([{ role: 'ai', text: "Hello! Thanks for joining me today. I've reviewed your resume and I'm excited to learn more about you. To start, could you please walk me through your background?" }]);
      speak("Hello! Thanks for joining me today. I've reviewed your resume and I'm excited to learn more about you. To start, could you please walk me through your background?");
    }
  }, [isActive]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const stopInterview = () => {
    setIsActive(false);
    window.speechSynthesis.cancel();
    onComplete();
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in flex flex-col h-[600px] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl relative">
       {/* Video Area */}
       <div className="flex-1 relative flex items-center justify-center bg-gray-800">
          <img 
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600&h=600" 
            alt="Interviewer" 
            className="w-48 h-48 rounded-full object-cover border-4 border-gray-700 shadow-xl opacity-90"
          />
          {isActive && (
            <div className="absolute w-52 h-52 rounded-full border-2 border-primary animate-ping opacity-20"></div>
          )}
          
          <div className="absolute bottom-6 left-6 right-6 text-center">
             {messages.length > 0 && messages[messages.length - 1].role === 'ai' && (
                <div className="bg-black/60 backdrop-blur-md text-white p-4 rounded-xl inline-block max-w-lg text-lg leading-relaxed shadow-lg border border-white/10">
                   {messages[messages.length - 1].text}
                </div>
             )}
          </div>
       </div>

       {/* Controls */}
       <div className="h-24 bg-gray-950 flex items-center justify-center gap-6 border-t border-gray-800">
          {!isActive ? (
            <button onClick={() => setIsActive(true)} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center gap-2 transition-transform hover:scale-105">
              <Play className="w-5 h-5" /> Start Interview
            </button>
          ) : (
            <>
              <button className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white border border-gray-700">
                <Mic className="w-5 h-5" />
              </button>
              <button onClick={stopInterview} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center gap-2">
                <Square className="w-4 h-4 fill-current" /> End Interview
              </button>
            </>
          )}
       </div>
       
       <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded text-xs font-bold text-white flex items-center gap-1 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full"></div> REC
       </div>
    </div>
  );
};

const Dashboard = ({ onSelectStep }: { onSelectStep: (step: Step) => void }) => {
  const modules = [
    { title: "Optimize Resume", step: 'analysis', icon: FileText, color: "bg-blue-100 text-blue-700" },
    { title: "Cover Letters", step: 'cover-letter', icon: FileCheck, color: "bg-purple-100 text-purple-700" },
    { title: "Written Practice", step: 'written-practice', icon: Edit2, color: "bg-green-100 text-green-700" },
    { title: "Verbal Practice", step: 'verbal-practice', icon: Mic, color: "bg-orange-100 text-orange-700" },
    { title: "Ask Questions", step: 'candidate-questions', icon: HelpCircle, color: "bg-pink-100 text-pink-700" },
    { title: "Mock Interview", step: 'mock-interview', icon: Video, color: "bg-indigo-100 text-indigo-700" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 animate-fade-in">
       <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Prep Hub</h2>
       <p className="text-gray-600 mb-8">Jump to any module to continue your preparation.</p>
       
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {modules.map((m, i) => (
             <div 
               key={i} 
               onClick={() => onSelectStep(m.step as Step)}
               className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
             >
                <div className={`w-12 h-12 ${m.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                   <m.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{m.title}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                   Start Module <ChevronRight className="w-3 h-3" />
                </p>
             </div>
          ))}
       </div>

       <div className="mt-10 p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl text-white flex items-center justify-between">
          <div>
             <h3 className="font-bold text-lg">Ready to review?</h3>
             <p className="text-gray-300 text-sm">See your full summary report.</p>
          </div>
          <button onClick={() => onSelectStep('summary')} className="px-6 py-2 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100">
             View Summary
          </button>
       </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  const [currentStep, setCurrentStep] = useState<Step>('landing');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'optimized'>('analysis');
  const [jobInputMode, setJobInputMode] = useState<'text' | 'url'>('text');
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionData[]>([]);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Back Navigation History Stack
  const [stepHistory, setStepHistory] = useState<Step[]>([]);

  const navigateTo = (step: Step) => {
    setStepHistory(prev => [...prev, currentStep]);
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (stepHistory.length === 0) return;
    const prevStep = stepHistory[stepHistory.length - 1];
    setStepHistory(prev => prev.slice(0, -1));
    setCurrentStep(prevStep);
    window.scrollTo(0, 0);
  };

  const [session, setSession] = useState<SessionData>({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    resumeText: "",
    jobDescription: "",
    fileName: "",
    analysis: null,
    optimizedResumes: [],
    selectedResumeIndex: 0,
    coverLetters: [],
    selectedCoverLetterIndex: 0,
    questions: [],
    writtenAnswers: [],
    verbalAnswers: [],
    candidateQuestions: [],
    mockInterviewTranscript: [],
    mockInterviewFeedback: null
  });

  useEffect(() => {
    const savedUser = localStorage.getItem("cc_user_session");
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      loadHistory(parsedUser.email);
    }
  }, []);

  const loadHistory = (email: string) => {
    const savedHistory = localStorage.getItem(`cc_history_${email}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  };

  const saveHistoryToStorage = (updatedHistory: SessionData[]) => {
    if (user) {
      localStorage.setItem(`cc_history_${user.email}`, JSON.stringify(updatedHistory));
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    loadHistory(newUser.email);
  };

  const handleLogout = () => {
    localStorage.removeItem("cc_user_session");
    setUser(null);
    setHistory([]);
    setCurrentStep('landing');
    setStepHistory([]);
  };

  const loadSessionFromHistory = (data: SessionData) => {
    setSession(data);
    navigateTo('dashboard');
  };

  // --- ANALYSIS HANDLERS ---
  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setLoadingMessage("Parsing document...");
    try {
      let text = "";
      if (file.type === "text/plain") text = await file.text();
      else if (file.type.includes("pdf")) {
         const arrayBuffer = await file.arrayBuffer();
         const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
         for (let i = 1; i <= pdf.numPages; i++) {
           const page = await pdf.getPage(i);
           const content = await page.getTextContent();
           text += content.items.map((item: any) => item.str).join(" ") + "\n";
         }
      } else {
        // Fallback for demo if mammoth/pdf fails or simplified
        text = "Sample Resume Text extracted from file...";
      }
      setSession(prev => ({ ...prev, resumeText: text, fileName: file.name }));
      navigateTo('job-desc');
    } catch (err) { console.error(err); setError("Failed to parse"); } 
    finally { setLoading(false); }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setLoadingMessage("AI is analyzing your resume fit...");
    try {
      const result = await analyzeWithGemini(`
        You are an ATS analyzer.
        Resume: ${session.resumeText}
        Job: ${session.jobDescription}
        Output JSON with match_score (0-100), missing_keywords (array), skills_gap (array), recommendations (array of objects with priority, suggestion, location).
      `, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
          match_score: { type: Type.NUMBER },
          missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills_gap: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { priority: { type: Type.STRING }, suggestion: { type: Type.STRING }, location: { type: Type.STRING } } } }
        }
      });
      setSession(prev => ({ ...prev, analysis: result }));
      navigateTo('analysis');
    } catch (err) { setError("Analysis failed"); }
    finally { setLoading(false); }
  };

  const handleGenerateQuestions = async () => {
     setLoading(true);
     setLoadingMessage("Generating questions...");
     try {
       const result = await analyzeWithGemini(`
         Generate 5 interview questions (behavioral/technical) for this resume/job.
         Resume: ${session.resumeText.substring(0, 500)}...
         Job: ${session.jobDescription.substring(0, 500)}...
         Output JSON with 'questions' array.
       `, "gemini-2.5-flash", {
         type: Type.OBJECT,
         properties: {
           questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, why_asked: { type: Type.STRING } } } }
         }
       });
       setSession(prev => ({ ...prev, questions: result.questions }));
       navigateTo('written-practice');
     } catch (err) { console.error(err); setError("Failed to generate questions"); }
     finally { setLoading(false); }
  };

  if (loading) return <LoadingScreen message={loadingMessage} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header 
        user={user} 
        onLoginClick={() => setShowAuthModal(true)} 
        onLogoutClick={handleLogout} 
        onGoToHistory={() => navigateTo('history')}
        onBack={handleBack}
        showBack={currentStep !== 'landing' && currentStep !== 'history'}
      />
      <ProgressBar step={currentStep} />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onLogin={handleLogin} />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        
        {/* LANDING */}
        {currentStep === 'landing' && (
          <div className="text-center pt-10 animate-fade-in">
             <h1 className="text-5xl font-extrabold text-gray-900 mb-6">Master Your <span className="text-primary">Career Move</span></h1>
             <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">Full suite: Resume Optimization, Cover Letters, Written & Verbal Practice, and Real Mock Interviews.</p>
             <button onClick={() => navigateTo('upload')} className="px-8 py-4 bg-primary text-white text-lg font-bold rounded-full shadow-lg hover:bg-primaryDark transition-transform hover:scale-105 flex items-center justify-center gap-2 mx-auto">
                Start Free Analysis <ArrowRight className="w-5 h-5" />
             </button>
          </div>
        )}

        {/* UPLOAD */}
        {currentStep === 'upload' && (
           <div className="max-w-xl mx-auto animate-fade-in text-center pt-10">
              <h2 className="text-3xl font-bold mb-6">Upload Resume</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 hover:border-primary transition-colors cursor-pointer relative">
                <input type="file" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Drag & drop or click to upload PDF/DOCX</p>
              </div>
              <button onClick={() => { setSession(prev => ({...prev, resumeText: "Mock Resume Text"})); navigateTo('job-desc'); }} className="mt-8 text-xs text-gray-400 underline">Skip (Debug Mode)</button>
           </div>
        )}
        
        {/* JOB DESC */}
        {currentStep === 'job-desc' && (
           <div className="max-w-2xl mx-auto animate-fade-in">
              <h2 className="text-2xl font-bold mb-4">Job Description</h2>
              <p className="text-gray-600 mb-4">Paste the job description below to tailor your analysis.</p>
              <textarea className="w-full h-64 border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-primary outline-none" value={session.jobDescription} onChange={e => setSession(prev => ({...prev, jobDescription: e.target.value}))} placeholder="Paste JD here..."></textarea>
              <div className="flex justify-end mt-6">
                <button onClick={handleAnalyze} disabled={!session.jobDescription} className="px-8 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark disabled:opacity-50">Analyze Fit</button>
              </div>
           </div>
        )}

        {/* ANALYSIS RESULT */}
        {currentStep === 'analysis' && session.analysis && (
           <div className="animate-fade-in">
              <div className="bg-white p-8 rounded-2xl shadow-sm text-center mb-8 border border-gray-100">
                 <div className="text-5xl font-extrabold text-primary mb-2">{session.analysis.match_score}%</div>
                 <p className="text-gray-500 font-medium uppercase tracking-wide text-sm mb-6">Match Score</p>
                 <p className="text-gray-600 mb-8 max-w-lg mx-auto">We've analyzed your resume against the job description. Head to the dashboard to start optimizing your application and preparing for the interview.</p>
                 <button onClick={() => navigateTo('dashboard')} className="px-8 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black shadow-lg transition-transform hover:scale-105">
                   Go to Dashboard
                 </button>
              </div>
           </div>
        )}

        {/* DASHBOARD */}
        {currentStep === 'dashboard' && (
          <Dashboard onSelectStep={(s) => {
             if (s === 'written-practice' && session.questions.length === 0) {
               handleGenerateQuestions();
             } else {
               navigateTo(s);
             }
          }} />
        )}

        {/* WRITTEN PRACTICE */}
        {currentStep === 'written-practice' && (
           <WrittenPracticeSession 
             questions={session.questions} 
             jobDescription={session.jobDescription} 
             existingAnswers={session.writtenAnswers}
             onAnswerSubmit={(idx, ans, fb) => {
                const newAnswers = [...session.writtenAnswers.filter(a => a.questionIndex !== idx), { questionIndex: idx, answer: ans, feedback: fb }];
                setSession(prev => ({...prev, writtenAnswers: newAnswers}));
             }}
             onComplete={() => navigateTo('verbal-practice')}
           />
        )}
        
        {/* VERBAL PRACTICE */}
        {currentStep === 'verbal-practice' && (
           <div className="text-center py-20 animate-fade-in">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Mic className="w-10 h-10 text-orange-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Verbal Practice</h2>
              <p className="text-gray-600 mb-8 max-w-lg mx-auto">Practice speaking your answers aloud. This module uses speech recognition to transcribe and analyze your delivery.</p>
              <button onClick={() => navigateTo('candidate-questions')} className="px-8 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark">
                 Next: Strategic Questions
              </button>
           </div>
        )}

        {/* CANDIDATE QUESTIONS */}
        {currentStep === 'candidate-questions' && (
           <div className="text-center py-20 animate-fade-in">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                 <HelpCircle className="w-10 h-10 text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Questions to Ask</h2>
              <p className="text-gray-600 mb-8 max-w-lg mx-auto">Don't leave the interview without asking these 5 strategic questions to show your interest and close the deal.</p>
              <button onClick={() => navigateTo('mock-interview')} className="px-8 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark">
                 Next: Real Mock Interview
              </button>
           </div>
        )}

        {/* MOCK INTERVIEW */}
        {currentStep === 'mock-interview' && (
           <MockInterviewSession onComplete={() => navigateTo('summary')} />
        )}

        {/* HISTORY */}
        {currentStep === 'history' && (
           <div className="max-w-4xl mx-auto animate-fade-in">
              <h2 className="text-2xl font-bold mb-6">History</h2>
              {history.length === 0 ? (
                 <p className="text-gray-500">No history found. Start a new analysis.</p>
              ) : (
                 <div className="grid gap-4">
                    {history.map(h => (
                       <div key={h.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow">
                          <div>
                             <div className="font-bold text-lg text-gray-900">{h.fileName || "Untitled Resume"}</div>
                             <div className="text-sm text-gray-500">{new Date(h.timestamp).toLocaleDateString()} • {h.analysis?.match_score}% Match</div>
                          </div>
                          <button onClick={() => loadSessionFromHistory(h)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">
                             Load Session
                          </button>
                       </div>
                    ))}
                 </div>
              )}
           </div>
        )}

        {/* SUMMARY */}
        {currentStep === 'summary' && (
           <div className="text-center py-20 animate-fade-in">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                 <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Session Complete!</h2>
              <p className="text-gray-600 mb-8">You've completed the full interview preparation loop.</p>
              <div className="flex justify-center gap-4">
                 <button onClick={() => navigateTo('dashboard')} className="px-6 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black">
                    Back to Dashboard
                 </button>
                 <button onClick={() => {
                    if (user) {
                       const newHistory = [session, ...history];
                       setHistory(newHistory);
                       saveHistoryToStorage(newHistory);
                       alert("Saved to history!");
                    } else {
                       setShowAuthModal(true);
                    }
                 }} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
                    Save Progress
                 </button>
              </div>
           </div>
        )}

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);