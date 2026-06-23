"use client";

import { useState, useEffect } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [user, setUser] = useState<User | null>(null);
  const [newName, setNewName] = useState<string>("");
  const [consoleEntry, setConsoleEntry] = useState<{ title: string; output: string }>({ title: "console.log", output: "" });
  const [activeAction, setActiveAction] = useState<"sign-out" | "update-profile" | "fetch-message" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function checkStatus() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`, { signal });
        setBackendStatus(res.ok ? "online" : "offline");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setBackendStatus("offline");
      }
    }

    async function checkSession() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/me`, { credentials: "include", signal });
        if (res.ok) {
          const data = await res.json();
          setUser(data.data.user);
          setNewName(data.data.user.name);
        } else {
          setUser(null);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setUser(null);
      }
    }

    checkStatus();
    checkSession();

    return () => controller.abort();
  }, []);

  const handleSignIn = () => {
    window.location.href = `${BACKEND_URL}/api/auth/signin/social?provider=google&callbackURL=${FRONTEND_URL}`;
  };

  const handleSignOut = async () => {
    setActiveAction("sign-out");
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        setConsoleEntry({ title: "sign-out", output: JSON.stringify({ status: "success", message: "Logged out successfully" }, null, 2) });
      } else {
        setConsoleEntry({ title: "sign-out", output: `Error: ${res.statusText}` });
      }
    } catch (err) {
      setConsoleEntry({ title: "sign-out", output: `Error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setActiveAction(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setActiveAction("update-profile");
    setConsoleEntry({ title: "PUT /api/user/profile", output: "" });
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.data.user);
      }
      setConsoleEntry({ title: "PUT /api/user/profile", output: JSON.stringify(data, null, 2) });
    } catch (err) {
      setConsoleEntry({ title: "PUT /api/user/profile", output: `Error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setActiveAction(null);
    }
  };

  const handleFetchMessage = async () => {
    setActiveAction("fetch-message");
    setConsoleEntry({ title: "GET /api/message", output: "" });
    try {
      const res = await fetch(`${BACKEND_URL}/api/message`);
      const output = res.ok
        ? JSON.stringify(await res.json(), null, 2)
        : `Error: ${res.status}`;
      setConsoleEntry({ title: "GET /api/message", output });
    } catch (err) {
      setConsoleEntry({ title: "GET /api/message", output: `Error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setActiveAction(null);
    }
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
              backendStatus === "online" ? "status-online" : "status-offline"
            }`}
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
        <h1 className="hero-title">Google OAuth &amp; Shared Schemas</h1>
        <p className="hero-subtitle">
          Secure, modern authentication using Better Auth for Google OAuth, connected to Neon Postgres, validated via shared Zod schemas.
        </p>
      </section>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Left Card: Authentication controls */}
        <div className="card">
          {!user ? (
            <>
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <polyline points="17 11 19 13 23 9" />
                </svg>
                Secure Login Panel
              </h2>
              <p className="card-desc">
                Sign in securely via Google OAuth to access protected endpoints and update your developer profile.
              </p>
              <div className="button-group">
                <button
                  className="btn btn-primary"
                  onClick={handleSignIn}
                  disabled={backendStatus !== "online" || activeAction !== null}
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <button className="btn btn-secondary" onClick={handleFetchMessage} disabled={activeAction !== null}>
                  {activeAction === "fetch-message" ? "Fetching..." : "Fetch Public Message"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="card-title">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name}
                    style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid var(--accent-purple)" }}
                  />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
                Welcome, {user.name}!
              </h2>
              <p className="card-desc">
                Email: <strong>{user.email}</strong> <br />
                Account Created: {new Date(user.createdAt).toLocaleDateString()}
              </p>

              <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label htmlFor="name-input" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Update Display Name (Validated using shared Zod schema)
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    id="name-input"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "4px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--card-border)",
                      color: "#fff",
                      fontSize: "0.9rem",
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }} disabled={activeAction !== null}>
                    {activeAction === "update-profile" ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>

              <div className="button-group" style={{ marginTop: "1rem" }}>
                <button className="btn btn-secondary" onClick={handleSignOut} disabled={activeAction !== null}>
                  {activeAction === "sign-out" ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Card: Console/JSON Output */}
        <div className="card">
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
              <span style={{ fontSize: "0.8rem", textTransform: "lowercase", letterSpacing: "0.05em" }}>{consoleEntry.title}</span>
            </div>
            {consoleEntry.output ? (
              <pre className="console-content"><code>{consoleEntry.output}</code></pre>
            ) : (
              <div className="console-placeholder">
                API request/response payloads will be printed here. Try logging in or fetching endpoints.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Monorepo Architecture Graph */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2 className="arch-section-title">Codesetu Shared Workspace Integration</h2>
        <div className="arch-grid">
          <div className="arch-card">
            <div className="arch-card-header">
              <span>Validation Schemas</span>
              <span className="arch-badge arch-badge-green">@repo/schemas</span>
            </div>
            <span className="arch-path">packages/schemas</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              Contains shared Zod validators for inputs (like profile update) and output serialization schemas (like UserResponse), preventing code replication.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <span>Neon DB Layer</span>
              <span className="arch-badge arch-badge-blue">@repo/database</span>
            </div>
            <span className="arch-path">packages/database</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              Encapsulates the Neon PostgreSQL connection pool and exports Drizzle schema entities for modular, centralized data operations.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-card-header">
              <span>API Gateway</span>
              <span className="arch-badge">server</span>
            </div>
            <span className="arch-path">apps/server</span>
            <p className="card-desc" style={{ fontSize: "0.875rem" }}>
              Integrates Better Auth Express handlers, handles cookies, and mounts profile controllers validating models via Zod.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
