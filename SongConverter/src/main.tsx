import '@weblings/grille/fonts.css';
import '@weblings/grille/tokens.css';
import '@weblings/grille/ui.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ribbon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('app')!).render(<App />);
