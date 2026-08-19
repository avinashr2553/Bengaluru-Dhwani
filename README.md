# Bengaluru Dhwani — Next.js

This is the Next.js version of the Bengaluru Dhwani radio site.

## Hardcoded playlist

The YouTube playlist is hardcoded in:

`app/RadioPlayer.js`

```js
const PLAYLIST_ID = "PLGReFY4njrBvbnuylNGCaPfNR4jZ62SVA";
```

No playlist input is shown to visitors.

## Run

Requirements: Node.js 18.18+.

```bash
npm install
npm run dev
```

Then open:

`http://localhost:3000`

For production:

```bash
npm run build
npm start
```

## Playback

Browsers block automatic audio playback in many situations. The playlist is initialized when the page loads, but the user should press the round Play button to start audio.

The YouTube IFrame Player API is loaded client-side and the custom Bengaluru Dhwani UI controls it.
