from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware  # noqa: F401
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.status import HTTP_429_TOO_MANY_REQUESTS  # noqa: F401

from config import RATE_LIMIT_REQUESTS, RATE_LIMIT_PERIOD

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{RATE_LIMIT_REQUESTS}/{RATE_LIMIT_PERIOD}seconds"]
)

def setup_rate_limiter(app: FastAPI):
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(HTTP_429_TOO_MANY_REQUESTS)
    async def rate_limit_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. Please try again later.",
                "retry_after": RATE_LIMIT_PERIOD
            }
        )