import { useState } from "react";

const AUTH_STORAGE_KEY = "famfin-auth";
const VALID_USERNAME = "BenduVollan";
const VALID_PASSWORD = "qwer1234";

type Props = {
  onSuccess: () => void;
};

export default function LoginScreen({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username }));
      onSuccess();
    } else {
      setLoginError("Ugyldig brukernavn eller passord");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vw, 32px)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "clamp(24px, 5vw, 40px)",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
        }}
      >
        <h1 style={{ marginBottom: 24, textAlign: "center" }}>FamFin</h1>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", gap: 16, flexDirection: "column" }}
        >
          <input
            placeholder="Brukernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Logg inn</button>

          {loginError && (
            <div style={{ color: "#dc2626", textAlign: "center" }}>
              {loginError}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
