import { Button, Callout, Disclosure, FieldList, FieldNote, FileTrigger, Slider, TextField } from './ui';
import type { MidiStore } from './stores/midiStore';
import { useStore } from './useStore';

interface Props {
    store: MidiStore;
    onDownload: (store: MidiStore) => void;
}

export function MidiPanel({ store, onDownload }: Props) {
    const s = useStore(store);
    return (
        <>
            <h2>Piano MIDI Converter</h2>
            <FileTrigger
                layout="inline"
                label="MIDI file"
                accept={['.mid', '.midi']}
                fileName={s.fileName}
                onSelect={(file) => { if (file) void store.loadFile(file); }}
            />

            {s.formVisible && (
                <div className="meta-form">
                    <h3>Song Metadata</h3>
                    <FieldList>
                        <TextField label="Song Name" value={s.meta.songName} onChange={(v) => store.setMeta({ songName: v })} />
                        <TextField label="Artist" value={s.meta.artistName} onChange={(v) => store.setMeta({ artistName: v })} />
                        <TextField label="Album" value={s.meta.albumName} onChange={(v) => store.setMeta({ albumName: v })} />
                        <FileTrigger
                            label="Album Art (optional)"
                            accept={['image/*']}
                            fileName={s.attachments.albumArt?.name ?? null}
                            onSelect={(f) => store.setAttachment('albumArt', f)}
                        />
                        <FileTrigger
                            label="Song Audio (optional)"
                            accept={['.ogg', 'audio/ogg']}
                            fileName={s.attachments.audio?.name ?? null}
                            onSelect={(f) => store.setAttachment('audio', f)}
                        />
                        <FieldNote>
                            *Audio must be .ogg format.{' '}
                            <a href="https://www.freeconvert.com/midi-to-ogg/download" target="_blank" rel="noopener noreferrer">MIDI to OGG converter</a>
                        </FieldNote>
                        <Slider
                            label="Difficulty (0–5)"
                            min={0}
                            max={5}
                            step={0.5}
                            value={s.meta.difficulty}
                            onChange={(v) => store.setMeta({ difficulty: v })}
                        />
                    </FieldList>
                </div>
            )}

            {s.handFallback && (
                <Callout title="Hand Fallback Used">
                    <ul>
                        <li><strong>No "Left Hand" / "Right Hand" track names detected</strong> — rename MIDI tracks to include these for accurate results.</li>
                        <li><strong>Hand assigned by pitch</strong> — below middle C (MIDI 60) → left, above → right. May be wrong where hands cross.</li>
                    </ul>
                </Callout>
            )}

            <div className="panel-actions">
                <Button id="midi-download-all" variant="primary" isDisabled={s.phase !== 'ready'} onPress={() => onDownload(store)}>
                    Download
                </Button>
            </div>
            <Disclosure title="Show debug log">
                <pre className="debug-log">{s.status}</pre>
            </Disclosure>
        </>
    );
}
