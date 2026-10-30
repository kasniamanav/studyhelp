import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize theme attribute on html
const savedTheme = localStorage.getItem('studyai-theme') || 'system';
const rootEl = document.documentElement;
if (savedTheme === 'dark') {
  rootEl.setAttribute('data-theme', 'dark');
  rootEl.classList.add('dark');
} else if (savedTheme === 'light') {
  rootEl.setAttribute('data-theme', 'light');
  rootEl.classList.remove('dark');
} else {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    rootEl.classList.add('dark');
  } else {
    rootEl.classList.remove('dark');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

