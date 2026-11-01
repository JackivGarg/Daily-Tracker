const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const APP_NAME = "Momentum";
const APP_ID = "com.jackiv.momentum";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

function readPrivateConfig({ dataDirectory, projectDirectory, packaged }) {
  const privatePath = path.join(dataDirectory, ".env");
  // The packaged app never reads secrets from its distributable resources.
  const configPath = existsSync(privatePath)
    ? privatePath
    : !packaged && existsSync(path.join(projectDirectory, ".env"))
      ? path.join(projectDirectory, ".env")
      : null;
  const config = configPath ? dotenv.parse(readFileSync(configPath)) : {};
  return {
    apiKey:
      typeof config.GROQ_API_KEY === "string" ? config.GROQ_API_KEY.trim() : "",
    model:
      typeof config.GROQ_MODEL === "string" && config.GROQ_MODEL.trim()
        ? config.GROQ_MODEL.trim()
        : DEFAULT_GROQ_MODEL,
    configured: Boolean(config.GROQ_API_KEY?.trim()),
  };
}

function trustedNavigation(candidate, appOrigin) {
  try {
    const url = new URL(candidate);
    return (
      url.origin === appOrigin &&
      url.protocol === "http:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function smokeDataDirectory(args) {
  if (!args.includes("--smoke-test")) return null;
  const value = args
    .find((arg) => arg.startsWith("--smoke-user-data="))
    ?.slice("--smoke-user-data=".length);
  if (!value) return null;
  if (!path.isAbsolute(value))
    throw new Error("The smoke-test data directory must be an absolute path.");
  return path.resolve(value);
}

function smokeScreenshotPath(args) {
  if (!args.includes("--smoke-test")) return null;
  const value = args
    .find((arg) => arg.startsWith("--smoke-screenshot="))
    ?.slice("--smoke-screenshot=".length);
  if (!value) return null;
  if (!path.isAbsolute(value) || path.extname(value).toLowerCase() !== ".png") {
    throw new Error("The smoke-test screenshot must be an absolute PNG path.");
  }
  return path.resolve(value);
}

module.exports = {
  APP_NAME,
  APP_ID,
  DEFAULT_GROQ_MODEL,
  readPrivateConfig,
  trustedNavigation,
  smokeDataDirectory,
  smokeScreenshotPath,
};
