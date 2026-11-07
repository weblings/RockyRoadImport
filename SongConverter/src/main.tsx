import './ui/fonts.css';
import './ui/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ribbon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('app')!).render(<App />);
