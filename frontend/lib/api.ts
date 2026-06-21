const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

export function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, apiBaseUrl.replace(/\/+$/, "")).toString();
}
