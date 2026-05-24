# Audio assets

This directory holds the audio sample bank. All files are optional —
missing files are silently absent (no console errors, no UI failures).

`lib/audio.ts` fetches `.webm` first and falls back to the `.mp3` sibling
on fetch or decode failure (Safari <14 lacks Opus decode). Ship both
formats per slot for full coverage; ship only `.webm` to drop Safari <14.

Expected slots:
- impacts/old-1.webm + impacts/old-1.mp3
- impacts/old-2.webm + impacts/old-2.mp3
- impacts/old-3.webm + impacts/old-3.mp3
- impacts/new-1.webm + impacts/new-1.mp3
- impacts/new-2.webm + impacts/new-2.mp3
- impacts/new-3.webm + impacts/new-3.mp3
- voice/old.webm + voice/old.mp3
- voice/new.webm + voice/new.mp3
- sting/verdict.webm + sting/verdict.mp3
- bg/loop.webm + bg/loop.mp3

See plan Q6 / Task 18 for format and licensing requirements.
