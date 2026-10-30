import { Button, FieldList, FileTrigger, TextField } from './ui';
import type { PsarcStore } from './stores/psarcStore';
import { useStore } from './useStore';

interface Props {
    store: PsarcStore;
    onDownload: (store: PsarcStore) => void;
}

export function PsarcPanel({ store, onDownload }: Props) {
    const s = useStore(store);
    return (
        <>
            <h2>Rocksmith .psarc Importer</h2>
            <FileTrigger
                layout="inline"
                label="Rocksmith .psarc file"
                accept={['.psarc']}
                fileName={s.fileName}
                onSelect={(file) => { if (file) void store.loadFile(file); }}
            />
            <div id="psarc-status" className="field-status" role="status" aria-live="polite">{s.status}</div>

            {s.formVisible && (
                <div className="meta-form">
                    <h3>Song Metadata</h3>
                    <FieldList>
                        <TextField label="Song Name" value={s.meta.songName} onChange={(v) => store.setMeta({ songName: v })} />
                        <TextField label="Artist" value={s.meta.artistName} onChange={(v) => store.setMeta({ artistName: v })} />
                        <TextField label="Album" value={s.meta.albumName} onChange={(v) => store.setMeta({ albumName: v })} />
                    </FieldList>
                </div>
            )}

            <div className="panel-actions">
                <Button id="psarc-download-all" variant="primary" isDisabled={s.phase !== 'ready'} onPress={() => onDownload(store)}>
                    Download
                </Button>
            </div>
        </>
    );
}
