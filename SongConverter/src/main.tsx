import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './ui/tokens/generated/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ribbon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('app')!).render(<App />);
