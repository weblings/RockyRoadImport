import { Button, FieldList, FieldNote, FileTrigger, TextField } from './ui';
import type { GpStore } from './stores/gpStore';
import { useStore } from './useStore';

interface Props {
    store: GpStore;
    onDownload: (store: GpStore) => void;
}

export function GpPanel({ store, onDownload }: Props) {
    const s = useStore(store);
    return (
        <>
            <h2>Guitar Pro Importer</h2>
            <FileTrigger
                layout="inline"
                label="Guitar Pro file"
                accept={['.gp3', '.gp4', '.gp5']}
                fileName={s.fileName}
                onSelect={(file) => { if (file) void store.loadFile(file); }}
            />
            <div id="gp-status" className="field-status" role="status">{s.status}</div>

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
                        <FieldNote>*Audio must be .ogg format.</FieldNote>
                    </FieldList>
                </div>
            )}

            <div className="panel-actions">
                <Button id="gp-download-all" variant="primary" isDisabled={s.phase !== 'ready'} onPress={() => onDownload(store)}>
                    Download
                </Button>
            </div>
        </>
    );
}
