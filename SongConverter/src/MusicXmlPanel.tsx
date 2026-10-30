import { Button, FieldList, FieldNote, FileTrigger, Select, TextField } from './ui';
import type { MusicXmlStore } from './stores/musicXmlStore';
import { useStore } from './useStore';

interface Props {
    store: MusicXmlStore;
    onDownload: (store: MusicXmlStore) => void;
}

export function MusicXmlPanel({ store, onDownload }: Props) {
    const s = useStore(store);
    return (
        <>
            <h2>MusicXML Importer (Piano and Guitar)</h2>
            <FileTrigger
                layout="inline"
                label="MusicXML file"
                accept={['.musicxml', '.xml', '.mxl']}
                fileName={s.fileName}
                onSelect={(file) => { if (file) void store.loadFile(file); }}
            />
            <div id="musicxml-status" className="field-status" role="status">{s.status}</div>

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
                        {s.lyricsOptions.length > 0 && (
                            <Select
                                label="Lyrics from"
                                options={s.lyricsOptions}
                                value={s.meta.lyricsTrack}
                                onChange={(v) => store.setMeta({ lyricsTrack: v })}
                            />
                        )}
                        <FieldNote>*Audio must be .ogg format.</FieldNote>
                    </FieldList>
                </div>
            )}

            <div className="panel-actions">
                <Button id="musicxml-download-all" variant="primary" isDisabled={s.phase !== 'ready'} onPress={() => onDownload(store)}>
                    Download
                </Button>
            </div>
        </>
    );
}
