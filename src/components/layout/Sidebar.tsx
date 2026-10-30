import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Home,
  FileText,
  Lightbulb,
  CheckSquare,
  Timer,
  Layers,
  Presentation,
  MessageSquare,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/materials', label: 'Study Materials', icon: FileText },
  { path: '/explainer', label: 'AI Explainer', icon: Lightbulb },
  { path: '/quiz', label: 'Quiz', icon: CheckSquare },
  { path: '/mock', label: 'Mock Tests', icon: Timer },
  { path: '/flashcards', label: 'Flashcards', icon: Layers },
  { path: '/presentation', label: 'Presentation', icon: Presentation },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 border-r border-border p-4 gap-1 min-h-screen bg-card"
      aria-label="Sidebar navigation"
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-3 py-3 mb-3 cursor-pointer"
        onClick={() => navigate('/dashboard')}
      >
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-xl font-bold tracking-tight text-primary">StudyAI</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-link w-full text-left justify-start ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile & Logout */}
      <div className="pt-4 border-t border-border mt-auto">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate text-foreground">
              {profile?.display_name || user?.email?.split('@')[0] || 'Student'}
            </p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

