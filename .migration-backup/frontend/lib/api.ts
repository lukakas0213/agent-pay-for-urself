const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

export function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const backendPath =
    normalizedPath === "/api"
      ? "/"
      : normalizedPath.replace(/^\/api(?=\/|$)/, "");
  return new URL(backendPath, apiBaseUrl.replace(/\/+$/, "")).toString();
}
