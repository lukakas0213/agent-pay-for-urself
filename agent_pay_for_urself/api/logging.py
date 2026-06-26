"""Minimal request logging for the FastAPI application."""

from __future__ import annotations

import logging
import sys
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("agent_pay_for_urself")
logger.setLevel(logging.INFO)
logger.propagate = False


def _install_console_handler() -> None:
    """Attach one shared console handler for app logs.

    The package logger owns the handler so request middleware and service loggers
    under the `agent_pay_for_urself` namespace all write to the same CLI stream.
    """

    for handler in logger.handlers:
        if getattr(handler, "_agent_pay_for_urself_console_handler", False):
            return

    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    handler._agent_pay_for_urself_console_handler = True  # type: ignore[attr-defined]
    logger.addHandler(handler)


def install_request_logging(app: FastAPI) -> None:
    """Attach a small HTTP logging middleware that is visible in the CLI.

    The middleware logs request start, successful completion, and failures
    without capturing request bodies or other sensitive payloads.
    """

    _install_console_handler()

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
