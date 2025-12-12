import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, FileText, CheckCircle, AlertCircle, X, ChevronRight, 
  Briefcase, Award, Mic, Square, Play, RefreshCw, Download, 
  ArrowRight, Star, ChevronDown, ChevronUp, Loader2, Sparkles, Wand2,
  Layout, History, Edit2, Save, Link as LinkIcon, MonitorPlay, FileCheck,
  LogIn, User as UserIcon, LogOut, Lock, ThumbsUp, TrendingUp
} from "lucide-react";
// Import parsing libraries from ESM CDN
import * as pdfjsLibProxy from 'https://esm.sh/pdfjs-dist@3.11.174';
import mammoth from 'https://esm.sh/mammoth@1.6.0';

// Fix for PDF.js worker in ESM environment
const pdfjsLib = (pdfjsLibProxy as any).default || pdfjsLibProxy;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// --- TYPES ---

type Step = 'landing' | 'upload' | 'job-desc' | 'analysis' | 'cover-letter' | 'interview-intro' | 'interview-practice' | 'summary' | 'history';

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
}

interface CoverLetterVersion {
  id: string;
  name: string;
  content: string;
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
  answers: {
    questionIndex: number;
    userAnswer: string; // text or transcript
    feedback: AnswerFeedback | null;
  }[];
}

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
    
    // Clean potential markdown code blocks if the model adds them despite MIME type
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

// --- COMPONENTS ---

const Header = ({ 
  user, 
  onLoginClick, 
  onLogoutClick, 
  onGoToHistory 
}: { 
  user: User | null; 
  onLoginClick: () => void; 
  onLogoutClick: () => void;
  onGoToHistory: () => void;
}) => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl text-gray-900">Career<span className="text-primary">Coach</span>.ai</span>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <button 
              onClick={onGoToHistory}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              <History className="w-4 h-4" /> History
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
               <div className="flex flex-col text-right hidden sm:block">
                 <span className="text-xs font-bold text-gray-900">{user.name}</span>
                 <span className="text-xs text-gray-500">{user.email}</span>
               </div>
               <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                 {user.name.charAt(0)}
               </div>
               <button 
                 onClick={onLogoutClick}
                 className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                 title="Logout"
               >
                 <LogOut className="w-4 h-4" />
               </button>
            </div>
          </>
        ) : (
          <button 
            onClick={onLoginClick}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/20 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Login
          </button>
        )}
      </div>
    </div>
  </header>
);

const AuthModal = ({ 
  isOpen, 
  onClose, 
  onLogin 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: (user: User) => void; 
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create mock user
    const user: User = {
      email,
      name: isSignUp ? name : email.split('@')[0],
    };

    // Save "session" token
    localStorage.setItem("cc_user_session", JSON.stringify(user));
    
    onLogin(user);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input 
                type="text" 
                required 
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primaryDark text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? "Sign Up" : "Login")}
          </button>
        </form>
        
        <div className="p-4 bg-gray-50 text-center text-sm text-gray-600 border-t border-gray-100">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary font-semibold hover:underline"
          >
            {isSignUp ? "Login" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProgressBar = ({ step }: { step: Step }) => {
  const steps: Step[] = ['landing', 'upload', 'job-desc', 'analysis', 'cover-letter', 'interview-intro', 'interview-practice', 'summary'];
  const currentIndex = steps.indexOf(step);
  
  if (step === 'landing' || step === 'history') return null;

  const progress = Math.max(5, ((currentIndex) / (steps.length - 1)) * 100);

  return (
    <div className="w-full bg-gray-100 h-1.5 fixed top-16 left-0 z-40">
      <div 
        className="bg-primary h-1.5 transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

const InterviewSession = ({
  questions,
  jobDescription,
  onComplete,
  onAnswerSubmit
}: {
  questions: InterviewQuestion[];
  jobDescription: string;
  onComplete: () => void;
  onAnswerSubmit: (index: number, answer: string, feedback: AnswerFeedback) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleSubmit = async () => {
    if (!answerText.trim()) return;
    setIsAnalyzing(true);

    try {
      const prompt = `
        You are an expert interview coach.
        
        CONTEXT:
        Job Description: ${jobDescription.substring(0, 1000)}...
        
        QUESTION ASKED: "${currentQuestion.question}" (${currentQuestion.type})
        USER ANSWER: "${answerText}"
        
        TASK:
        Evaluate the user's answer. Provide constructive feedback.
        
        OUTPUT JSON:
        {
          "score": 7,
          "strengths": ["Clear communication", "Used STAR method"],
          "improvements": ["More specific metrics needed", "Spoke too fast"],
          "model_answer": "Here is an example of a better answer...",
          "specific_feedback": "You did well but missed..."
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
      alert("Failed to analyze answer. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setAnswerText("");
    if (isLastQuestion) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Question {currentIndex + 1} of {questions.length}</h2>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mt-2 ${
            currentQuestion.type === 'behavioral' ? 'bg-blue-100 text-blue-700' :
            currentQuestion.type === 'technical' ? 'bg-purple-100 text-purple-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {currentQuestion.type}
          </span>
        </div>
        <button 
          onClick={onComplete}
          className="text-sm text-gray-500 hover:text-gray-900 underline"
        >
          End Session Early
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 mb-6">
        <h3 className="text-xl font-medium text-gray-900 mb-2">{currentQuestion.question}</h3>
        <p className="text-sm text-gray-500 italic mb-6">Why this is asked: {currentQuestion.why_asked}</p>

        {!feedback ? (
          <div className="space-y-4">
            <textarea
              className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Type your answer here..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={isAnalyzing}
            ></textarea>
            
            <div className="flex justify-between items-center">
               <div className="text-xs text-gray-400">
                 Tip: Use the STAR method (Situation, Task, Action, Result)
               </div>
               <button
                 onClick={handleSubmit}
                 disabled={!answerText.trim() || isAnalyzing}
                 className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorPlay className="w-4 h-4" />}
                 {isAnalyzing ? "Analyzing..." : "Submit Answer"}
               </button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                <p className="text-gray-700 whitespace-pre-wrap"><strong>Your Answer:</strong> {answerText}</p>
             </div>

             <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                   <div className="flex items-center gap-3 mb-4">
                      <div className={`text-2xl font-bold ${
                        feedback.score >= 8 ? 'text-green-600' : feedback.score >= 5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {feedback.score}/10
                      </div>
                      <div className="text-sm font-medium text-gray-600">AI Score</div>
                   </div>
                   
                   <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-green-700 text-sm mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Strengths</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 pl-1">
                          {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-red-700 text-sm mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Improvements</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 pl-1">
                          {feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                   </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm">
                   <h4 className="font-bold text-blue-900 mb-2">Model Answer</h4>
                   <p className="text-blue-800 leading-relaxed">{feedback.model_answer}</p>
                </div>
             </div>
             
             <div className="flex justify-end">
               <button
                 onClick={handleNext}
                 className="px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-black font-medium flex items-center gap-2"
               >
                 {isLastQuestion ? "Finish Session" : "Next Question"} <ChevronRight className="w-4 h-4" />
               </button>
             </div>
          </div>
        )}
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
    answers: []
  });

  // Load User and History on Mount
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
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    } else {
      setHistory([]);
    }
  };

  const saveHistoryToStorage = (updatedHistory: SessionData[]) => {
    if (user) {
      localStorage.setItem(`cc_history_${user.email}`, JSON.stringify(updatedHistory));
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    loadHistory(newUser.email);
    // If we have a completed session pending save, save it now
    if (currentStep === 'summary') {
       const userHistory = localStorage.getItem(`cc_history_${newUser.email}`);
       const parsedHistory = userHistory ? JSON.parse(userHistory) : [];
       const newHistory = [session, ...parsedHistory];
       setHistory(newHistory);
       localStorage.setItem(`cc_history_${newUser.email}`, JSON.stringify(newHistory));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("cc_user_session");
    setUser(null);
    setHistory([]);
    setCurrentStep('landing');
  };

  // --- HANDLERS ---

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setLoadingMessage("Parsing document...");
    setError(null);

    try {
      let text = "";
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === "text/plain") {
        text = await file.text();
      } else {
        throw new Error("Unsupported file format");
      }

      if (!text.trim()) {
        throw new Error("Could not extract text from file. Please try pasting plain text.");
      }

      setSession(prev => ({ ...prev, resumeText: text, fileName: file.name }));
      setCurrentStep('job-desc');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteResume = (text: string) => {
    if (!text.trim()) return;
    setSession(prev => ({ ...prev, resumeText: text, fileName: "Pasted Resume" }));
    setCurrentStep('job-desc');
  };

  const handleAnalyze = async () => {
    if (!session.jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }

    setLoading(true);
    setLoadingMessage("AI is analyzing your resume fit...");
    setError(null);

    try {
      const prompt = `
        You are an expert ATS (Applicant Tracking System) analyzer.
        INPUT:
        - Resume text: ${session.resumeText}
        - Job description: ${session.jobDescription}

        TASK:
        1. Extract keywords/skills from job description.
        2. Compare with resume.
        3. Calculate score.
        4. Provide specific actionable feedback.

        OUTPUT JSON:
        {
          "match_score": 72,
          "missing_keywords": ["keyword1", "keyword2"],
          "keyword_density": [{"term": "project management", "count": 3}],
          "formatting_issues": ["Contains tables"],
          "skills_gap": ["Python"],
          "recommendations": [
            { "priority": "high", "suggestion": "Add 'project management' to Skills", "location": "Skills section" }
          ]
        }
      `;

      const result = await analyzeWithGemini(prompt, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
          match_score: { type: Type.NUMBER },
          missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyword_density: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, count: { type: Type.NUMBER } } } },
          formatting_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills_gap: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                priority: { type: Type.STRING, enum: ["high", "medium", "low"] }, 
                suggestion: { type: Type.STRING }, 
                location: { type: Type.STRING } 
              } 
            } 
          }
        },
        required: ["match_score", "missing_keywords", "recommendations", "skills_gap"]
      });
      setSession(prev => ({ ...prev, analysis: result }));
      setCurrentStep('analysis');
    } catch (err) {
      console.error(err);
      setError("Failed to analyze resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOptimizedResumes = async () => {
    if (!session.analysis) return;
    setLoading(true);
    setLoadingMessage("Generating 3 optimized resume variations...");
    
    try {
      const prompt = `
        You are an expert resume writer.
        INPUT:
        - Original resume: ${session.resumeText}
        - Job description: ${session.jobDescription}
        
        TASK:
        Create 3 DIFFERENT versions of the optimized resume in Markdown format.
        1. "Standard Optimized": Clean, professional, minimal changes but high ATS score.
        2. "Action-Oriented": Focus heavily on verbs and results/metrics. Aggressive tone.
        3. "Skills-Focused": Emphasize technical skills and competencies at the top.

        IMPORTANT:
        - Return ONLY valid JSON.
        - Ensure all resume content is properly escaped JSON strings.
        - The 'content' field must contain the FULL resume text.

        OUTPUT JSON Structure:
        {
          "versions": [
            { "id": "v1", "name": "Standard Optimized", "content": "# Name..." },
            { "id": "v2", "name": "Action-Oriented", "content": "# Name..." },
            { "id": "v3", "name": "Skills-Focused", "content": "# Name..." }
          ]
        }
      `;
      
      const result = await analyzeWithGemini(prompt, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
          versions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["id", "name", "content"]
            }
          }
        },
        required: ["versions"]
      });
      
      if (!result.versions || result.versions.length === 0) {
        throw new Error("No versions generated");
      }

      setSession(prev => ({ 
        ...prev, 
        optimizedResumes: result.versions,
        selectedResumeIndex: 0
      }));
      setActiveTab('optimized');
    } catch (err) {
      console.error(err);
      setError("Failed to generate optimized resumes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCoverLetters = async () => {
    setLoading(true);
    setLoadingMessage("Drafting 3 cover letter options...");
    
    try {
      const prompt = `
        You are a career coach.
        INPUT:
        - Resume: ${session.resumeText}
        - Job description: ${session.jobDescription}
        
        TASK:
        Write 3 distinct cover letters:
        1. "Professional": Traditional, polite, respectful.
        2. "Creative": Engaging, storytelling approach, shows personality.
        3. "Concise": Short, punchy, gets straight to value prop (under 200 words).

        IMPORTANT:
        - Return ONLY valid JSON.
        - Ensure all content is properly escaped JSON strings.

        OUTPUT JSON Structure:
        {
          "versions": [
             { "id": "cl1", "name": "Professional", "content": "Dear Hiring Manager..." },
             { "id": "cl2", "name": "Creative", "content": "..." },
             { "id": "cl3", "name": "Concise", "content": "..." }
          ]
        }
      `;

      const result = await analyzeWithGemini(prompt, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
           versions: {
             type: Type.ARRAY,
             items: {
               type: Type.OBJECT,
               properties: {
                 id: { type: Type.STRING },
                 name: { type: Type.STRING },
                 content: { type: Type.STRING }
               },
               required: ["id", "name", "content"]
             }
           }
        },
        required: ["versions"]
      });

      setSession(prev => ({ 
        ...prev, 
        coverLetters: result.versions,
        selectedCoverLetterIndex: 0
      }));
      setCurrentStep('cover-letter');

    } catch (err) {
      console.error(err);
      setError("Failed to generate cover letters.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setLoading(true);
    setLoadingMessage("Curating interview questions...");
    
    try {
      const prompt = `
        You are an expert interviewer.
        INPUT:
        - Job description: ${session.jobDescription}
        - Resume: ${session.resumeText}

        TASK:
        Generate 5 interview questions specifically tailored to this role and candidate:
        - 2 behavioral questions (STAR method format)
        - 2 technical/role-specific questions
        - 1 situational question

        OUTPUT JSON:
        {
          "questions": [
            {
              "type": "behavioral",
              "question": "Tell me about a time...",
              "why_asked": "To check resilience..."
            }
          ]
        }
      `;
      
      const result = await analyzeWithGemini(prompt, "gemini-2.5-flash", {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["behavioral", "technical", "situational"] },
                question: { type: Type.STRING },
                why_asked: { type: Type.STRING }
              },
              required: ["type", "question", "why_asked"]
            }
          }
        },
        required: ["questions"]
      });
      
      // Validation to ensure we got questions
      if (!result.questions || result.questions.length === 0) {
        throw new Error("No questions generated");
      }

      setSession(prev => ({ ...prev, questions: result.questions }));
      setCurrentStep('interview-intro');
    } catch (err) {
      console.error(err);
      setError("Failed to generate interview questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSession = () => {
    // If logged in, save automatically
    if (user) {
      const newHistory = [session, ...history];
      setHistory(newHistory);
      saveHistoryToStorage(newHistory);
    }
    // If not logged in, we still keep it in state (memory), but prompt user to login in the Summary view
    setCurrentStep('summary');
  };

  // --- SUB-COMPONENTS for STEPS ---

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">{loadingMessage}</h3>
        <p className="text-gray-500 mt-2">Powered by Gemini 2.5 Flash</p>
      </div>
    );
  }

  // --- HISTORY VIEW ---
  if (currentStep === 'history') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Header 
          user={user} 
          onLoginClick={() => setShowAuthModal(true)} 
          onLogoutClick={handleLogout} 
          onGoToHistory={() => setCurrentStep('history')}
        />
        <main className="max-w-5xl mx-auto w-full px-4 py-12">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setCurrentStep('landing')} className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Your Applications History</h1>
          </div>

          {!user ? (
             <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">Please Login</h3>
              <p className="text-gray-500 mb-6">You need to be logged in to view your history.</p>
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark"
              >
                Login to View History
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">No history yet</h3>
              <p className="text-gray-500 mb-6">Complete a full analysis to save it here.</p>
              <button 
                onClick={() => setCurrentStep('landing')}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark"
              >
                Start New Analysis
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {history.map((h) => (
                <div key={h.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{h.fileName || "Unknown File"}</h3>
                      <p className="text-sm text-gray-500">{new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString()}</p>
                      {h.jobUrl && (
                        <a href={h.jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center gap-1 mt-1 hover:underline">
                           <LinkIcon className="w-3 h-3" /> Job Link
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                         (h.analysis?.match_score || 0) >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                       }`}>
                         Score: {h.analysis?.match_score}%
                       </span>
                    </div>
                  </div>
                  
                  {/* Action Bar */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => {
                         const blob = new Blob([h.optimizedResumes[h.selectedResumeIndex]?.content || ""], { type: "text/plain" });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = `resume-${h.id}.txt`;
                         a.click();
                      }}
                      className="text-xs sm:text-sm bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md text-gray-700 flex items-center gap-1 border border-gray-200"
                    >
                      <FileText className="w-3 h-3" /> Optimized Resume
                    </button>
                    
                    {h.coverLetters.length > 0 && (
                     <button 
                      onClick={() => {
                         const blob = new Blob([h.coverLetters[h.selectedCoverLetterIndex]?.content || ""], { type: "text/plain" });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = `cover-letter-${h.id}.txt`;
                         a.click();
                      }}
                      className="text-xs sm:text-sm bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md text-gray-700 flex items-center gap-1 border border-gray-200"
                    >
                      <FileCheck className="w-3 h-3" /> Cover Letter
                    </button>
                    )}

                    <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                       <Award className="w-3 h-3" />
                       <span>Interview Score: {Math.round(h.answers.reduce((acc, curr) => acc + (curr.feedback?.score || 0), 0) / Math.max(1, h.answers.length) * 10)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          onLogin={handleLogin} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header 
        user={user} 
        onLoginClick={() => setShowAuthModal(true)} 
        onLogoutClick={handleLogout} 
        onGoToHistory={() => setCurrentStep('history')}
      />
      <ProgressBar step={currentStep} />
      
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onLogin={handleLogin} 
      />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {currentStep === 'landing' && (
          <div className="text-center max-w-3xl mx-auto pt-10 animate-fade-in">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
              Get Your Resume Past ATS and <span className="text-primary">Ace Your Interview</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              AI-powered resume optimization, cover letter generation, and mock interviews in under 15 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => setCurrentStep('upload')}
                className="px-8 py-4 bg-primary hover:bg-primaryDark text-white text-lg font-semibold rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
              >
                Start Free Analysis <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                { title: "ATS Check", desc: "See exactly what keywords your resume is missing for the specific job." },
                { title: "Smart Optimization", desc: "Get 3 variations of your resume tailored to the JD." },
                { title: "Mock Interview", desc: "Practice with custom questions and get instant AI coaching." }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-blue-50 text-primary rounded-lg flex items-center justify-center mb-4 font-bold text-lg">
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Upload Your Resume</h2>
            <p className="text-gray-500 text-center mb-8">Supported formats: PDF, DOCX, TXT</p>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-dashed border-gray-200 hover:border-primary transition-colors cursor-pointer group relative">
              <input 
                type="file" 
                accept=".pdf,.docx,.txt"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">Click or drag resume here</p>
                <p className="text-sm text-gray-500">Max file size: 5MB</p>
              </div>
            </div>

            <div className="mt-8">
               <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-50 px-2 text-gray-500">Or paste text</span>
                  </div>
                </div>
                <textarea
                  placeholder="Paste your resume content here if upload fails..."
                  className="mt-4 w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  id="resumePasteArea"
                ></textarea>
                <button 
                  onClick={() => {
                    const el = document.getElementById('resumePasteArea') as HTMLTextAreaElement;
                    handlePasteResume(el.value);
                  }}
                  className="mt-4 w-full py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Use Pasted Text
                </button>
            </div>
          </div>
        )}

        {currentStep === 'job-desc' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Resume Uploaded</h2>
                  <p className="text-sm text-gray-500">{session.fileName}</p>
                </div>
                <button 
                  onClick={() => setCurrentStep('upload')} 
                  className="ml-auto text-sm text-primary hover:underline"
                >
                  Change
                </button>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Job Description</h2>
            <p className="text-gray-600 mb-6">
              Provide the job description so we can analyze your fit.
            </p>

            <div className="flex gap-0 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
              <button 
                onClick={() => setJobInputMode('text')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${jobInputMode === 'text' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Paste Text
              </button>
              <button 
                onClick={() => setJobInputMode('url')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${jobInputMode === 'url' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Paste URL
              </button>
            </div>

            {jobInputMode === 'text' ? (
              <textarea
                className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm shadow-sm"
                placeholder="About the job..."
                value={session.jobDescription}
                onChange={(e) => setSession(prev => ({...prev, jobDescription: e.target.value}))}
              ></textarea>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="https://linkedin.com/jobs/..."
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  onChange={(e) => setSession(prev => ({...prev, jobUrl: e.target.value}))}
                />
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex gap-3 text-yellow-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    <strong>Note:</strong> Direct scraping might be blocked by some job sites due to security settings. 
                    If analysis fails, please copy and paste the text directly.
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 h-40 flex items-center justify-center text-gray-400">
                   Preview not available
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={jobInputMode === 'text' && !session.jobDescription.trim()}
                className="px-8 py-3 bg-primary hover:bg-primaryDark disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md flex items-center gap-2"
              >
                Analyze My Fit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'analysis' && session.analysis && (
          <div className="animate-fade-in space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
              <div className="flex gap-3">
                 <button 
                  onClick={handleGenerateCoverLetters}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark font-medium flex items-center gap-2 shadow-sm"
                >
                  Next: Cover Letters <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analysis' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Analysis & Match Score
                </button>
                <button
                  onClick={() => setActiveTab('optimized')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'optimized' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Optimized Resumes (3 Versions)
                </button>
              </nav>
            </div>

            {activeTab === 'analysis' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                {/* Match Score Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                  <div className="relative w-32 h-32 mb-4">
                     <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#eee"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={session.analysis.match_score >= 80 ? "#10B981" : session.analysis.match_score >= 60 ? "#F59E0B" : "#EF4444"}
                          strokeWidth="3"
                          strokeDasharray={`${session.analysis.match_score}, 100`}
                          className="animate-[spin_1s_ease-out_reverse]"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-3xl font-bold text-gray-900">{session.analysis.match_score}%</span>
                        <span className="text-xs text-gray-500 uppercase font-semibold">Match</span>
                      </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {session.analysis.match_score >= 80 ? "Great fit! Minor tweaks needed." : 
                     session.analysis.match_score >= 60 ? "Good potential, but needs optimization." : 
                     "Low match. Significant tailoring required."}
                  </p>
                </div>

                {/* Missing Keywords */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-warning" /> Missing Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.analysis.missing_keywords.map((kw, i) => (
                      <span key={i} className="px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-full border border-red-100">
                        {kw}
                      </span>
                    ))}
                    {session.analysis.missing_keywords.length === 0 && (
                      <p className="text-green-600 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> All key terms present!</p>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 mt-6 mb-4 flex items-center gap-2">
                     Skills Gap
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.analysis.skills_gap.map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-yellow-50 text-yellow-700 text-sm font-medium rounded-full border border-yellow-100">
                        {skill}
                      </span>
                    ))}
                    {session.analysis.skills_gap.length === 0 && (
                       <p className="text-gray-500 text-sm">No specific skills gaps identified.</p>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden md:col-span-3">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-xl text-gray-900">AI Recommendations</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {session.analysis.recommendations.map((rec, i) => (
                      <div key={i} className="p-4 sm:p-6 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                        <div className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full ${
                          rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                              rec.priority === 'high' ? 'bg-red-100 text-red-700' : 
                              rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {rec.priority} Priority
                            </span>
                            <span className="text-xs text-gray-500">In {rec.location}</span>
                          </div>
                          <p className="text-gray-800">{rec.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                {session.optimizedResumes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Wand2 className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Generate Optimized Versions</h3>
                    <p className="text-gray-500 max-w-md mb-6">
                      We can generate 3 unique resume versions tailored to this job: Standard, Action-Oriented, and Skills-Focused.
                    </p>
                    <button 
                      onClick={handleGenerateOptimizedResumes}
                      className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-black font-medium flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" /> Generate 3 Options
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
                       {session.optimizedResumes.map((resume, idx) => (
                         <button
                           key={resume.id}
                           onClick={() => {
                             setSession(prev => ({ ...prev, selectedResumeIndex: idx }));
                             setEditingContent(null);
                           }}
                           className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                             session.selectedResumeIndex === idx 
                             ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                             : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                           }`}
                         >
                           {resume.name}
                         </button>
                       ))}
                    </div>

                    <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-600">
                        Currently viewing: <strong>{session.optimizedResumes[session.selectedResumeIndex].name}</strong>
                      </div>
                      <div className="flex gap-2">
                         <button 
                           onClick={() => setEditingContent(session.optimizedResumes[session.selectedResumeIndex].content)}
                           className="text-gray-700 hover:text-primary text-sm font-medium flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-md"
                         >
                           <Edit2 className="w-3 h-3" /> Edit
                         </button>
                         <button 
                           onClick={() => {
                             const blob = new Blob([session.optimizedResumes[session.selectedResumeIndex].content], { type: "text/plain" });
                             const url = URL.createObjectURL(blob);
                             const a = document.createElement("a");
                             a.href = url;
                             a.download = `optimized_${session.optimizedResumes[session.selectedResumeIndex].id}.txt`;
                             a.click();
                           }}
                           className="text-white bg-gray-900 hover:bg-black text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-md"
                         >
                           <Download className="w-3 h-3" /> Download
                         </button>
                      </div>
                    </div>
                    
                    {editingContent !== null ? (
                      <div className="space-y-4">
                        <textarea 
                          className="w-full h-[600px] p-4 border border-gray-300 rounded-lg font-mono text-sm"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                           <button 
                             onClick={() => setEditingContent(null)}
                             className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                           >
                             Cancel
                           </button>
                           <button 
                             onClick={() => {
                               const updatedResumes = [...session.optimizedResumes];
                               updatedResumes[session.selectedResumeIndex].content = editingContent;
                               setSession(prev => ({ ...prev, optimizedResumes: updatedResumes }));
                               setEditingContent(null);
                             }}
                             className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                           >
                             <Save className="w-4 h-4" /> Save Changes
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-8 rounded-lg border border-gray-200 font-mono text-sm whitespace-pre-wrap text-gray-800 h-[600px] overflow-y-auto shadow-inner">
                        {session.optimizedResumes[session.selectedResumeIndex].content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 'cover-letter' && (
           <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Cover Letters</h2>
                  <p className="text-gray-500">Select and edit your preferred style.</p>
                </div>
                <button 
                  onClick={handleGenerateQuestions}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark font-medium flex items-center gap-2 shadow-sm"
                >
                  Next: Interview Prep <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {session.coverLetters.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                       {session.coverLetters.map((cl, idx) => (
                         <button
                           key={cl.id}
                           onClick={() => {
                             setSession(prev => ({ ...prev, selectedCoverLetterIndex: idx }));
                             setEditingContent(null);
                           }}
                           className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                             session.selectedCoverLetterIndex === idx 
                             ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                             : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                           }`}
                         >
                           {cl.name}
                         </button>
                       ))}
                    </div>

                    <div className="flex justify-end gap-2 mb-4">
                       <button 
                           onClick={() => setEditingContent(session.coverLetters[session.selectedCoverLetterIndex].content)}
                           className="text-gray-700 hover:text-primary text-sm font-medium flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-md"
                         >
                           <Edit2 className="w-3 h-3" /> Edit
                         </button>
                       <button 
                         onClick={() => {
                             const blob = new Blob([session.coverLetters[session.selectedCoverLetterIndex].content], { type: "text/plain" });
                             const url = URL.createObjectURL(blob);
                             const a = document.createElement("a");
                             a.href = url;
                             a.download = `cover_letter_${session.coverLetters[session.selectedCoverLetterIndex].name}.txt`;
                             a.click();
                         }}
                         className="text-gray-700 hover:text-gray-900 text-sm font-medium flex items-center gap-1 border border-gray-200 px-3 py-1.5 rounded-md"
                       >
                         <Download className="w-3 h-3" /> Download
                       </button>
                    </div>

                    {editingContent !== null ? (
                      <div className="space-y-4">
                        <textarea 
                          className="w-full h-[500px] p-6 border border-gray-300 rounded-lg font-serif text-base leading-relaxed"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                           <button 
                             onClick={() => setEditingContent(null)}
                             className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                           >
                             Cancel
                           </button>
                           <button 
                             onClick={() => {
                               const updated = [...session.coverLetters];
                               updated[session.selectedCoverLetterIndex].content = editingContent;
                               setSession(prev => ({ ...prev, coverLetters: updated }));
                               setEditingContent(null);
                             }}
                             className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                           >
                             <Save className="w-4 h-4" /> Save Changes
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-8 rounded-lg border border-gray-200 font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap shadow-sm min-h-[500px]">
                        {session.coverLetters[session.selectedCoverLetterIndex].content}
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-red-500">Error generating cover letters. Please try again.</p>
                </div>
              )}
           </div>
        )}

        {currentStep === 'interview-intro' && (
          <div className="max-w-2xl mx-auto text-center animate-fade-in pt-10">
             <div className="w-20 h-20 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <Mic className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-bold text-gray-900 mb-4">Interview Preparation</h2>
             <p className="text-lg text-gray-600 mb-8">
               We've generated {session.questions.length} questions tailored to this specific role and your experience. 
               You can practice answering them with text or audio, and get instant AI feedback.
             </p>
             
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-left mb-8">
                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Your Question Plan</h3>
                <ul className="space-y-3">
                  {session.questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-gray-900 capitalize">{q.type}: </span> 
                        {q.question}
                      </div>
                    </li>
                  ))}
                </ul>
             </div>

             <button 
               onClick={() => setCurrentStep('interview-practice')}
               className="px-10 py-4 bg-primary text-white text-lg font-bold rounded-full shadow-lg hover:bg-primaryDark hover:scale-105 transition-all"
             >
               Start Mock Interview
             </button>
          </div>
        )}

        {currentStep === 'interview-practice' && (
           <InterviewSession 
             questions={session.questions} 
             jobDescription={session.jobDescription}
             onComplete={handleFinishSession}
             onAnswerSubmit={(index, answer, feedback) => {
               setSession(prev => {
                 const newAnswers = [...prev.answers];
                 const existingIdx = newAnswers.findIndex(a => a.questionIndex === index);
                 if (existingIdx > -1) newAnswers.splice(existingIdx, 1);
                 
                 newAnswers.push({
                   questionIndex: index,
                   userAnswer: answer,
                   feedback: feedback
                 });
                 return { ...prev, answers: newAnswers };
               });
             }}
           />
        )}

        {currentStep === 'summary' && (
          <div className="max-w-3xl mx-auto animate-fade-in space-y-8">
            <div className="text-center">
               <h2 className="text-3xl font-bold text-gray-900 mb-2">Preparation Complete!</h2>
               <p className="text-gray-600">
                 {user ? "Your session has been saved to History." : "Save this session by logging in."}
               </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
               <div className="flex items-center justify-between border-b border-gray-100 pb-6 mb-6">
                 <div>
                   <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Overall Match</div>
                   <div className="text-4xl font-bold text-primary">{session.analysis?.match_score}%</div>
                 </div>
                 <div className="text-right">
                   <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Interview Score</div>
                   <div className="text-4xl font-bold text-green-600">
                     {Math.round(session.answers.reduce((acc, curr) => acc + (curr.feedback?.score || 0), 0) / Math.max(1, session.answers.length) * 10)}%
                   </div>
                 </div>
               </div>

               <h3 className="font-bold text-xl text-gray-900 mb-4">Consolidated Action Items</h3>
               <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-red-500" /> Focus Areas & Fixes</h4>
                    {session.analysis?.recommendations.filter(r => r.priority === 'high').slice(0, 2).map((rec, i) => (
                      <div key={`res-${i}`} className="p-4 bg-red-50 rounded-lg text-red-900 text-sm border border-red-100">
                         <p className="font-medium mb-1">Resume: {rec.location}</p>
                         <p className="opacity-80">{rec.suggestion}</p>
                      </div>
                    ))}
                    {session.answers.flatMap(a => a.feedback?.improvements || []).slice(0, 2).map((imp, i) => (
                      <div key={`int-${i}`} className="p-4 bg-amber-50 rounded-lg text-amber-900 text-sm border border-amber-100">
                         <p className="font-medium mb-1">Interview Prep</p>
                         <p className="opacity-80">{imp}</p>
                      </div>
                    ))}
                 </div>

                 <div className="space-y-4">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2"><ThumbsUp className="w-5 h-5 text-green-600" /> What You Did Well</h4>
                    {session.answers.flatMap(a => a.feedback?.strengths || []).slice(0, 4).map((str, i) => (
                      <div key={`str-${i}`} className="p-4 bg-green-50 rounded-lg text-green-900 text-sm border border-green-100">
                         <p className="opacity-90">{str}</p>
                      </div>
                    ))}
                    {session.answers.length === 0 && (
                      <p className="text-gray-400 italic text-sm">Complete the mock interview to see your strengths!</p>
                    )}
                 </div>
               </div>

               <div className="mt-8 flex flex-col gap-4">
                 <div className="flex justify-center gap-4">
                   <button 
                     onClick={() => window.print()}
                     className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-2"
                   >
                     <Download className="w-4 h-4" /> Print Report
                   </button>
                   <button 
                     onClick={() => {
                       setSession({
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
                          answers: []
                        });
                        setCurrentStep('landing');
                     }}
                     className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                   >
                     Start New Analysis
                   </button>
                 </div>

                 {!user && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                      <h4 className="font-bold text-blue-900 mb-1">Don't lose your progress</h4>
                      <p className="text-sm text-blue-700 mb-3">Create a free account to save this analysis, resume, and cover letter.</p>
                      <button 
                        onClick={() => setShowAuthModal(true)}
                        className="w-full px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark shadow-sm"
                      >
                        Create Account to Save
                      </button>
                    </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);