"use client";

import { useState, useEffect } from "react";

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

interface MessageResponse {
  message: string;
  features: string[];
  timestamp: string;
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [consoleTitle, setConsoleTitle] = useState<string>("console.log");
  const [loading, setLoading] = useState<boolean>(false);

  const BACKEND_URL = "http://localhost:5001";

  // Check health on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`);
        if (res.ok) {
          setBackendStatus("online");
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    }
    checkHealth();
    
    // Set up polling interval to check status every 5 seconds
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFetchHealth = async () => {
    setLoading(true);
    setConsoleTitle("GET /api/health");
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`);
      if (res.ok) {
        const data = (await res.json()) as HealthResponse;
        setConsoleOutput(JSON.stringify(data, null, 2));
        setBackendStatus("online");
      } else {
        setConsoleOutput(`Error: Received status code ${res.status}`);
        setBackendStatus("offline");
      }
    } catch (err) {
      setConsoleOutput(
        `Fetch Error: Could not connect to backend server at ${BACKEND_URL}.\nDetails: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setBackendStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchMessage = async () => {
    setLoading(true);
    setConsoleTitle("GET /api/message");
    try {
      const res = await fetch(`${BACKEND_URL}/api/message`);
      if (res.ok) {
        const data = (await res.json()) as MessageResponse;
        setConsoleOutput(JSON.stringify(data, null, 2));
        setBackendStatus("online");
      } else {
        setConsoleOutput(`Error: Received status code ${res.status}`);
        setBackendStatus("offline");
      }
    } catch (err) {
      setConsoleOutput(
        `Fetch Error: Could not connect to backend server at ${BACKEND_URL}.\nDetails: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setBackendStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  const clearConsole = () => {
    setConsoleOutput("");
    setConsoleTitle("console.log");
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-text">CODESETU</div>
        </div>
        <div className="status-badge">
          <span 
            className={`status-indicator ${
              backendStatus === "checking" 
                ? "status-offline" 
                : backendStatus === "online" 
                  ? "status-online" 
                  : "status-offline"
            }`}
            aria-label={
              backendStatus === "checking" 
                ? "Checking server status..." 
                : backendStatus === "online" 
                  ? "Server is online" 
                  : "Server is offline"
            }
          />
          <span>
            {backendStatus === "checking" && "Checking Server..."}
            {backendStatus === "online" && "Backend API: Online"}
            {backendStatus === "offline" && "Backend API: Offline"}
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">Bridge Frontend &amp; Backend</h1>
        <p className="hero-subtitle">
          Welcome to your codesetu project. This premium development workspace orchestrates a Next.js client app and an Express.js server app using Turborepo.
        </p>
      </section>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Control Card */}
        <div className="card">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            API Control Panel
          </h2>
          <p className="card-desc">
            Interact with the ExpressJS backend API. Trigger asynchronous fetch operations and inspect real-time responses inside the console viewer.
          </p>
          <div className="button-group">
            <button 
              className="btn btn-primary" 
              onClick={handleFetchMessage}
              disabled={loading}
              id="fetch-message-btn"
            >
              {loading && consoleTitle === "GET /api/message" ? "Fetching..." : "Fetch Welcome Message"}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleFetchHealth}
              disabled={loading}
              id="fetch-health-btn"
            >
              {loading && consoleTitle === "GET /api/health" ? "Checking..." : "Trigger Health Check"}
            </button>
          </div>
          <div className="card-desc" style={{ marginTop: "auto", fontSize: "0.85rem", borderTop: "1px solid rgba(63, 63, 70, 0.2)", paddingTop: "1rem" }}>
            💡 Run <code>pnpm dev</code> in your terminal to start the Express server on port 5001.
          </div>
        </div>

        {/* Output Card */}
        <div className="card" style={{ gap: "1rem" }}>
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            API Console output
          </h2>
          <div className="console-wrapper">
            <div className="console-header">
              <div className="console-dots">
                <span className="console-dot dot-red" />
                <span className="console-dot dot-yellow" />
                <span className="console-dot dot-green" />
              </div>
              <span style={{ fontSize: "0.8rem", textTransform: "lowercase", letterSpacing: "0.05em" }}>{consoleTitle}</span>
              {consoleOutput && (
                <button 
                  onClick={clearConsole} 
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  Clear
                </button>
              )}
            </div>
            {consoleOutput ? (
              <pre className="console-content"><code>{consoleOutput}</code></pre>
            ) : (
              <div className="console-placeholder">
                Waiting for API requests... Click one of the buttons on the left to query the backend.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Monorepo Architecture */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2 className="arch-section-title">Monorepo Workspace Architecture</h2>
        <div className="arch-grid">
          <div className="arch-card">
            <div className="arch-card-header">
              <span>Frontend App</span>
              <span className="arch-badge">Next.js 16</span>
            </div>
            <span className="arch-path">apps/web</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              React web application serving the landing interface at port 3000.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <span>Backend App</span>
              <span className="arch-badge arch-badge-blue">ExpressJS</span>
            </div>
            <span className="arch-path">apps/server</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              TypeScript API server serving requests at port 5001.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <span>UI Components</span>
              <span className="arch-badge arch-badge-green">Shared Package</span>
            </div>
            <span className="arch-path">packages/ui</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              Local design system tokens and component stubs shared by all workspace apps.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Codesetu Monorepo &bull; Orchestrated via <a href="https://turborepo.dev" target="_blank" rel="noopener noreferrer" className="footer-link">Turborepo</a> &bull; Powered by pnpm workspaces</p>
      </footer>
    </div>
  );
}
