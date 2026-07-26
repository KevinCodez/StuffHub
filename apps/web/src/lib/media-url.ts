const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Make local Supabase URLs reachable from a phone viewing Next over the LAN. */
export function reachableMediaUrl(signedUrl: string | null | undefined, requestUrl: URL): string | null {
  if (!signedUrl) return null;
  try {
    const mediaUrl = new URL(signedUrl);
    if (LOOPBACK_HOSTS.has(mediaUrl.hostname) && !LOOPBACK_HOSTS.has(requestUrl.hostname)) {
      mediaUrl.hostname = requestUrl.hostname;
    }
    return mediaUrl.toString();
  } catch {
    return signedUrl;
  }
}
