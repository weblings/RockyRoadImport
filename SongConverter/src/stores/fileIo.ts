// Strips whitespace and filesystem-unsafe characters; falls back to "song.zip" with no name.
export function zipFilenameFor(songName: string): string {
    const safeName = songName.trim().replace(/\s+/g, '').replace(/[<>:"/\\|?*]/g, '');
    return `${safeName || 'song'}.zip`;
}

// No file or a read failure both resolve to null, so one bad attachment can't block a download.
export async function readOptionalFile(file: File | null): Promise<Uint8Array | null> {
    if (!file) return null;
    try {
        return new Uint8Array(await file.arrayBuffer());
    } catch {
        return null;
    }
}

export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export type Phase = 'idle' | 'parsing' | 'ready' | 'error';

export interface AttachmentFiles {
    albumArt: File | null;
    audio: File | null;
}

export type AttachmentKind = keyof AttachmentFiles;
