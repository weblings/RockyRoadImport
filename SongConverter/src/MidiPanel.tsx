import { Button, Disclosure, FieldList, FieldNote, FileTrigger, Slider, StatusMessage, TextField } from './ui';
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
            <StatusMessage id="midi-status" tone={s.phase === 'error' ? 'error' : 'neutral'}>{s.status}</StatusMessage>
            <StatusMessage id="midi-warnings" tone="warning">{s.warnings.join(' ')}</StatusMessage>

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

            <div className="panel-actions">
                <Button id="midi-download-all" variant="primary" isDisabled={s.phase !== 'ready'} onPress={() => onDownload(store)}>
                    Download
                </Button>
            </div>
            <StatusMessage tone="error" urgent>{s.downloadError}</StatusMessage>
            <Disclosure title="Show debug log">
                <pre className="debug-log">{s.log}</pre>
            </Disclosure>
        </>
    );
}
