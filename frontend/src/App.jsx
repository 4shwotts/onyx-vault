import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Import from './pages/Import';
import Settings from './pages/Settings';
import DemoStart from './pages/DemoStart';
import Privacy from './pages/Privacy';
import Disclaimer from './pages/Disclaimer';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import PageBackground from './components/PageBackground';
import CommandPalette from './components/CommandPalette';

export default function App() {
  return (
    <>
      <PageBackground />
      <BrowserRouter>
        <CommandPalette />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/signup" element={<Login key="signup" mode="signup" />} />
          <Route path="/demo" element={<DemoStart />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
