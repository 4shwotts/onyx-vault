import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts (SIL Open Font License), Latin subset only, just the
// weights the app uses.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-600.css';
import '@fontsource/orbitron/latin-700.css';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
