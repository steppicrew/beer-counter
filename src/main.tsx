import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { handleBackButton } from './lib/backButton';
import { storeSettled } from './store/storage';
import './styles/global.scss';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container');

// At load, not in a component: it outlives every sheet it closes.
handleBackButton();

// Usually loaded already. Restoring from the app's mirror takes a native call,
// and a tap on the empty state meanwhile would be lost in the restore.
void storeSettled.then(() =>
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
