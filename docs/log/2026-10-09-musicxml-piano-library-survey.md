# Piano library survey: source-of-truth files per bead (2026-10-09)

Surveyed 69 `.mxl` files in `~/Documents/RockyRoad/library/scores` against the
ngd.3–ngd.6 + 3sp attribute list. No single file covers everything, but most
attributes have real-file sources now (notes appended to each bead). Method:
unzipped `score.xml`, namespace-stripped; staff count read from measure
`<attributes><staves>`, not the part list (no file declares it there).

Covered. Two-staff piano (midi-program 1, G+F clefs, both staves spanning
middle C): 67 of 69. Ties: most files (Twinkle variations already cited in
ngd.3). Second voice: Moonlight 3rd editions, Hungarian Dance No.5,
La Campanella. Ottava: Bach Toccata, Hungarian Dance, Carol of the Bells,
La Campanella, Ballade, both Clair de Lune, Liebestraum, C# Nocturne,
Entertainer 1902, A-minor Waltz, and others. Grace: both Moonlight 3rds,
Bach Toccata, Hungarian Dance, Ballade, most Nocturnes, Fur Elise + fingered.
Dynamics leak: moonlight 3rd (fp treble-only, pp bass-only, p/sf/f/ff both,
wedges); fp/sfz-class in Twinkle, Pathetique (rf too), Beethoven 5 (sfz),
Hungarian (sffz). Quiet openings: 15 dynamics-free files (both Passacaglias,
WTC Preludes 1–2, Lacrimosa, G_Minor_Original, Bella Ciao x2, Canon/Carol
easy, Happy Birthday C, Minuet, Mozart Allegro, Spring_Waltz_Mariage) plus
late first marks (Mariage d'Amour m.11, Bumblebee m.7, Air m.6). Pedal
down/up: ~30 files. Repeats/voltas: Entertainer Joplin (16/32, heaviest),
Entertainer 1902, Twinkle (52/8), Turkish March (18/4), Rondo alla Turca
(17/4), Maple Leaf Rag, Bella Ciao, DANSE VILLAGEOISE. Rehearsal marks: only
Entertainer Joplin (11 marks) — the sole section-naming source. Credit-words
title: ~24 files with empty movement-title and work-title.

Gaps (zero sources, need hand-authored fixtures). `<pedal type="change">` and
`<sound damper-pedal>`: absent in all 69 files — ngd.5 ships against a
fixture per its note. One-staff / three-staff parts for the ngd.3 middle-C
fallback: absent (nearest are four split 1+1-part files, not the same case).

Suggested all-rounders: moonlight 3rd for ngd.3+ngd.4+ngd.5-down/up,
Entertainer Joplin for ngd.6/3sp, a dynamics-free Prelude for default
velocity. Bach Toccata (143 measures, grace+ottava+pedal, no repeats) works
as a zero-repeat control for 3sp.
