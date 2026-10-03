type EdgeErrorLike = {
  message?: unknown;
  context?: unknown;
};

async function messageFromResponse(response: Response): Promise<string | null> {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await clone.json();
      const message = body?.error || body?.message;
      return typeof message === "string" && message.trim() ? message.trim() : null;
    }
    const text = (await clone.text()).trim();
    return text && text.length <= 500 ? text : null;
  } catch {
    return null;
  }
}

export async function edgeFunctionErrorMessage(
  error: unknown,
  data: unknown,
  fallback: string,
): Promise<string> {
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    const message = body.error || body.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  const edgeError = error as EdgeErrorLike | null;
  if (edgeError?.context instanceof Response) {
    const message = await messageFromResponse(edgeError.context);
    if (message) return message;
  } else if (
    edgeError?.context
    && typeof edgeError.context === "object"
    && "response" in edgeError.context
    && (edgeError.context as { response?: unknown }).response instanceof Response
  ) {
    const message = await messageFromResponse(
      (edgeError.context as { response: Response }).response,
    );
    if (message) return message;
  }

  const raw = typeof edgeError?.message === "string" ? edgeError.message.trim() : "";
  if (
    raw
    && !/edge function returned a non-2xx status code/i.test(raw)
    && !/failed to send a request to the edge function/i.test(raw)
  ) return raw;
  return fallback;
}
