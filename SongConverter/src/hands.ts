import * as alphaTab from '@coderline/alphatab';

// Shared piano hand assignment (ngd.3 + MIDI follow-up hnd). Staff order is
// authored ground truth for grand-staff parts; clef and voice cover
// single-staff parts; raw pitch is the last resort (the MIDI path has no
// staff/clef/voice data, so it always lands there).
export type PianoHand = 'left' | 'right';

// Fixed middle-C seed. Rough by design - hnd replaces this arm with an
// adaptive split once ngd.3 extracts it here.
export function pitchFallbackHand(pitch: number): PianoHand {
    return pitch < 60 ? 'left' : 'right';
}

export function handForScoreNote(args: {
    staffCount: number;
    staffIndex: number;
    clef: alphaTab.model.Clef;
    voiceIndex: number;
    multiVoice: boolean;
    pitch: number;
}): PianoHand {
    // Grand staff (and any 3+-staff group): the <staff> element is the
    // authored split. Bass reaching A5 in real files proves pitch can't do this.
    if (args.staffCount === 2) return args.staffIndex === 0 ? 'right' : 'left';
    // Single or 3+-staff: clef first (G = treble/right, F = bass/left).
    if (args.clef === alphaTab.model.Clef.G2) return 'right';
    if (args.clef === alphaTab.model.Clef.F4) return 'left';
    // C clefs / neutral with several voices: upper voice right, rest left.
    if (args.multiVoice) return args.voiceIndex === 0 ? 'right' : 'left';
    return pitchFallbackHand(args.pitch);
}
