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

export const approvalGoal = 40
export const approvalThreshold = 32

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
  switchProject: (projectId: string) => void
  runCode: () => void
  commit: (message: string, description: string) => void
  resolveConflict: () => void
  executeLeap: () => void
  completeLeap: () => void
  clearLeapEffect: () => void
  resetSimulation: () => void
  approvePullRequest: () => void
}

type GitLeapTransientState = {
  command: string
  description: string
  leapEffect: boolean
  hasHydrated: boolean
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
          ...getInitialTransientState(),
          hasHydrated: true,
        })),

      approvePullRequest: () =>
        set((state) =>
          updateActiveProject(state, (project) => ({
            ...project,
            approvals: Math.min(approvalGoal, project.approvals + 1),
          })),
        ),
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
