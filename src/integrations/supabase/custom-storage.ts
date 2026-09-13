type FileOptions = {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
  headers?: Record<string, string>;
};

type ListOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: { column?: string; order?: string };
};

type StorageResult<T> =
  | { data: T; error: null }
  | { data: null; error: StorageCompatibilityError };

class StorageCompatibilityError extends Error {
  statusCode: number;
  error: string;

  constructor(message: string, statusCode = 500, error = "StorageError") {
    super(message);
    this.name = "StorageApiError";
    this.statusCode = statusCode;
    this.error = error;
  }
}

const cleanPath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .join("/");

const encodedPath = (path: string) =>
  cleanPath(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const absoluteUrl = (value: string, storageUrl: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/object/")) return `${storageUrl}${value}`;
  if (value.startsWith("/")) return new URL(value, new URL(storageUrl).origin).toString();
  return new URL(value, `${storageUrl}/`).toString();
};

const parseStorageError = async (response: Response) => {
  const payload = await response
    .clone()
    .json()
    .catch(async () => ({ message: await response.text().catch(() => "") }));
  const message =
    payload?.message ||
    payload?.error ||
    payload?.erro ||
    `Erro no storage (HTTP ${response.status})`;

  return new StorageCompatibilityError(
    String(message),
    response.status,
    String(payload?.error || payload?.code || "StorageError"),
  );
};

class CustomStorageBucket {
  constructor(
    private readonly bucket: string,
    private readonly storageUrl: string,
    private readonly publicMediaUrl: string,
    private readonly authenticatedFetch: typeof fetch,
  ) {}

  private objectUrl(path = "") {
    const bucket = encodeURIComponent(this.bucket);
    const suffix = path ? `/${encodedPath(path)}` : "";
    return `${this.storageUrl}/object/${bucket}${suffix}`;
  }

  private async uploadOrUpdate(
    method: "POST" | "PUT",
    path: string,
    fileBody: unknown,
    options: FileOptions = {},
  ): Promise<StorageResult<{ id: string; path: string; fullPath: string }>> {
    try {
      const headers = new Headers(options.headers);
      const blobType = typeof Blob !== "undefined" && fileBody instanceof Blob ? fileBody.type : "";
      const contentType = options.contentType || blobType;
      if (contentType) headers.set("Content-Type", contentType);
      if (options.cacheControl) headers.set("Cache-Control", `max-age=${options.cacheControl}`);
      if (options.upsert) headers.set("x-upsert", "true");

      const response = await this.authenticatedFetch(this.objectUrl(path), {
        method,
        headers,
        body: fileBody as BodyInit,
      });
      if (!response.ok) return { data: null, error: await parseStorageError(response) };

      const payload = await response.json();
      const clean = cleanPath(path);
      return {
        data: {
          id: String(payload.Id ?? payload.id ?? ""),
          path: String(payload.path ?? clean),
          fullPath: String(payload.Key ?? payload.key ?? `${this.bucket}/${clean}`),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof StorageCompatibilityError
            ? error
            : new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  upload(path: string, fileBody: unknown, options?: FileOptions) {
    return this.uploadOrUpdate("POST", path, fileBody, options);
  }

  update(path: string, fileBody: unknown, options?: FileOptions) {
    return this.uploadOrUpdate("PUT", path, fileBody, { ...options, upsert: true });
  }

  async download(path: string): Promise<StorageResult<Blob>> {
    try {
      const response = await this.authenticatedFetch(
        `${this.storageUrl}/object/authenticated/${encodeURIComponent(this.bucket)}/${encodedPath(path)}`,
      );
      if (!response.ok) return { data: null, error: await parseStorageError(response) };
      return { data: await response.blob(), error: null };
    } catch (error) {
      return {
        data: null,
        error: new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  getPublicUrl(
    path: string,
    options?: { download?: string | boolean; cacheNonce?: string; versionId?: string },
  ) {
    const query = new URLSearchParams();
    if (options?.download) {
      query.set("download", options.download === true ? "" : options.download);
    }
    if (options?.cacheNonce) query.set("cacheNonce", options.cacheNonce);
    if (options?.versionId) query.set("versionId", options.versionId);
    const suffix = query.size ? `?${query.toString()}` : "";

    return {
      data: {
        publicUrl: `${this.publicMediaUrl}/${encodeURIComponent(this.bucket)}/${encodedPath(path)}${suffix}`,
      },
    };
  }

  async remove(paths: Array<string | { path: string }>) {
    try {
      const prefixes = paths.map((entry) =>
        typeof entry === "string" ? cleanPath(entry) : cleanPath(entry.path),
      );
      const response = await this.authenticatedFetch(this.objectUrl(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes }),
      });
      if (!response.ok) return { data: null, error: await parseStorageError(response) };
      return { data: await response.json(), error: null };
    } catch (error) {
      return {
        data: null,
        error: new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async list(prefix = "", options: ListOptions = {}) {
    try {
      const response = await this.authenticatedFetch(
        `${this.storageUrl}/object/list/${encodeURIComponent(this.bucket)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: cleanPath(prefix), ...options }),
        },
      );
      if (!response.ok) return { data: null, error: await parseStorageError(response) };
      return { data: await response.json(), error: null };
    } catch (error) {
      return {
        data: null,
        error: new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async createSignedUrl(path: string, expiresIn: number) {
    try {
      const response = await this.authenticatedFetch(
        `${this.storageUrl}/object/sign/${encodeURIComponent(this.bucket)}/${encodedPath(path)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn }),
        },
      );
      if (!response.ok) return { data: null, error: await parseStorageError(response) };

      const payload = await response.json();
      const value = payload.signedURL ?? payload.signedUrl;
      if (!value) {
        return {
          data: null,
          error: new StorageCompatibilityError("Storage não retornou signedURL", 502),
        };
      }
      return { data: { signedUrl: absoluteUrl(String(value), this.storageUrl) }, error: null };
    } catch (error) {
      return {
        data: null,
        error: new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async createSignedUploadUrl(path: string, options?: { upsert: boolean }) {
    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (options?.upsert) headers.set("x-upsert", "true");
      const response = await this.authenticatedFetch(
        `${this.storageUrl}/object/upload/sign/${encodeURIComponent(this.bucket)}/${encodedPath(path)}`,
        { method: "POST", headers, body: "{}" },
      );
      if (!response.ok) return { data: null, error: await parseStorageError(response) };

      const payload = await response.json();
      const value = payload.url ?? payload.signedURL ?? payload.signedUrl;
      if (!value || !payload.token) {
        return {
          data: null,
          error: new StorageCompatibilityError("Storage não retornou URL e token de upload", 502),
        };
      }
      return {
        data: {
          signedUrl: absoluteUrl(String(value), this.storageUrl),
          path: String(payload.path ?? cleanPath(path)),
          token: String(payload.token),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new StorageCompatibilityError(error instanceof Error ? error.message : String(error)),
      };
    }
  }
}

export class CustomStorageClient {
  constructor(
    private readonly storageUrl: string,
    private readonly publicMediaUrl: string,
    private readonly authenticatedFetch: typeof fetch,
  ) {}

  from(bucket: string) {
    return new CustomStorageBucket(
      bucket,
      this.storageUrl,
      this.publicMediaUrl,
      this.authenticatedFetch,
    );
  }
}
