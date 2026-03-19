```
   ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗      ██████╗██╗  ██╗ █████╗ ████████╗
  ██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗    ██╔════╝██║  ██║██╔══██╗╚══██╔══╝
  ██║     ██║██████╔╝███████║█████╗  ██████╔╝    ██║     ███████║███████║   ██║
  ██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗    ██║     ██╔══██║██╔══██║   ██║
  ╚██████╗██║██║     ██║  ██║███████╗██║  ██║    ╚██████╗██║  ██║██║  ██║   ██║
   ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝
```

**Encrypted hacker-style messenger. Dark. Private. Secure.**

---

## // FEATURES

> End-to-end encrypted messaging
> Real-time communication via WebSocket
> Hacker-themed dark terminal UI
> Self-destructing messages
> Anonymous registration — no email, no phone
> File sharing with encrypted uploads
> Group channels with invite-only access
> Message history stored locally, encrypted at rest

---

## // TECH STACK

| Layer    | Technology            |
|----------|-----------------------|
| Backend  | FastAPI (Python)      |
| Frontend | React (TypeScript)    |
| Realtime | WebSocket             |
| Database | SQLite                |
| Styling  | CSS / terminal theme  |

---

## // QUICK START

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### One-command launch

```bash
chmod +x start.sh
./start.sh
```

Then open **http://localhost:5173** in your browser.

---

## // SCREENSHOTS

> _Screenshots coming soon. Imagine a dark terminal. Green text. Blinking cursor._

---

## // LICENSE

MIT License. Use it. Fork it. Break it. Fix it.
