import { Link, NavLink, Route, Routes } from "react-router-dom";
import ProblemsPage from "./pages/ProblemsPage";
import StudioPage from "./pages/StudioPage";
import AttemptPage from "./pages/AttemptPage";
import HistoryPage from "./pages/HistoryPage";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-title">LLD Practice</span>
          <span className="brand-sub">Design → Submit → Feedback → Improve</span>
        </Link>
        <nav>
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            Problems
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            History
          </NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ProblemsPage />} />
          <Route path="/problems/:slug" element={<StudioPage />} />
          <Route path="/attempts/:id" element={<AttemptPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
