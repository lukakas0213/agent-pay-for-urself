"""Minimal request logging for the FastAPI application."""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("agent_pay_for_urself.api")
logger.setLevel(logging.INFO)


def install_request_logging(app: FastAPI) -> None:
    """Attach a small HTTP logging middleware that is visible in the CLI.

    The middleware logs request start, successful completion, and failures
    without capturing request bodies or other sensitive payloads.
    """

    @app.middleware("http")
    async def _log_request(request: Request, call_next):
        start = time.perf_counter()
        logger.info("request_started method=%s path=%s", request.method, request.url.path)
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request_failed method=%s path=%s", request.method, request.url.path)
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "request_completed method=%s path=%s status=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
