import * as alphaTab from '@coderline/alphatab';

// Beat dynamics to MIDI velocity. Same values as alphaTab's own
// MidiUtils.dynamicToVelocity (min 15, step 16), so keys.json matches its
// playback; RF/RFZ/SFFZ follow the code (95), not its stale FF comment.
const VELOCITY_BY_DYNAMIC: readonly number[] = [
    15, 31, 47, 63, 79, 95, 111, 127, // PPP..FFF
    10, 5, 3, // PPPP..PPPPPP
    127, 127, 127, // FFFF..FFFFFF (clamped)
    111, 111, 111, 95, 95, 95, 111, 95, 111, 1, 87, 111, // SF..SFZP
];

export function velocityForDynamics(dynamics: alphaTab.model.DynamicValue): number {
    return VELOCITY_BY_DYNAMIC[dynamics] ?? VELOCITY_BY_DYNAMIC[alphaTab.model.DynamicValue.F]!;
}
