# Z Call

Z Call is a one-link video call. Everyone opening the same URL joins the same room.

## Features
- One shared call: room name is always z-call
- WebRTC peer-to-peer video/audio
- Mute and camera controls
- Screen sharing
- In-call chat
- Participant count
- Copy invite link
- Render-ready Node/Express server

## Run locally
1. npm install
2. npm start
3. Open http://localhost:3000

## Render
Create a Web Service from this repository with:
- Runtime: Node
- Build: npm install
- Start: npm start
- Plan: Free
- Health check: /health

## Note
This uses a mesh WebRTC architecture, so every participant connects directly to every other participant. It is best for smaller calls. There is no login or authentication, and anyone with the public link can join.