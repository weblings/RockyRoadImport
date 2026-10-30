// Dev-only page (npm run dev, /playground.html). Not part of the production build.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './ui/tokens/generated/tokens.css';
import './styles/base.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, Disclosure, FieldList, FieldNote, FileTrigger, Select, Slider, TextField } from './ui';

function Playground() {
    const [text, setText] = useState('Artist');
    const [file, setFile] = useState<string | null>(null);
    const [choice, setChoice] = useState('Vocals');
    const [level, setLevel] = useState(1);
    return (
        <main style={{ maxWidth: 480, margin: '2rem auto', display: 'grid', gap: '1.5rem' }}>
            <h1>src/ui playground</h1>
            <section>
                <h2>Button</h2>
                <Button>Default</Button> <Button variant="primary">Primary</Button> <Button isDisabled>Disabled</Button>
            </section>
            <FieldList>
                <TextField label="TextField" value={text} onChange={setText} />
                <FileTrigger label="FileTrigger" accept={['.ogg']} fileName={file} onSelect={(f) => setFile(f?.name ?? null)} />
                <FieldNote>*FieldNote text.</FieldNote>
                <Select label="Select" options={['Vocals', 'Backing', 'Harmony']} value={choice} onChange={setChoice} />
                <Slider label="Slider" min={0} max={5} step={0.5} value={level} onChange={setLevel} />
            </FieldList>
            <Disclosure title="Disclosure"><p>Panel content.</p></Disclosure>
            <Callout title="Callout"><p>Callout body.</p></Callout>
        </main>
    );
}

createRoot(document.getElementById('playground')!).render(<Playground />);
