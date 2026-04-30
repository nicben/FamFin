import { useEffect, useState } from "react";
import LoginScreen from "./LoginScreen";
import ExpenseDashboard from "./ExpenseDashboard";

const AUTH_STORAGE_KEY = "famfin-auth";

export default function ExpenseApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      setIsLoggedIn(true);
    }
  }, []);

  if (!isLoggedIn) {
    return <LoginScreen onSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <ExpenseDashboard
      onLogout={() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoggedIn(false);
      }}
    />
  );
}
