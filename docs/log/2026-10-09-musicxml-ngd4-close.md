# MusicXML piano dynamics bead closed (2026-10-09)

Closed RockyRoadImport-ngd.4. Its two remaining items both verified shut:
per-mark staff split on `moonlight_sonata_3rd_movement.mxl` (throwaway probe,
6/6, removed) and the ngd.6 merge wiring (landed in a4af199).

Probe (raw-XML marks as independent oracle; 4/4, divisions 120, tempo 170):
m.1 right 95 / left 47 (treble default F no longer leaks into bass p); m.2
left 47 until the mid-bar `sf`, then 111, treble 95 throughout; m.6 right 95
pre-mark alongside left 111 (no backward drag); m.9 right 95 / left 111;
m.15 right 95 / left 47. Merge check: keys notes preserve the live
velocities in time order. Upstream filing stays batched with ic6/msr per aio,
which never blocked bead close.
