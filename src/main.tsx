import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import {initTheme} from './utils/theme';

// Pose data-theme sur <html> AVANT le premier rendu : sans cela l'écran
// flasherait en blanc le temps que React monte.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
