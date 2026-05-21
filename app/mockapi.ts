export type MockApiRecord = Record<string, unknown>

const normalizeEndpoint = (value: string | undefined) => {
  const endpoint = value?.trim() ?? ""

  if (!/^https?:\/\//i.test(endpoint)) {
    return ""
  }

  return endpoint.replace(/\/+$/, "")
}

const firstConfiguredEndpoint = (values: Array<string | undefined>) => {
  for (const value of values) {
    const endpoint = normalizeEndpoint(value)

    if (endpoint) {
      return endpoint
    }
  }

  return ""
}

const sharedMockApiEndpoint = firstConfiguredEndpoint([
  process.env.GIT_LEAP_MOCKAPI_URL,
  process.env.MOCKAPI_URL,
  process.env.NEXT_PUBLIC_GIT_LEAP_MOCKAPI_URL,
  process.env.NEXT_PUBLIC_MOCKAPI_URL,
])

export const mockApiApprovalEndpoint =
  firstConfiguredEndpoint([
    process.env.PEER_APPROVAL_API_URL,
    process.env.NEXT_PUBLIC_PEER_APPROVAL_API_URL,
  ]) || sharedMockApiEndpoint

export const mockApiWorkspaceEndpoint =
  firstConfiguredEndpoint([
    process.env.GIT_LEAP_WORKSPACE_API_URL,
    process.env.MOCKAPI_WORKSPACE_API_URL,
    process.env.NEXT_PUBLIC_GIT_LEAP_WORKSPACE_API_URL,
    process.env.NEXT_PUBLIC_MOCKAPI_WORKSPACE_API_URL,
  ]) ||
  sharedMockApiEndpoint ||
  mockApiApprovalEndpoint

export const mockApiWorkspaceKey =
  process.env.GIT_LEAP_WORKSPACE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GIT_LEAP_WORKSPACE_KEY?.trim() ||
  "default"

export const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as MockApiRecord)
    : null

export const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

export const readResponseJson = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

export const recordsFromPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (value): value is MockApiRecord => asRecord(value) !== null,
    )
  }

  const record = asRecord(payload)
  const data = record?.data

  if (Array.isArray(data)) {
    return data.filter(
      (value): value is MockApiRecord => asRecord(value) !== null,
    )
  }

  return []
}

export const responseMessage = (payload: unknown) => {
  const record = asRecord(payload)
  const data = asRecord(record?.data)
  const source = data ?? record

  return stringValue(source?.message) ?? stringValue(source?.error)
}

export async function fetchMockApiRecords(endpoint: string) {
  const response = await fetch(endpoint, { cache: "no-store" })
  const payload = await readResponseJson(response)

  if (!response.ok) {
    throw new Error(
      responseMessage(payload) ??
        `MockAPI request failed with status ${response.status}.`,
    )
  }

  return recordsFromPayload(payload)
}

export async function postMockApiRecord(
  endpoint: string,
  body: MockApiRecord,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const payload = await readResponseJson(response)

  if (!response.ok) {
    throw new Error(
      responseMessage(payload) ??
        `MockAPI create failed with status ${response.status}.`,
    )
  }

  return payload
}

export async function patchMockApiRecord(
  endpoint: string,
  id: string,
  body: MockApiRecord,
) {
  const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const payload = await readResponseJson(response)

  if (!response.ok) {
    throw new Error(
      responseMessage(payload) ??
        `MockAPI update failed with status ${response.status}.`,
    )
  }

  return payload
}
