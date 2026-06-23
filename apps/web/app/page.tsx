"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import PipelineAnimation from "./_components/pipeline-animation";
import { StageIconDispatcher } from "./_components/stage-icons";
import { UserResponse } from "@repo/schemas";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

const PIPELINE_LABELS = [
  { id: "idea", text: "Idea", desc: "Describe what you want to build in plain text." },
  { id: "document", text: "Document", desc: "AI automatically drafts a complete PRD spec." },
  { id: "tasks", text: "Tasks", desc: "PRD is broken down into structured task items." },
  { id: "code", text: "Code", desc: "AI sandbox agent writes and commits the code." },
  { id: "review", text: "Review", desc: "Automated review, lint checks, and CI gates." },
  { id: "release", text: "Release", desc: "App merges and deploys to production." },
];

export default function Home() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectIdea, setProjectIdea] = useState("");
  
  // Profile update form states
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  // Fetch session user
  const fetchSession = useCallback(async () => {
    addLog("GET /api/auth/me - Initiating credentials-based session fetch...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.data?.user) {
          const fetchedUser: UserResponse = json.data.user;
          setUser(fetchedUser);
          setEditName(fetchedUser.name);
          setEditImage(fetchedUser.image || "");
          addLog(`GET /api/auth/me - Authenticated successfully as ${fetchedUser.name} (${fetchedUser.email})`);
        } else {
          setUser(null);
          addLog("GET /api/auth/me - No active session found. User is anonymous.");
        }
      } else {
        setUser(null);
        addLog(`GET /api/auth/me - Failed with status ${res.status}. Active session check cleared.`);
      }
    } catch {
      setUser(null);
      addLog(`GET /api/auth/me - Failed due to network connection error. Ensure backend is running.`);
    } finally {
      setLoadingUser(false);
    }
  }, [addLog]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Scroll console terminal to bottom when new logs are added
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Trigger Google Login
  const handleGoogleLogin = () => {
    addLog("Redirecting to Google OAuth Provider redirect handshake...");
    const redirectUrl = `${BACKEND_URL}/api/auth/login/social?provider=google&callbackURL=${encodeURIComponent(FRONTEND_URL)}`;
    window.location.href = redirectUrl;
  };

  // Sign out session
  const handleSignOut = async () => {
    addLog("POST /api/auth/sign-out - Cleansing active session authorization cookies...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        addLog("POST /api/auth/sign-out - Signed out successfully. Session purged.");
      } else {
        addLog(`POST /api/auth/sign-out - Sign out failed with status ${res.status}.`);
      }
    } catch {
      addLog("POST /api/auth/sign-out - Network error while signing out. Cleared local state.");
      setUser(null);
    }
  };

  // Profile update submit
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setUpdating(true);
    setUpdateMsg("");
    addLog(`PUT /api/auth/profile - Initiating profile update request payload...`);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: editName,
          image: editImage || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        const updatedUser: UserResponse = json.data.user;
        setUser(updatedUser);
        setEditName(updatedUser.name);
        setEditImage(updatedUser.image || "");
        setUpdateMsg("Profile updated successfully!");
        addLog(`PUT /api/auth/profile - Succeeded! User updated to name: "${updatedUser.name}" image: "${updatedUser.image}"`);
      } else {
        const errorDetail = json.message || "Unknown error";
        setUpdateMsg(`Error: ${errorDetail}`);
        addLog(`PUT /api/auth/profile - Rejected with validation message: "${errorDetail}"`);
      }
    } catch {
      setUpdateMsg("Network error updating profile.");
      addLog(`PUT /api/auth/profile - Network communication failure.`);
    } finally {
      setUpdating(false);
    }
  };

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
      }
    };
    if (modalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  return (
    <div className="w-full min-h-screen notebook-paper flex flex-col relative select-none pb-20">
      
      {/* TOP NAVIGATION BAR */}
      <nav className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-hand-title text-3xl font-bold tracking-tight text-[#2D2D2D]">
            Code<span className="highlight-yellow">Setu</span>
          </span>
        </div>
        
        {/* Nav Links (Desktop) */}
        <div className="hidden md:flex items-center gap-8 font-hand-body text-lg font-bold text-[#4D4D4D]">
          <a href="#pipeline" className="hover:text-[#2D2D2D] relative group">
            How It Works
            <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-[#FDE047] transition-all group-hover:w-full" />
          </a>
          <a href="#features" className="hover:text-[#2D2D2D] relative group">
            Features Checklist
            <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-[#BFDBFE] transition-all group-hover:w-full" />
          </a>
          <a href="#sandbox" className="hover:text-[#2D2D2D] relative group">
            Developer Sandbox
            <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-[#E9D5FF] transition-all group-hover:w-full" />
          </a>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          {loadingUser ? (
            <span className="font-hand-body text-[#7D7D7D] animate-pulse">Checking credentials...</span>
          ) : user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border border-dashed border-[#2D2D2D]/60 rounded-full px-2.5 py-1 bg-[#FFFFFF] shadow-sm">
                {/* User avatar bypass ESLint image warning for dynamically external image urls */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.image || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(user.name)}`}
                  alt=""
                  className="w-6 h-6 rounded-full border border-[#2D2D2D]"
                  referrerPolicy="no-referrer"
                />
                <span className="font-hand-body text-md font-bold text-[#2D2D2D]">
                  Hi, {user.name.split(" ")[0]}!
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="font-hand-title font-bold text-lg px-4 py-1 rounded hover:bg-black/5 transition-colors text-[#2D2D2D]"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setModalOpen(true)}
                className="font-hand-title font-bold text-lg px-4 py-1.5 rounded hover:bg-black/5 transition-colors text-[#2D2D2D]"
              >
                Sign In
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="wobbly-border-btn bg-[#FDE047] font-hand-title font-bold text-lg px-5 py-1.5 text-[#2D2D2D]"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* MAIN HERO CONTENT */}
      <main className="w-full max-w-5xl mx-auto px-6 mt-10 flex flex-col items-center relative">
        
        {/* Badge */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-2 border-2 border-dashed border-[#2D2D2D]/60 rounded-full px-4 py-1 font-hand-body text-md font-bold text-[#4D4D4D] bg-[#FFFFFF]/70">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
            Zero to Production — Powered by AI
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-hand-title text-center text-5xl md:text-7xl font-bold leading-none max-w-4xl text-[#2D2D2D]">
          From <span className="highlight-yellow">Spark</span> to <span className="highlight-pink">Ship</span>, Entirely Automated
        </h1>

        {/* Subheading */}
        <p className="font-hand-body text-center text-lg md:text-2xl mt-6 max-w-2xl text-[#4D4D4D] leading-relaxed">
          CodeSetu is an AI-powered pipeline that drafts specs, schedules tasks, codes inside isolated sandboxes, performs reviews, and deploys to production.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          {user ? (
            <a
              href="#sandbox"
              className="wobbly-border-btn bg-[#FDE047] font-hand-title font-bold text-xl px-8 py-3 text-[#2D2D2D] inline-block text-center"
            >
              Go to Sandbox
            </a>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="wobbly-border-btn bg-[#FDE047] font-hand-title font-bold text-xl px-8 py-3 text-[#2D2D2D]"
            >
              Create Your Pipeline
            </button>
          )}
          <a
            href="#pipeline"
            className="wobbly-border-btn bg-[#E9D5FF] font-hand-title font-bold text-xl px-8 py-3 text-[#2D2D2D] inline-block text-center"
          >
            See How It Works
          </a>
        </div>

        {/* MASCOT AND SPEECH BUBBLE */}
        <div className="w-full max-w-5xl flex items-start gap-4 mt-12 mb-2 px-4 md:px-0">
          {/* Mascot Pencil */}
          <svg width="55" height="75" viewBox="0 0 60 80" className="flex-shrink-0 animate-wiggle" aria-hidden="true">
            <path d="M15,10 L45,10 L40,65 L20,65 Z" fill="#FDE047" stroke="#2D2D2D" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M15,10 C15,3 45,3 45,10 Z" fill="#FECACA" stroke="#2D2D2D" strokeWidth="2.2" />
            <rect x="14.5" y="8" width="31" height="5" fill="#C9C9C9" stroke="#2D2D2D" strokeWidth="2.2" />
            <path d="M20,65 L30,78 L40,65 Z" fill="#EADFCA" stroke="#2D2D2D" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M27,74 L30,78 L33,74 Z" fill="#2D2D2D" />
            <circle cx="25" cy="30" r="2.5" fill="#2D2D2D" />
            <circle cx="35" cy="30" r="2.5" fill="#2D2D2D" />
            <circle cx="21" cy="34" r="2.2" fill="#FCA5A5" />
            <circle cx="39" cy="34" r="2.2" fill="#FCA5A5" />
            <path d="M28,38 Q30,41 32,38" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" />
            <path d="M15,40 Q5,42 8,50" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" />
            <path d="M45,40 Q55,42 52,50" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" />
          </svg>
          
          {/* Bubble */}
          <div className="speech-bubble speech-bubble-left font-hand-body text-md md:text-lg font-bold text-[#2D2D2D] leading-snug">
            &ldquo;Hi! I am <span className="highlight-yellow">SetuBot</span>! Fill in your project specifications, and my paper plane will fly through the pipeline to build your app!&rdquo;
          </div>
        </div>

        {/* PIPELINE ANIMATION CARD CONTAINER */}
        <section id="pipeline" className="w-full max-w-5xl mt-12 mb-12 relative scroll-mt-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-hand-title text-center text-3xl md:text-4xl font-bold text-[#2D2D2D] mb-2"
          >
            — From Idea to Production —
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-hand-body text-center text-md md:text-lg text-[#6D6D6D] mb-8"
          >
            Watch a single spark glide through every stage of the pipeline.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full relative"
          >
            <PipelineAnimation />
          </motion.div>
        </section>

        {/* SANDBOX & LOGS REAL INTERACTIVE WORKSPACE */}
        <section id="sandbox" className="w-full max-w-5xl mt-12 scroll-mt-20">
          <h2 className="font-hand-title text-center text-4xl font-bold text-[#2D2D2D] mb-8">
            Developer Sandbox
          </h2>
          
          <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
            
            {/* LEFT PROFILE CARD (Real interactive dashboard or google call to action) */}
            <div className="flex-1 paper-card p-6 md:p-8 flex flex-col justify-between relative bg-white">
              <div className="washi-tape -top-5 left-10" />
              
              {!user ? (
                <div className="flex flex-col items-center justify-center text-center py-10 h-full">
                  <div className="w-16 h-16 rounded-full bg-[#BFDBFE] border-2 border-[#2D2D2D] flex items-center justify-center mb-6">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h3 className="font-hand-title text-3xl font-bold text-[#2D2D2D] mb-3">
                    Unlock Your Build Pipeline
                  </h3>
                  <p className="font-hand-body text-md text-[#6D6D6D] max-w-sm mb-6 leading-relaxed">
                    Connect via Google OAuth to create a real developer workspace, edit profile data, and trace network responses in the debugger terminal.
                  </p>
                  
                  <button
                    onClick={handleGoogleLogin}
                    className="wobbly-border-btn bg-[#FDE047] font-hand-title font-bold text-xl px-6 py-2.5 flex items-center justify-center gap-3 text-[#2D2D2D]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-[#2D2D2D]" strokeWidth="2.5">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                      <path d="M12 8.5v3.5h5.5c-.3 1.5-1.5 3-5.5 3-3 0-5.5-2.5-5.5-5.5s2.5-5.5 5.5-5.5c1.7 0 3 1 3.5 1.5" />
                    </svg>
                    Continue with Google
                  </button>
                </div>
              ) : (
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h3 className="font-hand-title text-3xl font-bold text-[#2D2D2D] mb-6 pb-2 border-b border-dashed border-[#2D2D2D]/20">
                      Workspace Profile
                    </h3>
                    
                    {/* User display details */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.image || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(user.name)}`}
                        alt=""
                        className="w-16 h-16 rounded-full border-2 border-[#2D2D2D] shadow"
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-center sm:text-left">
                        <p className="font-hand-title text-2xl font-bold text-[#2D2D2D]">{user.name}</p>
                        <p className="font-hand-body text-md text-[#7D7D7D]">{user.email}</p>
                        <p className="font-hand-body text-xs text-[#9D9D9D]">
                          Joined: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Edit Form */}
                    <form onSubmit={handleProfileUpdate} className="flex flex-col gap-4">
                      <div className="flex flex-col">
                        <label htmlFor="name-input" className="font-hand-body font-bold text-lg mb-1">
                          Display Name:
                        </label>
                        <input
                          id="name-input"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full wobbly-border-sm px-4 py-2 font-hand-body text-lg bg-[#FDF9F1] focus:bg-[#FFFFFF]"
                          required
                        />
                      </div>

                      <div className="flex flex-col">
                        <label htmlFor="image-input" className="font-hand-body font-bold text-lg mb-1">
                          Avatar URL:
                        </label>
                        <input
                          id="image-input"
                          type="url"
                          placeholder="https://..."
                          value={editImage}
                          onChange={(e) => setEditImage(e.target.value)}
                          className="w-full wobbly-border-sm px-4 py-2 font-hand-body text-lg bg-[#FDF9F1] focus:bg-[#FFFFFF]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={updating}
                        className="wobbly-border-btn bg-[#FEF08A] py-2 text-lg font-bold font-hand-title text-[#2D2D2D] mt-2 disabled:opacity-50"
                      >
                        {updating ? "Saving Changes..." : "Save Workspace Changes"}
                      </button>

                      {updateMsg && (
                        <p className="font-hand-body text-center text-sm font-bold mt-1 text-[#2D2D2D] bg-[#D1FAE5] border-2 border-dashed border-[#10B981] p-1.5 rounded">
                          {updateMsg}
                        </p>
                      )}
                    </form>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="wobbly-border-btn bg-[#FECACA] font-hand-title font-bold text-lg py-2 text-[#2D2D2D] mt-6 w-full"
                  >
                    Terminate Sandbox Session
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT LOGS TERMINAL */}
            <div className="flex-1 console-wrapper flex flex-col justify-between min-h-[380px] bg-white">
              <div>
                <div className="flex items-center justify-between border-b border-dashed border-[#2D2D2D]/20 pb-3 mb-3">
                  <div className="console-dots">
                    <span className="console-dot dot-red" />
                    <span className="console-dot dot-yellow" />
                    <span className="console-dot dot-green" />
                  </div>
                  <span className="font-hand-title text-lg font-bold text-[#4D4D4D]">
                    Workspace Sandbox Console
                  </span>
                </div>

                <div 
                  className="font-mono text-sm text-[#2D2D2D] leading-relaxed max-h-[360px] overflow-y-auto px-1 flex flex-col gap-1.5"
                  style={{ wordBreak: "break-all" }}
                >
                  {logs.length === 0 ? (
                    <span className="text-[#9D9D9D] italic font-hand-body text-lg">
                      Console idle. Interactions will spawn workspace compile traces...
                    </span>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className="border-b border-[#2D2D2D]/5 pb-1">
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-2 border-t border-dashed border-[#2D2D2D]/20">
                <button
                  onClick={() => {
                    setLogs([]);
                    addLog("Console log buffer cleared.");
                  }}
                  className="font-hand-title font-bold text-md px-3 py-1 hover:bg-black/5 rounded text-[#7D7D7D] transition-colors"
                >
                  Clear Console
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* GRID OF PIPELINE STEPS */}
        <section id="features" className="w-full max-w-5xl mt-16 scroll-mt-20">
          <h2 className="font-hand-title text-center text-4xl font-bold text-[#2D2D2D] mb-10">
            Pipeline Stages Breakdown
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PIPELINE_LABELS.map((item, idx) => (
              <div
                key={idx}
                className="paper-card p-6 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform"
                style={{
                  transform: `rotate(${idx % 2 === 0 ? "1deg" : "-1deg"})`,
                }}
              >
                <div 
                  className="w-14 h-14 rounded-full border-2 border-[#2D2D2D] flex items-center justify-center mb-4 shadow-sm"
                  style={{
                    backgroundColor: idx % 3 === 0 ? "#FEF08A" : idx % 3 === 1 ? "#BFDBFE" : "#E9D5FF",
                  }}
                >
                  <StageIconDispatcher stage={item.id} size={30} />
                </div>
                
                <h3 className="font-hand-title text-2xl font-bold text-[#2D2D2D] mb-2">
                  {item.text}
                </h3>
                
                <p className="font-hand-body text-md text-[#4D4D4D] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECURITY AND INTEGRATION DETAILS STICKY NOTES */}
        <section className="w-full max-w-4xl mt-16 flex flex-col md:flex-row gap-6 justify-center">
          
          {/* Blue Note */}
          <div className="sticky-note p-6 flex-1 max-w-md relative">
            <div className="washi-tape washi-tape-yellow -top-4 left-6" />
            <h3 className="font-hand-title text-2xl font-bold text-[#2D2D2D] mb-3 border-b border-dashed border-[#2D2D2D]/30 pb-1">
              Managed Security
            </h3>
            <p className="font-hand-body text-md text-[#333333] leading-relaxed">
              - <strong>Postgres Row Level Security (RLS)</strong>: Restricts cross-tenant database reads.<br />
              - <strong>Strict sandbox compilation</strong>: Builds execute in sealed E2B secure containers.
            </p>
          </div>

          {/* Yellow Note */}
          <div className="sticky-note p-6 flex-1 max-w-md relative bg-[#FEF9C3]" style={{ transform: "rotate(-1.5deg)" }}>
            <div className="washi-tape -top-4 right-8" />
            <h3 className="font-hand-title text-2xl font-bold text-[#2D2D2D] mb-3 border-b border-dashed border-[#2D2D2D]/30 pb-1">
              Infrastructure
            </h3>
            <p className="font-hand-body text-md text-[#333333] leading-relaxed">
              - <strong>Inngest orchestration</strong>: Powering durable pipeline step functions.<br />
              - <strong>GitHub App integration</strong>: Automatically commits code and starts CI checks.
            </p>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full text-center mt-20 font-hand-body text-md text-[#7D7D7D] z-10">
        <p>&copy; {new Date().getFullYear()} CodeSetu. Hand-drawn using Next.js + TailwindCSS + Motion.</p>
      </footer>

      {/* MODAL DIALOG POPUP: TAPED PAPER FORM */}
      <AnimatePresence>
        {modalOpen && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#2D2D2D]/40 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />

            {/* Modal Content Paper Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotate: -4 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="paper-card w-full max-w-md p-6 md:p-8 bg-[#FFFFFF] relative z-10 shadow-2xl"
            >
              {/* Pink torn tape top-left */}
              <div className="washi-tape -top-5 left-10" />
              {/* Yellow torn tape top-right */}
              <div className="washi-tape washi-tape-yellow -top-4 right-12" />

              {/* Close Button */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 font-hand-title text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[#2D2D2D]"
                aria-label="Close form modal"
              >
                ✕
              </button>

              <h2 id="modal-title" className="font-hand-title text-3xl font-bold text-[#2D2D2D] mb-6 pb-2 border-b border-dashed border-[#2D2D2D]/20 mt-2">
                Ignite Your Pipeline
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <label htmlFor="modal-idea-input" className="font-hand-body font-bold text-lg mb-1">
                    What project spark do you want to build?
                  </label>
                  <textarea
                    id="modal-idea-input"
                    rows={3}
                    placeholder="E.g., An Express API that compiles code templates or a Markdown blog with wobbly styling..."
                    value={projectIdea}
                    onChange={(e) => setProjectIdea(e.target.value)}
                    className="w-full wobbly-border-sm px-4 py-2 font-hand-body text-lg bg-[#FDF9F1] focus:bg-[#FFFFFF] resize-none"
                  />
                </div>

                <p className="font-hand-body text-sm text-[#7D7D7D] leading-relaxed">
                  To initialize a real sandbox environment and commit pipeline scripts, we require connecting with Google OAuth.
                </p>

                {/* Google Connection Action */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full wobbly-border-btn bg-[#FDE047] py-3 text-xl font-bold font-hand-title flex items-center justify-center gap-3 text-[#2D2D2D]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-[#2D2D2D]" strokeWidth="2.5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M12 8.5v3.5h5.5c-.3 1.5-1.5 3-5.5 3-3 0-5.5-2.5-5.5-5.5s2.5-5.5 5.5-5.5c1.7 0 3 1 3.5 1.5" />
                  </svg>
                  Connect with Google
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

