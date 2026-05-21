import {
  fetchMockApiRecords,
  mockApiWorkspaceEndpoint,
  mockApiWorkspaceKey,
  patchMockApiRecord,
  stringValue,
  type MockApiRecord,
} from "../../mockapi"

type PeerApprovalRequest = {
  approvalGoal?: unknown
  currentApprovals?: unknown
  projectId?: unknown
  projectName?: unknown
  task?: unknown
}

const fallbackApprovalGoal = 20
const workspaceRecordType = "git-leap-workspace"
const workspaceEndpoint = mockApiWorkspaceEndpoint
const reviewers = ["An", "Binh", "Chi", "Dung", "Hanh", "Khoa", "Linh", "Minh"]

const asFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const reviewerFor = (projectId: unknown, approvalCount: number) => {
  const seed =
    typeof projectId === "string" && projectId.length > 0
      ? projectId.charCodeAt(projectId.length - 1)
      : 0

  return reviewers[(seed + approvalCount) % reviewers.length]
}

const recordId = (record: MockApiRecord) =>
  stringValue(record.id) ?? stringValue(record.objectId)

const recordType = (record: MockApiRecord) => {
  const type = stringValue(record.recordType) ?? stringValue(record.type)

  return type
}

const numericValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const recordWorkspaceKey = (record: MockApiRecord) =>
  stringValue(record.workspaceKey) ?? stringValue(record.key) ?? "default"

const isWorkspaceRecord = (record: MockApiRecord) =>
  recordType(record) === workspaceRecordType &&
  recordWorkspaceKey(record) === mockApiWorkspaceKey

const isLegacyWorkspaceRecord = (record: MockApiRecord) =>
  recordType(record) === null &&
  recordWorkspaceKey(record) === mockApiWorkspaceKey &&
  Array.isArray(record.projects)

const projectsFromRecord = (record: MockApiRecord | null) => {
  if (!record || !Array.isArray(record.projects)) {
    return null
  }

  return record.projects.filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value),
  )
}

const projectApprovalCount = (project: Record<string, unknown>) => {
  const approvals = numericValue(project.approvals)

  return approvals === null ? 0 : Math.max(0, Math.round(approvals))
}

const responsePayload = (
  projectId: string | null,
  approvalGoal: number,
  approvals: number,
  reviewedAt: string,
) => ({
  approved: true,
  approvals,
  approvalGoal,
  projectId,
  reviewer: reviewerFor(projectId, approvals),
  reviewedAt,
  message:
    approvals >= Math.ceil(approvalGoal * 0.8)
      ? "Consensus threshold reached."
      : "Peer approval recorded.",
})

async function currentWorkspaceRecord() {
  if (!workspaceEndpoint) {
    return null
  }

  const records = await fetchMockApiRecords(workspaceEndpoint)

  return (
    records.find(isWorkspaceRecord) ??
    records.find(isLegacyWorkspaceRecord) ??
    null
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")?.trim() ?? ""
  const requestedApprovalGoal = url.searchParams.get("approvalGoal")
  const approvalGoal = Math.max(
    1,
    Math.round(
      asFiniteNumber(
        requestedApprovalGoal ? Number(requestedApprovalGoal) : undefined,
        fallbackApprovalGoal,
      ),
    ),
  )

  if (!projectId) {
    return Response.json({ error: "Project id is required." }, { status: 400 })
  }

  if (!workspaceEndpoint) {
    return Response.json({
      approvals: 0,
      approvalGoal,
      projectId,
      message: "No MockAPI workspace endpoint is configured.",
    })
  }

  try {
    const workspaceRecord = await currentWorkspaceRecord()
    const projects = projectsFromRecord(workspaceRecord)
    const project =
      projects?.find((entry) => stringValue(entry.id) === projectId) ?? null
    const approvals = project ? projectApprovalCount(project) : 0

    return Response.json({
      approvals: clamp(approvals, 0, approvalGoal),
      approvalGoal,
      projectId,
      message: "Peer approval count loaded.",
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Peer approval count failed.",
      },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  let body: PeerApprovalRequest

  try {
    body = (await request.json()) as PeerApprovalRequest
  } catch {
    return Response.json(
      { error: "Approval request must be valid JSON." },
      { status: 400 },
    )
  }

  const approvalGoal = Math.max(
    1,
    Math.round(asFiniteNumber(body.approvalGoal, fallbackApprovalGoal)),
  )
  const currentApprovals = clamp(
    Math.round(asFiniteNumber(body.currentApprovals, 0)),
    0,
    approvalGoal,
  )
  const projectId = stringValue(body.projectId)

  if (!projectId) {
    return Response.json({ error: "Project id is required." }, { status: 400 })
  }

  if (!workspaceEndpoint) {
    return Response.json(
      { error: "No MockAPI workspace endpoint is configured." },
      { status: 502 },
    )
  }

  try {
    const workspaceRecord = await currentWorkspaceRecord()

    if (!workspaceRecord) {
      return Response.json(
        {
          error:
            "Workspace record not found. Peer approval only updates existing workspace data.",
        },
        { status: 409 },
      )
    }

    const workspaceRecordId = recordId(workspaceRecord)

    if (!workspaceRecordId) {
      return Response.json(
        { error: "Workspace record id is missing; cannot update approvals." },
        { status: 502 },
      )
    }

    const projects = projectsFromRecord(workspaceRecord)

    if (!projects) {
      return Response.json(
        { error: "Workspace projects are missing or invalid." },
        { status: 502 },
      )
    }

    const projectIndex = projects.findIndex(
      (project) => stringValue(project.id) === projectId,
    )

    if (projectIndex < 0) {
      return Response.json(
        { error: `Project ${projectId} not found in workspace.` },
        { status: 404 },
      )
    }

    const persistedApprovals = projectApprovalCount(projects[projectIndex])
    const baseApprovals = Math.max(persistedApprovals, currentApprovals)
    const approvals = clamp(baseApprovals + 1, 0, approvalGoal)
    const reviewedAt = new Date().toISOString()
    const nextProjects = projects.map((project, index) =>
      index === projectIndex ? { ...project, approvals } : project,
    )
    const {
      id: _id,
      objectId: _objectId,
      ...workspaceWithoutIds
    } = workspaceRecord
    const nextWorkspace = {
      ...workspaceWithoutIds,
      recordType: recordType(workspaceRecord) ?? workspaceRecordType,
      workspaceKey: recordWorkspaceKey(workspaceRecord),
      activeProjectId:
        stringValue(workspaceRecord.activeProjectId) ??
        stringValue(body.projectId) ??
        null,
      projects: nextProjects,
      updatedAt: reviewedAt,
    }

    await patchMockApiRecord(
      workspaceEndpoint,
      workspaceRecordId,
      nextWorkspace,
    )

    return Response.json(
      responsePayload(projectId, approvalGoal, approvals, reviewedAt),
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "MockAPI peer approval request failed.",
      },
      { status: 502 },
    )
  }
}
