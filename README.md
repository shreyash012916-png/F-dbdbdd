# ORBITA — Smart Industry × Agriculture Mission Control

A Render-ready voice mission-control web app for a science-exhibition model with two ESP-controlled zones: Agriculture and Industry.

## What it does
- Immersive mission-control dashboard, not a generic chatbot UI.
- Browser voice input using Web Speech API when supported.
- Browser voice output using Speech Synthesis for broad device compatibility.
- Gemini 3.8 Flash intelligence on the server; API key never reaches the browser.
- Natural-language commands are converted into a strict, validated action plan before hardware calls.
- Agriculture: soil moisture, automatic watering status, pump control.
- Industry: ESP32-CAM stream URL, digital machine controls, emergency stop.
- Configure the ESP32 base URL(s) from the Settings panel.
- Live polling and connection health indicators.
- Simulation mode for exhibition testing without hardware.

## Render deployment
1. Push the files in this directory to the root of a GitHub repository.
2. Create a Render Web Service from that repository.
3. Render will use `render.yaml`, or use:
   - Build: `npm install`
   - Start: `npm start`
4. Add `GEMINI_API_KEY` in Render Environment Variables.
5. Optional: change `GEMINI_MODEL`; default is `gemini-3.8-flash`.
6. Deploy.

The server listens on `0.0.0.0` and the Render `PORT` environment variable.

## ESP32 API contract
Set the Agriculture and Industry base URLs to the IP address reachable by the browser/server, for example `http://192.168.1.50`.

### Agriculture ESP32
- `GET /api/status` → `{ "soil": 38, "pump": false, "auto": true, "waterTank": 82, "temperature": 27.4, "humidity": 61 }`
- `POST /api/pump` body `{ "on": true }`
- `POST /api/auto` body `{ "enabled": true }`

The dashboard also accepts legacy-friendly aliases (`/status`, `/pump`, `/auto`) when the primary API path is unavailable.

### Industry ESP32 / ESP32-CAM
- `GET /api/status` → `{ "online": true, "machine": false, "temperature": 31.2, "vibration": 0.08, "load": 42, "camera": "http://192.168.1.51/stream" }`
- `POST /api/machine` body `{ "on": true }`
- `POST /api/stop` body `{ "stop": true }`

Aliases `/status`, `/machine`, `/stop` are also attempted.

## Gemini behavior
Gemini is used as an interpreter/planner, not as a direct unrestricted HTTP controller. The server asks Gemini for a JSON action plan and validates the action names against an allowlist. The browser then executes only those approved actions directly against the configured ESP endpoints. This is necessary because a Render-hosted server cannot normally reach an ESP32 on your private school Wi-Fi. The ESP endpoints must permit CORS.

For the most reliable physical exhibition setup, run the same app locally over HTTP on a laptop connected to the ESP Wi-Fi, or configure the ESP/gateway for HTTPS. A Render HTTPS page may be blocked by the browser from calling plain-HTTP private ESP addresses due to browser mixed-content/private-network security.

## Voice
Voice input depends on browser/device speech-recognition support. If unavailable, the text command bar remains fully functional. Speech output uses the device's available voice.

## Important network note
If the browser is accessing Render over HTTPS and the ESP is only available over plain HTTP on a local network, browsers can block mixed-content requests. The app detects and explains this situation. For a physical exhibition, using the app from a local network or serving the ESP through HTTPS/reverse proxy is the most reliable setup.
