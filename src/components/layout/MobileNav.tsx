import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from './Sidebar';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Menu,
  X,
  Sparkles,
  LogOut,
  Home,
  FileText,
  Lightbulb,
  CheckSquare,
  MoreHorizontal,
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const primaryTabs = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/materials', label: 'Notes', icon: FileText },
    { path: '/explainer', label: 'Explain', icon: Lightbulb },
    { path: '/quiz', label: 'Quiz', icon: CheckSquare },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-lg text-primary">StudyAI</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex items-center justify-around py-2 px-1 z-30 pb-safe"
        aria-label="Mobile bottom navigation"
      >
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium text-muted hover:text-foreground"
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Slide-out Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative ml-auto w-3/4 max-w-xs h-full bg-card p-4 flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <span className="font-bold text-foreground">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setDrawerOpen(false);
                    }}
                    className={`nav-link w-full text-left justify-start ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-border mt-auto">
              <div className="flex items-center justify-between py-2">
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate text-foreground">
                    {profile?.display_name || user?.email?.split('@')[0] || 'Student'}
                  </p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    signOut();
                    setDrawerOpen(false);
                  }}
                  className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

