"""
CipherChat — Production-ready FastAPI backend.

Features:
  - JWT authentication (register / login / refresh)
  - Real-time messaging over WebSocket
  - SQLite with fully async access
  - File / image uploads
  - Private and group chats
  - Typing indicators, read receipts, online presence
"""

from __future__ import annotations

import os
import uuid
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import aiofiles
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Query,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from database import database, users, chats, chat_members, messages, init_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "cipherchat-super-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("cipherchat")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    payload = decode_token(token)
    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return int(user_id)


async def get_current_user_record(user_id: int = Depends(get_current_user_id)) -> dict:
    query = users.select().where(users.c.id == user_id)
    row = await database.fetch_one(query)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row._mapping)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern="^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6, max_length=256)
    display_name: str = Field(..., min_length=1, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    display_name: str


class CreateChatRequest(BaseModel):
    type: str = Field("private", pattern="^(private|group)$")
    name: str | None = None
    member_ids: list[int] = Field(default_factory=list)


class SendMessageRequest(BaseModel):
    content: str | None = None
    type: str = Field("text", pattern="^(text|image|file|voice|video_circle|video)$")
    file_url: str | None = None


class AddMemberRequest(BaseModel):
    user_id: int
    role: str = Field("member", pattern="^(admin|member)$")


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Tracks active WebSocket connections per user."""

    def __init__(self) -> None:
        # user_id -> list of WebSocket (one user may have multiple devices)
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)
        logger.info("WS connected: user %s (connections: %d)", user_id, len(self.active[user_id]))
        # Broadcast online status
        await self.broadcast_presence(user_id, online=True)

    async def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        conns = self.active.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active.pop(user_id, None)
            # Update last_seen
            await database.execute(
                users.update().where(users.c.id == user_id).values(last_seen=datetime.now(timezone.utc))
            )
            await self.broadcast_presence(user_id, online=False)
        logger.info("WS disconnected: user %s", user_id)

    def is_online(self, user_id: int) -> bool:
        return bool(self.active.get(user_id))

    async def send_personal(self, user_id: int, data: dict) -> None:
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def broadcast_to_chat(self, chat_id: int, data: dict, exclude_user: int | None = None) -> None:
        """Send a message to every online member of a chat."""
        query = chat_members.select().where(chat_members.c.chat_id == chat_id)
        rows = await database.fetch_all(query)
        for row in rows:
            uid = row._mapping["user_id"]
            if uid == exclude_user:
                continue
            await self.send_personal(uid, data)

    async def broadcast_presence(self, user_id: int, online: bool) -> None:
        """Notify all chats the user belongs to about presence change."""
        query = chat_members.select().where(chat_members.c.user_id == user_id)
        memberships = await database.fetch_all(query)
        event_type = "user_online" if online else "user_offline"
        for membership in memberships:
            cid = membership._mapping["chat_id"]
            await self.broadcast_to_chat(
                cid,
                {"type": event_type, "user_id": user_id},
                exclude_user=user_id,
            )


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(title="CipherChat API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup() -> None:
    await init_db()
    await database.connect()
    logger.info("CipherChat backend started.")


@app.on_event("shutdown")
async def shutdown() -> None:
    await database.disconnect()
    logger.info("CipherChat backend stopped.")


# ============================= AUTH ========================================

@app.post("/api/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    # Check uniqueness
    existing = await database.fetch_one(users.select().where(users.c.username == body.username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    now = datetime.now(timezone.utc)
    user_id = await database.execute(
        users.insert().values(
            username=body.username,
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            last_seen=now,
            created_at=now,
        )
    )
    token = create_access_token({"sub": str(user_id)})
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        username=body.username,
        display_name=body.display_name,
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    row = await database.fetch_one(users.select().where(users.c.username == body.username))
    if not row or not verify_password(body.password, row._mapping["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    mapping = row._mapping
    token = create_access_token({"sub": str(mapping["id"])})
    return TokenResponse(
        access_token=token,
        user_id=mapping["id"],
        username=mapping["username"],
        display_name=mapping["display_name"],
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(user: dict = Depends(get_current_user_record)):
    token = create_access_token({"sub": str(user["id"])})
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        username=user["username"],
        display_name=user["display_name"],
    )


# ============================= USERS =======================================

@app.get("/api/users/me")
async def get_me(user: dict = Depends(get_current_user_record)):
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "avatar_url": user["avatar_url"],
        "last_seen": _serialize_dt(user["last_seen"]),
        "created_at": _serialize_dt(user["created_at"]),
        "online": manager.is_online(user["id"]),
    }


@app.get("/api/users/search")
async def search_users(q: str = Query("", min_length=1), _uid: int = Depends(get_current_user_id)):
    query = users.select().where(
        (users.c.username.ilike(f"%{q}%")) | (users.c.display_name.ilike(f"%{q}%"))
    ).limit(20)
    rows = await database.fetch_all(query)
    return [
        {
            "id": r._mapping["id"],
            "username": r._mapping["username"],
            "display_name": r._mapping["display_name"],
            "avatar_url": r._mapping["avatar_url"],
            "online": manager.is_online(r._mapping["id"]),
        }
        for r in rows
    ]


# ============================= CHATS =======================================

def _serialize_dt(dt: Any) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


@app.get("/api/chats")
async def list_chats(user_id: int = Depends(get_current_user_id)):
    # All chats the user is a member of
    import sqlalchemy as sa

    query = (
        sa.select(chats, chat_members.c.role, chat_members.c.joined_at)
        .select_from(chats.join(chat_members, chats.c.id == chat_members.c.chat_id))
        .where(chat_members.c.user_id == user_id)
        .order_by(chats.c.created_at.desc())
    )
    rows = await database.fetch_all(query)

    result = []
    for r in rows:
        m = r._mapping
        chat_id = m["id"]

        # Get last message
        last_msg_q = (
            messages.select()
            .where((messages.c.chat_id == chat_id) & (messages.c.deleted == False))
            .order_by(messages.c.created_at.desc())
            .limit(1)
        )
        last_msg_row = await database.fetch_one(last_msg_q)

        # Unread count
        unread_q = sa.select(sa.func.count()).select_from(messages).where(
            (messages.c.chat_id == chat_id)
            & (messages.c.sender_id != user_id)
            & (messages.c.is_read == False)
            & (messages.c.deleted == False)
        )
        unread = await database.fetch_val(unread_q)

        last_message = None
        if last_msg_row:
            lm = last_msg_row._mapping
            last_message = {
                "id": lm["id"],
                "content": lm["content"],
                "type": lm["type"],
                "sender_id": lm["sender_id"],
                "created_at": _serialize_dt(lm["created_at"]),
            }

        result.append(
            {
                "id": chat_id,
                "name": m["name"],
                "type": m["type"],
                "avatar_url": m["avatar_url"],
                "role": m["role"],
                "joined_at": _serialize_dt(m["joined_at"]),
                "created_at": _serialize_dt(m["created_at"]),
                "unread_count": unread or 0,
                "last_message": last_message,
            }
        )

    return result


@app.post("/api/chats", status_code=201)
async def create_chat(body: CreateChatRequest, user_id: int = Depends(get_current_user_id)):
    now = datetime.now(timezone.utc)

    if body.type == "private":
        if len(body.member_ids) != 1:
            raise HTTPException(status_code=400, detail="Private chat requires exactly one other member_id")
        other_id = body.member_ids[0]
        if other_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot create a private chat with yourself")

        # Check if a private chat between these two already exists
        import sqlalchemy as sa

        my_chats = sa.select(chat_members.c.chat_id).where(chat_members.c.user_id == user_id).subquery()
        other_chats = sa.select(chat_members.c.chat_id).where(chat_members.c.user_id == other_id).subquery()
        existing_q = (
            sa.select(chats.c.id)
            .where(
                (chats.c.type == "private")
                & chats.c.id.in_(sa.select(my_chats.c.chat_id))
                & chats.c.id.in_(sa.select(other_chats.c.chat_id))
            )
            .limit(1)
        )
        existing = await database.fetch_one(existing_q)
        if existing:
            return {"id": existing._mapping["id"], "created": False}

        # Verify other user exists
        other_user = await database.fetch_one(users.select().where(users.c.id == other_id))
        if not other_user:
            raise HTTPException(status_code=404, detail="User not found")

    chat_id = await database.execute(
        chats.insert().values(name=body.name, type=body.type, created_at=now)
    )

    # Add creator as admin
    await database.execute(
        chat_members.insert().values(chat_id=chat_id, user_id=user_id, role="admin", joined_at=now)
    )

    # Add other members
    for mid in body.member_ids:
        if mid == user_id:
            continue
        member_exists = await database.fetch_one(users.select().where(users.c.id == mid))
        if not member_exists:
            continue
        await database.execute(
            chat_members.insert().values(chat_id=chat_id, user_id=mid, role="member", joined_at=now)
        )

    return {"id": chat_id, "created": True}


# ============================= MESSAGES ====================================

@app.get("/api/chats/{chat_id}/messages")
async def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    # Verify membership
    membership = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == chat_id) & (chat_members.c.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    query = messages.select().where(
        (messages.c.chat_id == chat_id) & (messages.c.deleted == False)
    )
    if before_id is not None:
        query = query.where(messages.c.id < before_id)
    query = query.order_by(messages.c.created_at.desc()).limit(limit)

    rows = await database.fetch_all(query)
    result = []
    for r in rows:
        m = r._mapping
        result.append(
            {
                "id": m["id"],
                "chat_id": m["chat_id"],
                "sender_id": m["sender_id"],
                "content": m["content"],
                "type": m["type"],
                "file_url": m["file_url"],
                "is_read": m["is_read"],
                "created_at": _serialize_dt(m["created_at"]),
                "edited_at": _serialize_dt(m["edited_at"]),
            }
        )
    # Return in chronological order
    result.reverse()
    return result


@app.post("/api/chats/{chat_id}/messages", status_code=201)
async def send_message(chat_id: int, body: SendMessageRequest, user_id: int = Depends(get_current_user_id)):
    # Verify membership
    membership = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == chat_id) & (chat_members.c.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    if body.type == "text" and not body.content:
        raise HTTPException(status_code=400, detail="Text message must have content")

    now = datetime.now(timezone.utc)
    msg_id = await database.execute(
        messages.insert().values(
            chat_id=chat_id,
            sender_id=user_id,
            content=body.content,
            type=body.type,
            file_url=body.file_url,
            is_read=False,
            created_at=now,
            deleted=False,
        )
    )

    msg_data = {
        "id": msg_id,
        "chat_id": chat_id,
        "sender_id": user_id,
        "content": body.content,
        "type": body.type,
        "file_url": body.file_url,
        "is_read": False,
        "created_at": now.isoformat(),
        "edited_at": None,
    }

    # Broadcast via WebSocket to all chat members
    await manager.broadcast_to_chat(
        chat_id,
        {"type": "new_message", "message": msg_data},
    )

    return msg_data


@app.put("/api/messages/{message_id}/read")
async def mark_message_read(message_id: int, user_id: int = Depends(get_current_user_id)):
    row = await database.fetch_one(messages.select().where(messages.c.id == message_id))
    if not row:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = row._mapping
    # Verify the user is a member of the chat
    membership = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == msg["chat_id"]) & (chat_members.c.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    await database.execute(
        messages.update().where(messages.c.id == message_id).values(is_read=True)
    )

    # Send read receipt via WS
    await manager.broadcast_to_chat(
        msg["chat_id"],
        {
            "type": "read_receipt",
            "message_id": message_id,
            "chat_id": msg["chat_id"],
            "user_id": user_id,
        },
    )

    return {"status": "ok"}


@app.delete("/api/messages/{message_id}")
async def delete_message(message_id: int, user_id: int = Depends(get_current_user_id)):
    row = await database.fetch_one(messages.select().where(messages.c.id == message_id))
    if not row:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = row._mapping
    if msg["sender_id"] != user_id:
        # Allow chat admins to delete too
        membership = await database.fetch_one(
            chat_members.select().where(
                (chat_members.c.chat_id == msg["chat_id"])
                & (chat_members.c.user_id == user_id)
                & (chat_members.c.role == "admin")
            )
        )
        if not membership:
            raise HTTPException(status_code=403, detail="Cannot delete this message")

    await database.execute(
        messages.update().where(messages.c.id == message_id).values(deleted=True)
    )

    # Broadcast deletion
    await manager.broadcast_to_chat(
        msg["chat_id"],
        {
            "type": "message_deleted",
            "message_id": message_id,
            "chat_id": msg["chat_id"],
        },
    )

    return {"status": "deleted"}


# ============================= CHAT MEMBERS ================================

@app.get("/api/chats/{chat_id}/members")
async def get_chat_members(chat_id: int, user_id: int = Depends(get_current_user_id)):
    # Verify membership
    membership = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == chat_id) & (chat_members.c.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    import sqlalchemy as sa

    query = (
        sa.select(
            users.c.id,
            users.c.username,
            users.c.display_name,
            users.c.avatar_url,
            users.c.last_seen,
            chat_members.c.role,
            chat_members.c.joined_at,
        )
        .select_from(users.join(chat_members, users.c.id == chat_members.c.user_id))
        .where(chat_members.c.chat_id == chat_id)
    )
    rows = await database.fetch_all(query)
    return [
        {
            "id": r._mapping["id"],
            "username": r._mapping["username"],
            "display_name": r._mapping["display_name"],
            "avatar_url": r._mapping["avatar_url"],
            "last_seen": _serialize_dt(r._mapping["last_seen"]),
            "role": r._mapping["role"],
            "joined_at": _serialize_dt(r._mapping["joined_at"]),
            "online": manager.is_online(r._mapping["id"]),
        }
        for r in rows
    ]


@app.post("/api/chats/{chat_id}/members", status_code=201)
async def add_chat_member(chat_id: int, body: AddMemberRequest, user_id: int = Depends(get_current_user_id)):
    # Only admins can add members
    membership = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == chat_id)
            & (chat_members.c.user_id == user_id)
            & (chat_members.c.role == "admin")
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can add members")

    # Verify chat is a group
    chat = await database.fetch_one(chats.select().where(chats.c.id == chat_id))
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat._mapping["type"] != "group":
        raise HTTPException(status_code=400, detail="Cannot add members to a private chat")

    # Verify target user exists
    target = await database.fetch_one(users.select().where(users.c.id == body.user_id))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    already = await database.fetch_one(
        chat_members.select().where(
            (chat_members.c.chat_id == chat_id) & (chat_members.c.user_id == body.user_id)
        )
    )
    if already:
        raise HTTPException(status_code=409, detail="User is already a member")

    now = datetime.now(timezone.utc)
    await database.execute(
        chat_members.insert().values(
            chat_id=chat_id, user_id=body.user_id, role=body.role, joined_at=now
        )
    )

    return {"status": "added", "user_id": body.user_id, "chat_id": chat_id}


# ============================= UPLOAD ======================================

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".pdf", ".doc", ".docx", ".txt", ".zip", ".rar", ".7z",
    ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".opus", ".m4a",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    _user_id: int = Depends(get_current_user_id),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    # Read file and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    file_url = f"/uploads/{unique_name}"
    return {"file_url": file_url, "filename": file.filename, "size": len(contents)}


# ============================= WEBSOCKET ===================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Authenticate
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Verify user exists
    user_row = await database.fetch_one(users.select().where(users.c.id == user_id))
    if not user_row:
        await websocket.close(code=4001, reason="User not found")
        return

    await manager.connect(websocket, user_id)

    # Send initial data: unread counts per chat
    try:
        import sqlalchemy as sa

        my_chats_q = chat_members.select().where(chat_members.c.user_id == user_id)
        my_chats_rows = await database.fetch_all(my_chats_q)
        unread_counts: dict[int, int] = {}
        for cr in my_chats_rows:
            cid = cr._mapping["chat_id"]
            count_q = sa.select(sa.func.count()).select_from(messages).where(
                (messages.c.chat_id == cid)
                & (messages.c.sender_id != user_id)
                & (messages.c.is_read == False)
                & (messages.c.deleted == False)
            )
            cnt = await database.fetch_val(count_q)
            if cnt:
                unread_counts[cid] = cnt

        await websocket.send_json({
            "type": "init",
            "unread_counts": unread_counts,
            "online_users": list(manager.active.keys()),
        })
    except Exception as exc:
        logger.error("Error sending init data: %s", exc)

    # Main receive loop
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            msg_type = data.get("type")

            if msg_type == "typing":
                chat_id = data.get("chat_id")
                if chat_id:
                    membership = await database.fetch_one(
                        chat_members.select().where(
                            (chat_members.c.chat_id == chat_id) & (chat_members.c.user_id == user_id)
                        )
                    )
                    if membership:
                        await manager.broadcast_to_chat(
                            chat_id,
                            {"type": "typing", "chat_id": chat_id, "user_id": user_id},
                            exclude_user=user_id,
                        )

            elif msg_type == "read_receipt":
                message_id = data.get("message_id")
                if message_id:
                    row = await database.fetch_one(messages.select().where(messages.c.id == message_id))
                    if row:
                        await database.execute(
                            messages.update().where(messages.c.id == message_id).values(is_read=True)
                        )
                        await manager.broadcast_to_chat(
                            row._mapping["chat_id"],
                            {
                                "type": "read_receipt",
                                "message_id": message_id,
                                "chat_id": row._mapping["chat_id"],
                                "user_id": user_id,
                            },
                        )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            else:
                await websocket.send_json({"type": "error", "detail": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception as exc:
        logger.error("WebSocket error for user %s: %s", user_id, exc)
        await manager.disconnect(websocket, user_id)


# ============================= HEALTH ======================================

@app.get("/api/health")
async def health():
    return {"status": "operational", "service": "CipherChat", "version": "1.0.0"}
