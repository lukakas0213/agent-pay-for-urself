const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  const trimmedBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseIncludesApiPrefix = /\/api$/i.test(trimmedBaseUrl);
  const backendPath =
    baseIncludesApiPrefix && normalizedPath.startsWith("/api")
      ? normalizedPath.replace(/^\/api(?=\/|$)/, "") || "/"
      : normalizedPath;
  const relativeBackendPath = backendPath.replace(/^\/+/, "");

  return new URL(relativeBackendPath || ".", `${trimmedBaseUrl}/`).toString();
}
