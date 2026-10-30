import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import {
  User,
  Moon,
  Sun,
  Laptop,
  Sliders,
  Download,
  Trash2,
  AlertTriangle,
  Save,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme, addToast } = useUIStore();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    profile?.default_difficulty || 'medium'
  );
  const [defaultExplainLevel, setDefaultExplainLevel] = useState<
    'beginner' | 'simple' | 'detailed' | 'exam'
  >(profile?.default_explain_level || 'simple');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setDefaultDifficulty(profile.default_difficulty || 'medium');
      setDefaultExplainLevel(profile.default_explain_level || 'simple');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: displayName.trim(),
          theme,
          default_difficulty: defaultDifficulty,
          default_explain_level: defaultExplainLevel,
        });

      if (error) throw error;
      await refreshProfile();
      addToast('Settings saved successfully!');
    } catch (err: any) {
      addToast(err.message || 'Error saving settings', false);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      // Fetch all user rows across tables
      const [mats, quizzes, decks, presentations, threads] = await Promise.all([
        supabase.from('materials').select('*').eq('user_id', user.id),
        supabase.from('quiz_attempts').select('*').eq('user_id', user.id),
        supabase.from('flashcard_decks').select('*').eq('user_id', user.id),
        supabase.from('presentations').select('*').eq('user_id', user.id),
        supabase.from('chat_threads').select('*, chat_messages(*)').eq('user_id', user.id),
      ]);

      const exportBundle = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          profile,
        },
        materials: mats.data || [],
        quizAttempts: quizzes.data || [],
        flashcardDecks: decks.data || [],
        presentations: presentations.data || [],
        chatThreads: threads.data || [],
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `studyai_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      addToast('Data export downloaded!');
    } catch (err: any) {
      addToast(err.message || 'Export failed', false);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccountData = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'Are you absolutely sure? This will permanently delete all your materials, quiz records, flashcards, and conversations.'
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      // Delete user data across tables
      await supabase.from('materials').delete().eq('user_id', user.id);
      await supabase.from('quiz_attempts').delete().eq('user_id', user.id);
      await supabase.from('flashcard_decks').delete().eq('user_id', user.id);
      await supabase.from('presentations').delete().eq('user_id', user.id);
      await supabase.from('chat_threads').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      addToast('All user data wiped.');
      await signOut();
    } catch (err: any) {
      addToast(err.message || 'Could not delete data', false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account & App Settings</h1>
        <p className="text-sm text-muted">Manage your preferences, appearance, default AI levels, and data.</p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Card */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Profile
          </h2>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email</label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800"
            />
          </div>
        </div>

        {/* Appearance / Theme */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Appearance
          </h2>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Laptop },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as any)}
                    className={`btn-o py-3 flex flex-col items-center justify-center gap-1.5 ${
                      isSelected ? '!bg-primary !text-white !border-primary' : ''
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Study Defaults */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Study Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Default Difficulty</label>
              <select
                value={defaultDifficulty}
                onChange={(e) => setDefaultDifficulty(e.target.value as any)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Default Explain Depth</label>
              <select
                value={defaultExplainLevel}
                onChange={(e) => setDefaultExplainLevel(e.target.value as any)}
              >
                <option value="beginner">Beginner</option>
                <option value="simple">Simple</option>
                <option value="detailed">Detailed</option>
                <option value="exam">Exam Focus</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn text-sm py-2 px-5 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Data Management & Export */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" /> Data Management
        </h2>
        <p className="text-xs text-muted">
          Download a complete backup of your study materials, quiz attempts, and AI notes.
        </p>

        <button
          onClick={handleExportData}
          disabled={exporting}
          className="btn-o text-xs py-2 px-4 flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-primary" />
          {exporting ? 'Preparing export…' : 'Export All Data (JSON)'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card p-5 space-y-3 border-red-200 dark:border-red-900/40 bg-red-500/5">
        <h2 className="font-semibold text-base text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h2>
        <p className="text-xs text-muted">
          Permanently delete all materials, quiz results, decks, and chat sessions. This action cannot be undone.
        </p>

        <button
          onClick={handleDeleteAccountData}
          disabled={deleting}
          className="btn-o text-xs py-2 px-4 text-red-600 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? 'Deleting data…' : 'Delete Account & Wipe Data'}
        </button>
      </div>
    </div>
  );
};
