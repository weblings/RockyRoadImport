import pkg from '../package.json';

// Stamped into every song.json's GeneratedBy field. Reads package.json directly so it can
// never drift from the tool's actual version.
export const GENERATED_BY = `RockyRoadImport_v${pkg.version}`;
