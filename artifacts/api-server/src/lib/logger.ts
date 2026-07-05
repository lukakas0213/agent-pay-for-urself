import pino from "pino";
import { getAppEnv, getLogLevel } from "./runtime-config";

const isProduction = getAppEnv() === "production";

export const logger = pino({
  level: getLogLevel(),
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
