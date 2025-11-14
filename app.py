import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine
from starlette.middleware.sessions import SessionMiddleware
from starlette.status import HTTP_302_FOUND
import uvicorn

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "pet123"

DATA_KEY = "all_class_data"
GROWTH_KEY = "pet_growth_settings"
DEFAULT_GROWTH_SETTINGS = {"level2Threshold": 4, "level3Threshold": 8}
DATABASE_URL = "sqlite:///data/app.db"

Path("data").mkdir(exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


class KeyValue(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


def get_value(session: Session, key: str, default: str) -> str:
    record = session.get(KeyValue, key)
    if record is None:
        record = KeyValue(key=key, value=default)
        session.add(record)
        session.commit()
        session.refresh(record)
    return record.value


def set_value(session: Session, key: str, value: str) -> None:
    record = session.get(KeyValue, key)
    now = datetime.utcnow()
    if record:
        record.value = value
        record.updated_at = now
    else:
        record = KeyValue(key=key, value=value, updated_at=now)
        session.add(record)
    session.commit()


def build_app_config(request: Request, session: Session) -> Dict[str, Any]:
    data = json.loads(get_value(session, DATA_KEY, "{}"))
    growth = json.loads(get_value(session, GROWTH_KEY, json.dumps(DEFAULT_GROWTH_SETTINGS)))
    routes = {
        "getData": str(request.url_for("api_get_data")),
        "saveData": str(request.url_for("api_save_data")),
        "getGrowth": str(request.url_for("api_get_growth_settings")),
        "saveGrowth": str(request.url_for("api_save_growth_settings")),
    }
    static_base = str(request.url_for("static", path=""))
    return {
        "initialData": data,
        "growthSettings": growth,
        "routes": routes,
        "staticBase": static_base if static_base.endswith("/") else f"{static_base}/",
    }


class DataPayload(BaseModel):
    data: Dict[str, Any]


class GrowthPayload(BaseModel):
    level2Threshold: int
    level3Threshold: int


app = FastAPI()
app.add_middleware(
    SessionMiddleware,
    secret_key="replace-with-a-random-secret",
    max_age=None,
    session_cookie="session",
    same_site="lax",
)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


@app.middleware("http")
async def prevent_html_cache(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/admin") or request.url.path.startswith("/login"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    return response


def is_authenticated(request: Request) -> bool:
    return bool(request.session.get("authenticated"))


@app.get("/", response_class=HTMLResponse)
async def home(request: Request, session: Session = Depends(get_session)):
    context = {
        "request": request,
        "app_config": build_app_config(request, session),
    }
    return templates.TemplateResponse("index.html", context)


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, session: Session = Depends(get_session)):
    if not is_authenticated(request):
        return RedirectResponse(url="/login", status_code=HTTP_302_FOUND)
    context = {
        "request": request,
        "app_config": build_app_config(request, session),
    }
    return templates.TemplateResponse("admin.html", context)


@app.get("/login", response_class=HTMLResponse)
async def login_form(request: Request):
    if is_authenticated(request):
        return RedirectResponse(url="/admin", status_code=HTTP_302_FOUND)
    return templates.TemplateResponse("login.html", {"request": request, "error": ""})


@app.post("/login", response_class=HTMLResponse)
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        request.session["authenticated"] = True
        return RedirectResponse(url="/admin", status_code=HTTP_302_FOUND)
    return templates.TemplateResponse(
        "login.html",
        {"request": request, "error": "账号或密码错误"},
    )


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=HTTP_302_FOUND)


@app.get("/api/data")
async def api_get_data(session: Session = Depends(get_session)):
    data = json.loads(get_value(session, DATA_KEY, "{}"))
    return {"data": data}


@app.post("/api/data")
async def api_save_data(payload: DataPayload, session: Session = Depends(get_session)):
    set_value(session, DATA_KEY, json.dumps(payload.data))
    return {"status": "ok"}


@app.get("/api/settings/growth")
async def api_get_growth_settings(session: Session = Depends(get_session)):
    growth = json.loads(get_value(session, GROWTH_KEY, json.dumps(DEFAULT_GROWTH_SETTINGS)))
    return growth


@app.post("/api/settings/growth")
async def api_save_growth_settings(payload: GrowthPayload, session: Session = Depends(get_session)):
    if payload.level2Threshold <= 0 or payload.level3Threshold <= 0:
        raise HTTPException(status_code=400, detail="Invalid growth thresholds")
    set_value(session, GROWTH_KEY, json.dumps(payload.dict()))
    return {"status": "ok"}
