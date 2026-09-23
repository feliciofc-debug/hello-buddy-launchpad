export class InstagramContainerTimeoutError extends Error {
  creationId: string
  lastStatus: string

  constructor(creationId: string, lastStatus: string) {
    super(`Instagram: processamento ainda não terminou. Container ${creationId} salvo para tentar publicar novamente sem duplicar.`)
    this.name = "InstagramContainerTimeoutError"
    this.creationId = creationId
    this.lastStatus = lastStatus
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function nextIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 3_000
  if (elapsedMs < 90_000) return 5_000
  return 10_000
}

export async function waitForInstagramContainer(
  creationId: string,
  pageToken: string,
  label: string,
  maxWaitMs = 300_000,
): Promise<void> {
  const startedAt = Date.now()
  let attempt = 0
  let lastStatus = "UNKNOWN"

  while (Date.now() - startedAt < maxWaitMs) {
    const intervalMs = nextIntervalMs(Date.now() - startedAt)
    await sleep(Math.min(intervalMs, maxWaitMs - (Date.now() - startedAt)))
    attempt++

    const statusResponse = await fetch(
      `https://graph.facebook.com/v25.0/${creationId}?fields=status_code,status&access_token=${pageToken}`,
    )
    const statusResult = await statusResponse.json()
    lastStatus = String(statusResult?.status_code || "UNKNOWN")
    console.log(`[instagram-container][${label}]`, {
      creation_id: creationId,
      attempt,
      http_status: statusResponse.status,
      status_code: lastStatus,
      elapsed_ms: Date.now() - startedAt,
    })

    if (!statusResponse.ok || statusResult?.error) {
      const message = statusResult?.error?.message || `consulta retornou HTTP ${statusResponse.status}`
      throw new Error(`Instagram ${label}: falha ao consultar container ${creationId}: ${message}`)
    }
    if (lastStatus === "FINISHED") return
    if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
      throw new Error(`Instagram ${label}: container ${creationId} terminou com status ${lastStatus}: ${statusResult?.status || "erro no processamento"}`)
    }
  }

  console.warn(`[instagram-container][${label}][timeout]`, {
    creation_id: creationId,
    status_code: lastStatus,
    elapsed_ms: Date.now() - startedAt,
  })
  throw new InstagramContainerTimeoutError(creationId, lastStatus)
}
