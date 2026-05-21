"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type Tone = "info" | "success" | "warning" | "error" | "muted"

export type TerminalLine = {
  tone: Tone
  text: string
}

export type CommitEntry = {
  message: string
  description: string
  timestamp: number
}

export type ProjectTask = {
  message: string
  description: string
}

export type ProjectSession = {
  id: string
  name: string
  slug: string
  task: string
  taskPlan: ProjectTask[]
  createdAt: number
  hasRunCode: boolean
  commits: CommitEntry[]
  terminalLines: TerminalLine[]
  conflictActive: boolean
  conflictResolved: boolean
  leaped: boolean
  approvals: number
}

export const approvalGoal = 20
export const approvalThreshold = 32

const peerApprovalEndpoint = "/api/peer-approvals"
const workspaceEndpoint = "/api/workspace"

const defaultProjectId = "project-default"
const defaultProjectName = "MLN Study Discipline"
const defaultProjectTask =
  "Turn daily study into disciplined engineering practice"

export const initialTerminal: TerminalLine[] = [
  {
    tone: "info",
    text: "CloudIDE booted: dialectical-study-simulator@16.2.6",
  },
  {
    tone: "muted",
    text: "Awaiting runtime check or quantitative commits...",
  },
]

type PersistedGitLeapState = {
  activeProjectId: string
  projects: ProjectSession[]
}

type LegacyGitLeapState = {
  hasRunCode?: boolean
  commits?: CommitEntry[]
  terminalLines?: TerminalLine[]
  conflictActive?: boolean
  conflictResolved?: boolean
  leaped?: boolean
  approvals?: number
}

type GitLeapActions = {
  setHydrated: (hasHydrated: boolean) => void
  setCommand: (command: string) => void
  setDescription: (description: string) => void
  appendTerminal: (lines: TerminalLine[]) => void
  createProject: (name: string, task: string) => void
  removeProject: (projectId: string) => void
  switchProject: (projectId: string) => void
  runCode: () => void
  commit: (message: string, description: string) => void
  resolveConflict: () => void
  executeLeap: () => void
  completeLeap: () => void
  clearLeapEffect: () => void
  resetSimulation: () => void
  syncWorkspaceFromMockApi: () => Promise<void>
  saveWorkspaceToMockApi: () => Promise<void>
  approvePullRequest: () => Promise<void>
  syncPullRequestApprovals: () => Promise<void>
}

type GitLeapTransientState = {
  command: string
  description: string
  leapEffect: boolean
  hasHydrated: boolean
  hasSyncedMockApi: boolean
}

export type GitLeapState = PersistedGitLeapState &
  GitLeapTransientState &
  GitLeapActions

const appendLines = (current: TerminalLine[], next: TerminalLine[]) =>
  [...current, ...next].slice(-10)

const cleanText = (value: string, fallback: string) => {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : fallback
}

const toSlug = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 34)

  return slug || "project"
}

function buildTaskPlan(task: string): ProjectTask[] {
  const focus = cleanText(task, "project momentum")

  return [
    {
      message: `Day 1: Start ${focus}`,
      description: "Define scope and make the first visible move.",
    },
    {
      message: `Day 2: Remove blockers for ${focus}`,
      description: "Clear distractions and friction around the work.",
    },
    {
      message: `Day 3: Study the core of ${focus}`,
      description: "Collect notes, examples, and missing context.",
    },
    {
      message: `Day 4: Practice ${focus}`,
      description: "Turn the idea into a repeatable action.",
    },
    {
      message: `Day 5: Guard ${focus}`,
      description: "Protect the streak when resistance appears.",
    },
    {
      message: `Day 6: Ship ${focus}`,
      description: "Consolidate the accumulated work into a finished pass.",
    },
  ]
}

export const dayCommands = buildTaskPlan(defaultProjectTask)

function projectTerminal(name: string, task: string): TerminalLine[] {
  return [
    ...initialTerminal,
    {
      tone: "success",
      text: `Project loaded: ${name}`,
    },
    {
      tone: "muted",
      text: `Task focus: ${task}`,
    },
  ]
}

function createProjectSession(
  id: string,
  name: string,
  task: string,
  createdAt = Date.now(),
): ProjectSession {
  const projectName = cleanText(name, "Untitled Project")
  const projectTask = cleanText(task, "Build consistent progress")

  return {
    id,
    name: projectName,
    slug: toSlug(projectName),
    task: projectTask,
    taskPlan: buildTaskPlan(projectTask),
    createdAt,
    hasRunCode: false,
    commits: [],
    terminalLines: projectTerminal(projectName, projectTask),
    conflictActive: false,
    conflictResolved: false,
    leaped: false,
    approvals: 0,
  }
}

const getDefaultProject = () =>
  createProjectSession(
    defaultProjectId,
    defaultProjectName,
    defaultProjectTask,
    0,
  )

const getInitialPersistentState = (): PersistedGitLeapState => {
  const defaultProject = getDefaultProject()

  return {
    activeProjectId: defaultProject.id,
    projects: [defaultProject],
  }
}

const getInitialTransientState = (): GitLeapTransientState => ({
  command: "",
  description: "",
  leapEffect: false,
  hasHydrated: false,
  hasSyncedMockApi: false,
})

const activeProjectFrom = (state: PersistedGitLeapState) =>
  state.projects.find((project) => project.id === state.activeProjectId) ??
  state.projects[0]

const updateActiveProject = (
  state: GitLeapState,
  update: (project: ProjectSession) => ProjectSession,
) => {
  const projects = state.projects.length > 0 ? state.projects : [getDefaultProject()]
  const activeId = projects.some((project) => project.id === state.activeProjectId)
    ? state.activeProjectId
    : projects[0].id

  return {
    activeProjectId: activeId,
    projects: projects.map((project) =>
      project.id === activeId ? update(project) : project,
    ),
  }
}

const updateProjectById = (
  state: GitLeapState,
  projectId: string,
  update: (project: ProjectSession) => ProjectSession,
) => ({
  projects: state.projects.map((project) =>
    project.id === projectId ? update(project) : project,
  ),
})

export const isProjectStarted = (project: ProjectSession) =>
  project.hasRunCode ||
  project.commits.length > 0 ||
  project.conflictActive ||
  project.conflictResolved ||
  project.leaped ||
  project.approvals > 0

export const isProjectReadyForLeap = (project: ProjectSession) =>
  project.commits.length >= 6 &&
  project.conflictResolved &&
  !project.conflictActive &&
  !project.leaped

const quoteCommand = (value: string) => JSON.stringify(value)

const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const responseRecords = (payload: unknown) => {
  const record = asRecord(payload)
  const nested = asRecord(record?.data)

  return [record, nested].filter(
    (value): value is Record<string, unknown> => value !== null,
  )
}

const numberFromRecord = (
  records: Record<string, unknown>[],
  keys: string[],
) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key]

      if (typeof value === "number" && Number.isFinite(value)) {
        return value
      }
    }
  }

  return null
}

const stringFromRecord = (
  records: Record<string, unknown>[],
  keys: string[],
) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key]

      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim()
      }
    }
  }

  return null
}

const approvalAcceptedFrom = (records: Record<string, unknown>[]) => {
  for (const record of records) {
    const approved = record.approved ?? record.accepted

    if (typeof approved === "boolean") {
      return approved
    }
  }

  return null
}

const readResponseJson = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

const peerApprovalErrorFrom = (payload: unknown, status: number) => {
  const message = stringFromRecord(responseRecords(payload), [
    "error",
    "message",
  ])

  return message ?? `Peer approval API failed with status ${status}.`
}

const peerApprovalDetailsFrom = (payload: unknown) => {
  const records = responseRecords(payload)

  return {
    accepted: approvalAcceptedFrom(records),
    approvals:
      typeof payload === "number" && Number.isFinite(payload)
        ? payload
        : numberFromRecord(records, [
            "approvals",
            "totalApprovals",
            "approvalCount",
            "count",
          ]),
    message: stringFromRecord(records, ["message"]),
    reviewer: stringFromRecord(records, ["reviewer", "peer", "approvedBy"]),
  }
}

const nextApprovalCount = (
  currentApprovals: number,
  payload: unknown,
) => {
  const details = peerApprovalDetailsFrom(payload)
  const reportedApprovals =
    details.approvals === null
      ? null
      : Math.min(approvalGoal, Math.max(0, Math.round(details.approvals)))

  if (details.accepted === false) {
    return reportedApprovals ?? currentApprovals
  }

  if (reportedApprovals === null || reportedApprovals <= currentApprovals) {
    return Math.min(approvalGoal, currentApprovals + 1)
  }

  return reportedApprovals
}

const workspaceRecordFrom = (payload: unknown) => {
  const record = asRecord(payload)
  const candidates = [
    asRecord(record?.workspace),
    asRecord(record?.data),
    record,
  ].filter((value): value is Record<string, unknown> => value !== null)

  return (
    candidates.find((candidate) => Array.isArray(candidate.projects)) ?? null
  )
}

const workspaceStateFrom = (payload: unknown) => {
  const record = workspaceRecordFrom(payload)

  if (!record || !Array.isArray(record.projects)) {
    return null
  }

  const projects = record.projects.map((project, index) =>
    normalizeProject(
      (asRecord(project) as Partial<ProjectSession> | null) ?? undefined,
      index,
    ),
  )

  if (projects.length === 0) {
    return null
  }

  const activeProjectId =
    typeof record.activeProjectId === "string" &&
    projects.some((project) => project.id === record.activeProjectId)
      ? record.activeProjectId
      : projects[0].id

  return { activeProjectId, projects }
}

const workspaceErrorFrom = (payload: unknown, status: number) => {
  const message = stringFromRecord(responseRecords(payload), [
    "error",
    "message",
  ])

  return message ?? `Workspace API failed with status ${status}.`
}

const normalizeProject = (
  project: Partial<ProjectSession> | undefined,
  index: number,
) => {
  const fallback = createProjectSession(
    `project-${index + 1}`,
    `Project ${index + 1}`,
    "Build consistent progress",
    Date.now() + index,
  )

  if (!project) {
    return fallback
  }

  const base = createProjectSession(
    typeof project.id === "string" && project.id.length > 0
      ? project.id
      : fallback.id,
    typeof project.name === "string" ? project.name : fallback.name,
    typeof project.task === "string" ? project.task : fallback.task,
    typeof project.createdAt === "number" ? project.createdAt : fallback.createdAt,
  )

  return {
    ...base,
    hasRunCode: Boolean(project.hasRunCode),
    commits: Array.isArray(project.commits) ? project.commits : [],
    terminalLines:
      Array.isArray(project.terminalLines) && project.terminalLines.length > 0
        ? project.terminalLines
        : base.terminalLines,
    conflictActive: Boolean(project.conflictActive),
    conflictResolved: Boolean(project.conflictResolved),
    leaped: Boolean(project.leaped),
    approvals:
      typeof project.approvals === "number"
        ? Math.min(approvalGoal, Math.max(0, project.approvals))
        : 0,
    taskPlan:
      Array.isArray(project.taskPlan) && project.taskPlan.length > 0
        ? project.taskPlan
        : base.taskPlan,
  }
}

const migratePersistedState = (
  persistedState: unknown,
): PersistedGitLeapState => {
  const state = persistedState as
    | Partial<PersistedGitLeapState & LegacyGitLeapState>
    | undefined

  if (!state) {
    return getInitialPersistentState()
  }

  if (Array.isArray(state.projects) && state.projects.length > 0) {
    const projects = state.projects.map(normalizeProject)
    const activeProjectId =
      typeof state.activeProjectId === "string" &&
      projects.some((project) => project.id === state.activeProjectId)
        ? state.activeProjectId
        : projects[0].id

    return { activeProjectId, projects }
  }

  const migratedProject = {
    ...getDefaultProject(),
    hasRunCode: Boolean(state.hasRunCode),
    commits: Array.isArray(state.commits) ? state.commits : [],
    terminalLines:
      Array.isArray(state.terminalLines) && state.terminalLines.length > 0
        ? state.terminalLines
        : getDefaultProject().terminalLines,
    conflictActive: Boolean(state.conflictActive),
    conflictResolved: Boolean(state.conflictResolved),
    leaped: Boolean(state.leaped),
    approvals:
      typeof state.approvals === "number"
        ? Math.min(approvalGoal, Math.max(0, state.approvals))
        : 0,
  }

  return {
    activeProjectId: migratedProject.id,
    projects: [migratedProject],
  }
}

export const useGitLeapStore = create<GitLeapState>()(
  persist(
    (set, get) => ({
      ...getInitialPersistentState(),
      ...getInitialTransientState(),

      setHydrated: (hasHydrated) => set({ hasHydrated }),

      setCommand: (command) => set({ command }),

      setDescription: (description) => set({ description }),

      appendTerminal: (lines) =>
        set((state) =>
          updateActiveProject(state, (project) => ({
            ...project,
            terminalLines: appendLines(project.terminalLines, lines),
          })),
        ),

      createProject: (name, task) => {
        const project = createProjectSession(
          `project-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          name,
          task,
        )

        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          command: "",
          description: "",
          leapEffect: false,
        }))
      },

      removeProject: (projectId) =>
        set((state) => {
          if (
            state.projects.length <= 1 ||
            !state.projects.some((project) => project.id === projectId)
          ) {
            return {}
          }

          const projects = state.projects.filter(
            (project) => project.id !== projectId,
          )
          const shouldChooseNextActive =
            state.activeProjectId === projectId ||
            !projects.some((project) => project.id === state.activeProjectId)

          return {
            projects,
            activeProjectId: shouldChooseNextActive
              ? projects[0].id
              : state.activeProjectId,
            ...(shouldChooseNextActive
              ? {
                  command: "",
                  description: "",
                  leapEffect: false,
                }
              : {}),
          }
        }),

      switchProject: (projectId) =>
        set((state) => {
          if (!state.projects.some((project) => project.id === projectId)) {
            return {}
          }

          return {
            activeProjectId: projectId,
            command: "",
            description: "",
            leapEffect: false,
          }
        }),

      runCode: () => {
        const project = activeProjectFrom(get())

        if (!project) {
          return
        }

        if (project.leaped) {
          set((state) =>
            updateActiveProject(state, (current) => ({
              ...current,
              hasRunCode: true,
              terminalLines: appendLines(current.terminalLines, [
                { tone: "info", text: "$ npm run build:student-soul" },
                {
                  tone: "success",
                  text: `Build passed: ${current.slug} compiled with zero regressions.`,
                },
              ]),
            })),
          )
          return
        }

        set((state) =>
          updateActiveProject(state, (current) => ({
            ...current,
            hasRunCode: true,
            terminalLines: appendLines(current.terminalLines, [
              {
                tone: "info",
                text: `$ node src/projects/${current.slug}/procrastination_mindset.json`,
              },
              {
                tone: "error",
                text: `RuntimeError: ${current.task} needs more accumulated practice before it can ship.`,
              },
            ]),
          })),
        )
      },

      commit: (message, description) => {
        const state = get()
        const project = activeProjectFrom(state)

        if (!project) {
          return
        }

        const trimmedMessage = message.trim()
        const trimmedDescription = description.trim()

        if (project.leaped) {
          set((currentState) =>
            updateActiveProject(currentState, (current) => ({
              ...current,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: "success",
                  text: `${current.name} is already refactored. New quality is active in production.`,
                },
              ]),
            })),
          )
          return
        }

        if (!trimmedMessage) {
          set((currentState) =>
            updateActiveProject(currentState, (current) => ({
              ...current,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: "warning",
                  text: "Commit message required.",
                },
              ]),
            })),
          )
          return
        }

        const nextCommitCount = project.commits.length + 1

        if (nextCommitCount === 5 && !project.conflictResolved) {
          set((currentState) =>
            updateActiveProject(currentState, (current) => ({
              ...current,
              conflictActive: true,
              terminalLines: appendLines(current.terminalLines, [
                { tone: "info", text: `$ git commit -m ${quoteCommand(trimmedMessage)}` },
                {
                  tone: "error",
                  text: `CONFLICT (${current.slug}): distraction temptation detected.`,
                },
                {
                  tone: "warning",
                  text: 'Resolve required: run "git resolve --discipline" to preserve accumulation.',
                },
              ]),
            })),
          )
          return
        }

        set((currentState) =>
          updateActiveProject(currentState, (current) => {
            const commitCount = current.commits.length + 1

            return {
              ...current,
              commits: [
                ...current.commits,
                {
                  message: trimmedMessage,
                  description: trimmedDescription,
                  timestamp: Date.now(),
                },
              ],
              terminalLines: appendLines(current.terminalLines, [
                { tone: "info", text: `$ git commit -m ${quoteCommand(trimmedMessage)}` },
                {
                  tone: "success",
                  text: `Commit accepted for ${current.name}: quantity increased to ${Math.round(
                    (commitCount / 6) * 100,
                  )}%.`,
                },
              ]),
            }
          }),
        )

        set({ command: "", description: "" })
      },

      resolveConflict: () => {
        const project = activeProjectFrom(get())

        if (!project) {
          return
        }

        if (!project.conflictActive) {
          set((state) =>
            updateActiveProject(state, (current) => ({
              ...current,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: "muted",
                  text: "No active merge conflict. Discipline daemon is standing by.",
                },
              ]),
            })),
          )
          return
        }

        set((state) =>
          updateActiveProject(state, (current) => {
            const guardedTask = current.taskPlan[4] ?? {
              message: `Day 5: Guard ${current.task}`,
              description: "Protect the project when resistance appears.",
            }

            return {
              ...current,
              conflictActive: false,
              conflictResolved: true,
              commits:
                current.commits.length === 4
                  ? [
                      ...current.commits,
                      {
                        message: guardedTask.message,
                        description: guardedTask.description,
                        timestamp: Date.now(),
                      },
                    ]
                  : current.commits,
              terminalLines: appendLines(current.terminalLines, [
                { tone: "info", text: "$ git resolve --discipline" },
                {
                  tone: "success",
                  text: `Conflict resolved for ${current.name}: the task streak survived.`,
                },
              ]),
            }
          }),
        )
      },

      executeLeap: () => {
        const project = activeProjectFrom(get())

        if (!project) {
          return
        }

        if (project.leaped) {
          set((state) =>
            updateActiveProject(state, (current) => ({
              ...current,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: "success",
                  text: `${current.slug}/disciplined_engineer.ts is already the active production branch.`,
                },
              ]),
            })),
          )
          return
        }

        if (!isProjectReadyForLeap(project)) {
          set((state) =>
            updateActiveProject(state, (current) => ({
              ...current,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: "warning",
                  text: "Deploy locked: reach 6 commits and resolve the crisis before the Critical Node.",
                },
              ]),
            })),
          )
          return
        }

        set((state) =>
          updateActiveProject(state, (current) => ({
            ...current,
            terminalLines: appendLines(current.terminalLines, [
              {
                tone: "info",
                text: `$ git push origin ${current.slug} --force-with-discipline`,
              },
              {
                tone: "warning",
                text: `Critical Node crossed for ${current.name}: compiling Bước Nhảy...`,
              },
            ]),
          })),
        )
        set({ leapEffect: true })
      },

      completeLeap: () =>
        set((state) =>
          updateActiveProject(state, (current) => ({
            ...current,
            leaped: true,
            hasRunCode: false,
            terminalLines: appendLines(current.terminalLines, [
              {
                tone: "success",
                text: `Refactor complete: ${current.name} replaced old quality with disciplined_engineer.ts.`,
              },
            ]),
          })),
        ),

      clearLeapEffect: () => set({ leapEffect: false }),

      resetSimulation: () =>
        set((state) => ({
          ...updateActiveProject(state, (current) =>
            createProjectSession(current.id, current.name, current.task, current.createdAt),
          ),
          command: "",
          description: "",
          leapEffect: false,
          hasHydrated: true,
          hasSyncedMockApi: state.hasSyncedMockApi,
        })),

      syncWorkspaceFromMockApi: async () => {
        try {
          const response = await fetch(workspaceEndpoint, { cache: "no-store" })
          const payload = await readResponseJson(response)

          if (!response.ok) {
            set({ hasSyncedMockApi: true })
            throw new Error(workspaceErrorFrom(payload, response.status))
          }

          const workspace = workspaceStateFrom(payload)

          if (!workspace) {
            set({ hasSyncedMockApi: true })
            return
          }

          set({
            ...workspace,
            command: "",
            description: "",
            leapEffect: false,
            hasSyncedMockApi: true,
          })
        } catch (error) {
          set({ hasSyncedMockApi: true })

          throw error
        }
      },

      saveWorkspaceToMockApi: async () => {
        const state = get()
        const response = await fetch(workspaceEndpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activeProjectId: state.activeProjectId,
            projects: state.projects,
          }),
        })
        const payload = await readResponseJson(response)

        if (!response.ok) {
          throw new Error(workspaceErrorFrom(payload, response.status))
        }
      },

      approvePullRequest: async () => {
        const project = activeProjectFrom(get())

        if (!project || project.approvals >= approvalGoal) {
          return
        }

        const response = await fetch(peerApprovalEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approvalGoal,
            currentApprovals: project.approvals,
            projectId: project.id,
            projectName: project.name,
            task: project.task,
          }),
        })
        const payload = await readResponseJson(response)

        if (!response.ok) {
          throw new Error(peerApprovalErrorFrom(payload, response.status))
        }

        set((state) =>
          updateProjectById(state, project.id, (current) => {
            const approvals = nextApprovalCount(current.approvals, payload)
            const details = peerApprovalDetailsFrom(payload)
            const reviewer = details.reviewer
              ? ` by ${details.reviewer}`
              : ""
            const unchanged = approvals <= current.approvals

            return {
              ...current,
              approvals,
              terminalLines: appendLines(current.terminalLines, [
                {
                  tone: unchanged ? "muted" : "success",
                  text: unchanged
                    ? details.message ?? "Peer approval API returned no change."
                    : `Peer approval${reviewer}: ${approvals}/${approvalGoal} approvals recorded.`,
                },
              ]),
            }
          }),
        )
      },

      syncPullRequestApprovals: async () => {
        const project = activeProjectFrom(get())

        if (!project) {
          return
        }

        const params = new URLSearchParams({
          approvalGoal: String(approvalGoal),
          projectId: project.id,
        })
        const response = await fetch(`${peerApprovalEndpoint}?${params}`, {
          cache: "no-store",
        })
        const payload = await readResponseJson(response)

        if (!response.ok) {
          throw new Error(peerApprovalErrorFrom(payload, response.status))
        }

        const details = peerApprovalDetailsFrom(payload)

        if (details.approvals === null) {
          return
        }

        const remoteApprovals = Math.min(
          approvalGoal,
          Math.max(0, Math.round(details.approvals)),
        )

        set((state) =>
          updateProjectById(state, project.id, (current) => ({
            ...current,
            approvals: Math.max(current.approvals, remoteApprovals),
          })),
        )
      },
    }),
    {
      name: "git-leap-compiler-session",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        projects: state.projects,
      }),
      migrate: migratePersistedState,
    },
  ),
)
