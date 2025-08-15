Endless Runner MVP

How to run:
- Open `index.html` in a modern desktop browser supporting ES modules and WebGL.
- Controls: A / D or Left / Right arrows to switch lanes.

What is included:
- Minimal Three.js-based endless runner scaffold
- Placeholder geometry for player, track, gates, and zombies
- Gate math modifiers that change player power
- Periodic zombie encounters judged by player power vs HP
- HUD showing Power and Score

Notes:
- This is a local, file-based prototype. For best results, serve it with a static file server (e.g., `npx http-server` or `python -m http.server`) to avoid module import issues in some browsers.
