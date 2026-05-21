import {
  asRecord,
  fetchMockApiRecords,
  mockApiWorkspaceEndpoint,
  mockApiWorkspaceKey,
  patchMockApiRecord,
  postMockApiRecord,
  readResponseJson,
  responseMessage,
  stringValue,
  type MockApiRecord,
} from "../../mockapi"

const workspaceRecordType = "git-leap-workspace"

type WorkspaceRequest = {
  activeProjectId?: unknown
  projects?: unknown
}

const recordId = (record: MockApiRecord) =>
  stringValue(record.id) ?? stringValue(record.objectId)

const recordType = (record: MockApiRecord) =>
  stringValue(record.recordType) ?? stringValue(record.type)

const recordWorkspaceKey = (record: MockApiRecord) =>
  stringValue(record.workspaceKey) ?? stringValue(record.key) ?? "default"

const isWorkspaceRecord = (record: MockApiRecord) =>
  recordType(record) === workspaceRecordType &&
  recordWorkspaceKey(record) === mockApiWorkspaceKey

const isLegacyWorkspaceRecord = (record: MockApiRecord) =>
  recordType(record) === null &&
  recordWorkspaceKey(record) === mockApiWorkspaceKey &&
  Array.isArray(record.projects)

const workspaceFrom = (record: MockApiRecord | null) => {
  if (!record || !Array.isArray(record.projects)) {
    return null
  }

  return {
    id: recordId(record),
    activeProjectId: stringValue(record.activeProjectId),
    projects: record.projects,
    updatedAt: stringValue(record.updatedAt),
    workspaceKey: recordWorkspaceKey(record),
  }
}

async function currentWorkspaceRecord() {
  const records = await fetchMockApiRecords(mockApiWorkspaceEndpoint)

  return (
    records.find(isWorkspaceRecord) ??
    records.find(isLegacyWorkspaceRecord) ??
    null
  )
}

export async function GET() {
  if (!mockApiWorkspaceEndpoint) {
    return Response.json({
      configured: false,
      workspace: null,
      message: "No MockAPI workspace endpoint is configured.",
    })
  }

  try {
    return Response.json({
      configured: true,
      workspace: workspaceFrom(await currentWorkspaceRecord()),
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "MockAPI workspace lookup failed.",
      },
      { status: 502 },
    )
  }
}

export async function PUT(request: Request) {
  let body: WorkspaceRequest

  try {
    body = (await request.json()) as WorkspaceRequest
  } catch {
    return Response.json(
      { error: "Workspace update must be valid JSON." },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.projects)) {
    return Response.json(
      { error: "Workspace projects must be an array." },
      { status: 400 },
    )
  }

  const activeProjectId = stringValue(body.activeProjectId)

  if (!activeProjectId) {
    return Response.json(
      { error: "Workspace activeProjectId is required." },
      { status: 400 },
    )
  }

  if (!mockApiWorkspaceEndpoint) {
    return Response.json({
      configured: false,
      synced: false,
      message: "No MockAPI workspace endpoint is configured.",
    })
  }

  const now = new Date().toISOString()
  const nextWorkspace = {
    recordType: workspaceRecordType,
    workspaceKey: mockApiWorkspaceKey,
    activeProjectId,
    projects: body.projects,
    updatedAt: now,
  }

  try {
    const existingRecord = await currentWorkspaceRecord()
    const existingId = existingRecord ? recordId(existingRecord) : null
    const payload = existingId
      ? await patchMockApiRecord(
          mockApiWorkspaceEndpoint,
          existingId,
          nextWorkspace,
        )
      : await postMockApiRecord(mockApiWorkspaceEndpoint, {
          ...nextWorkspace,
          createdAt: now,
        })
    const savedRecord = asRecord(payload)

    return Response.json({
      configured: true,
      synced: true,
      workspace: workspaceFrom(savedRecord) ?? nextWorkspace,
    })
  } catch (error) {
    const payload = error instanceof Response ? await readResponseJson(error) : null

    return Response.json(
      {
        error:
          responseMessage(payload) ??
          (error instanceof Error
            ? error.message
            : "MockAPI workspace update failed."),
      },
      { status: 502 },
    )
  }
}
