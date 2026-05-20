"use client"

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  approvalGoal,
  approvalThreshold,
  isProjectReadyForLeap,
  isProjectStarted,
  type CommitEntry,
  type ProjectSession,
  type ProjectTask,
  type TerminalLine,
  type Tone,
  useGitLeapStore,
} from "./git-leap-store"

const codeParticles = [
  "commit",
  "push",
  "refactor",
  "merge",
  "focus++",
  "quality",
  "resolve",
  "deploy",
  "build",
  "discipline",
  "node",
  "leap",
]

export default function Home() {
  const projects = useGitLeapStore((state) => state.projects)
  const activeProjectId = useGitLeapStore((state) => state.activeProjectId)
  const command = useGitLeapStore((state) => state.command)
  const description = useGitLeapStore((state) => state.description)
  const leapEffect = useGitLeapStore((state) => state.leapEffect)
  const hasHydrated = useGitLeapStore((state) => state.hasHydrated)
  const setCommand = useGitLeapStore((state) => state.setCommand)
  const setDescription = useGitLeapStore((state) => state.setDescription)
  const setHydrated = useGitLeapStore((state) => state.setHydrated)
  const createProject = useGitLeapStore((state) => state.createProject)
  const switchProject = useGitLeapStore((state) => state.switchProject)
  const runCode = useGitLeapStore((state) => state.runCode)
  const commit = useGitLeapStore((state) => state.commit)
  const resolveConflict = useGitLeapStore((state) => state.resolveConflict)
  const executeLeap = useGitLeapStore((state) => state.executeLeap)
  const completeLeap = useGitLeapStore((state) => state.completeLeap)
  const clearLeapEffect = useGitLeapStore((state) => state.clearLeapEffect)
  const resetSimulation = useGitLeapStore((state) => state.resetSimulation)
  const approvePullRequest = useGitLeapStore(
    (state) => state.approvePullRequest,
  )

  const [projectName, setProjectName] = useState("")
  const [projectTask, setProjectTask] = useState("")

  const activeProject = useMemo(
    () =>
      projects.find((project) => project.id === activeProjectId) ??
      projects[0] ??
      null,
    [activeProjectId, projects],
  )

  const commits = activeProject?.commits ?? []
  const terminalLines = activeProject?.terminalLines ?? []
  const hasRunCode = activeProject?.hasRunCode ?? false
  const conflictActive = activeProject?.conflictActive ?? false
  const leaped = activeProject?.leaped ?? false
  const approvals = activeProject?.approvals ?? 0
  const readyForLeap = activeProject
    ? isProjectReadyForLeap(activeProject)
    : false
  const approvalPercent = Math.min(
    100,
    Math.round((approvals / approvalGoal) * 100),
  )
  const thresholdPercent = Math.round((approvalThreshold / approvalGoal) * 100)
  const consensusReached = approvals >= approvalThreshold
  const hasSavedSession =
    hasHydrated &&
    (projects.length > 1 || projects.some((project) => isProjectStarted(project)))

  useEffect(() => {
    const unsubscribe = useGitLeapStore.persist.onFinishHydration(() => {
      useGitLeapStore.getState().setHydrated(true)
    })

    if (useGitLeapStore.persist.hasHydrated()) {
      setHydrated(true)
    } else {
      void useGitLeapStore.persist.rehydrate()
    }

    return unsubscribe
  }, [setHydrated])

  useEffect(() => {
    if (!leapEffect || leaped) {
      return
    }

    const completeTimer = window.setTimeout(() => {
      completeLeap()
    }, 850)
    const clearTimer = window.setTimeout(() => {
      clearLeapEffect()
    }, 2500)

    return () => {
      window.clearTimeout(completeTimer)
      window.clearTimeout(clearTimer)
    }
  }, [clearLeapEffect, completeLeap, leapEffect, leaped])

  const statusCopy = useMemo(() => {
    const projectTaskName = activeProject?.task ?? "this project"

    if (leaped) {
      return {
        label: activeProject
          ? `New Quality: ${activeProject.name}`
          : "New Quality Reached",
        detail: `${projectTaskName} has crossed from accumulated practice into a stable new habit.`,
        tone: "success" as const,
      }
    }

    if (conflictActive) {
      return {
        label: "Merge Conflict: Temptation Detected",
        detail: `A distraction conflict is trying to interrupt ${projectTaskName}.`,
        tone: "error" as const,
      }
    }

    if (readyForLeap) {
      return {
        label: "Critical Node Reached: Điểm Nút",
        detail: `${projectTaskName} has enough quantity for a qualitative leap.`,
        tone: "warning" as const,
      }
    }

    if (commits.length > 0) {
      return {
        label: "Within the Bound of 'Độ'",
        detail:
          "Quantity is rising, but the core quality stays stable until the threshold.",
        tone: "info" as const,
      }
    }

    return {
      label: "Status: Ready for First Commit",
      detail: `${projectTaskName} is waiting for its first visible unit of progress.`,
      tone: "muted" as const,
    }
  }, [activeProject, commits.length, conflictActive, leaped, readyForLeap])

  const nextAction = useMemo(() => {
    const name = activeProject?.name ?? "Project"

    if (!hasHydrated) {
      return "Restoring saved projects..."
    }

    if (leaped) {
      return `${name} is complete. Review approvals can still continue.`
    }

    if (conflictActive) {
      return `${name}: run "git resolve --discipline" to keep the streak alive.`
    }

    if (readyForLeap) {
      return `${name}: deploy the project to trigger the leap.`
    }

    return `${name}: commit task ${commits.length + 1} of 6.`
  }, [
    activeProject,
    commits.length,
    conflictActive,
    hasHydrated,
    leaped,
    readyForLeap,
  ])

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = command.trim()

    if (!trimmed) {
      return
    }

    commit(trimmed, description)
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!projectName.trim() && !projectTask.trim()) {
      return
    }

    createProject(projectName, projectTask)
    setProjectName("")
    setProjectTask("")
  }

  function pickTask(task: ProjectTask) {
    setCommand(task.message)
    setDescription(task.description)
  }

  if (!activeProject) {
    return (
      <main className='grid min-h-screen place-items-center bg-[#080d18] text-slate-100'>
        Restoring workspace...
      </main>
    )
  }

  return (
    <main
      className={`ide-shell min-h-screen overflow-hidden bg-[#080d18] text-slate-100 ${
        conflictActive ? "conflict-mode" : ""
      }`}
    >
      {leapEffect ? <LeapOverlay /> : null}
      <TopBar
        activeProject={activeProject}
        hasHydrated={hasHydrated}
        hasSavedSession={hasSavedSession}
        nextAction={nextAction}
        readyForLeap={readyForLeap}
        onDeploy={executeLeap}
        onReset={resetSimulation}
      />

      <div className='grid min-h-[calc(100vh-60px)] grid-cols-1 border-t border-slate-700/70 lg:grid-cols-[360px_minmax(0,1fr)_370px]'>
        <Explorer
          activeProject={activeProject}
          activeProjectId={activeProjectId}
          projects={projects}
          projectName={projectName}
          projectTask={projectTask}
          onCreateProject={submitProject}
          onPickTask={pickTask}
          onProjectNameChange={setProjectName}
          onProjectTaskChange={setProjectTask}
          onSwitchProject={switchProject}
        />

        <section className='flex min-h-[760px] flex-col border-x border-slate-700/70 bg-[#090f1d]/95'>
          <EditorHeader
            activeProject={activeProject}
            leaped={leaped}
            onRun={runCode}
          />
          <CodeEditor
            activeProject={activeProject}
            leaped={leaped}
            hasRunCode={hasRunCode}
            commits={commits}
          />
          <CommitSandbox
            activeProject={activeProject}
            commits={commits}
            status={statusCopy}
            command={command}
            description={description}
            terminalLines={terminalLines}
            conflictActive={conflictActive}
            readyForLeap={readyForLeap}
            leaped={leaped}
            setCommand={setCommand}
            setDescription={setDescription}
            onSubmitCommand={submitCommand}
            onResolve={resolveConflict}
            onLeap={executeLeap}
          />
        </section>

        <ReviewPanel
          activeProject={activeProject}
          approvals={approvals}
          approvalPercent={approvalPercent}
          thresholdPercent={thresholdPercent}
          consensusReached={consensusReached}
          onApprove={approvePullRequest}
        />
      </div>
    </main>
  )
}

function TopBar({
  activeProject,
  hasHydrated,
  hasSavedSession,
  nextAction,
  readyForLeap,
  onDeploy,
  onReset,
}: {
  activeProject: ProjectSession
  hasHydrated: boolean
  hasSavedSession: boolean
  nextAction: string
  readyForLeap: boolean
  onDeploy: () => void
  onReset: () => void
}) {
  return (
    <header className='flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-emerald-300/20 bg-[#08101f]/95 px-4 sm:px-6'>
      <div className='flex min-w-0 flex-wrap items-center gap-5'>
        <div className='text-xl font-black tracking-tight text-emerald-300 sm:text-2xl'>
          CloudIDE
        </div>
        <nav className='hidden items-center gap-7 text-sm font-semibold text-slate-300 md:flex'>
          <span className='text-emerald-300'>File</span>
          <span>Edit</span>
          <span>Selection</span>
          <span>View</span>
          <span>Go</span>
          <span>Run</span>
          <span>Terminal</span>
          <span>Help</span>
        </nav>
      </div>

      <div className='hidden min-w-0 flex-1 justify-center px-4 xl:flex'>
        <div className='min-w-0 rounded-[4px] border border-slate-700 bg-slate-950/70 px-3 py-2'>
          <div className='font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300'>
            {hasHydrated
              ? hasSavedSession
                ? "Zustand Persist: Projects Restored"
                : "Zustand Persist: Autosave Ready"
              : "Zustand Persist: Restoring"}
          </div>
          <div className='truncate text-xs text-slate-300'>
            <span className='text-cyan-200'>{activeProject.name}</span>
            <span className='px-2 text-slate-500'>/</span>
            {nextAction}
          </div>
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={onDeploy}
          className={`h-10 rounded-[4px] border px-5 text-sm font-bold transition ${
            readyForLeap
              ? "border-emerald-200 bg-emerald-300 text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.55)] hover:bg-emerald-200"
              : "border-slate-600 bg-slate-800 text-slate-400"
          }`}
          aria-label='Deploy active project'
        >
          Deploy
        </button>
        <button
          type='button'
          onClick={onReset}
          className='h-10 rounded-[4px] border border-slate-600 bg-slate-900 px-4 text-sm font-bold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200'
        >
          Reset Project
        </button>
        <div className='hidden items-center gap-3 text-2xl text-slate-300 sm:flex'>
          <span aria-hidden='true'>⚙</span>
          <span aria-hidden='true'>?</span>
          <span aria-hidden='true'>⌁</span>
        </div>
      </div>
    </header>
  )
}

function Explorer({
  activeProject,
  activeProjectId,
  projects,
  projectName,
  projectTask,
  onCreateProject,
  onPickTask,
  onProjectNameChange,
  onProjectTaskChange,
  onSwitchProject,
}: {
  activeProject: ProjectSession
  activeProjectId: string
  projects: ProjectSession[]
  projectName: string
  projectTask: string
  onCreateProject: (event: FormEvent<HTMLFormElement>) => void
  onPickTask: (task: ProjectTask) => void
  onProjectNameChange: (value: string) => void
  onProjectTaskChange: (value: string) => void
  onSwitchProject: (projectId: string) => void
}) {
  const progress = Math.min(
    100,
    Math.round((activeProject.commits.length / 6) * 100),
  )

  return (
    <aside className='border-b border-slate-700 bg-[#060b17] lg:border-b-0'>
      <div className='flex h-[42px] items-center justify-between border-b border-slate-700 px-5 text-sm font-bold uppercase tracking-[0.14em] text-slate-300'>
        Explorer
        <span className='text-slate-400'>...</span>
      </div>

      <div className='space-y-5 px-5 py-4 font-mono text-sm'>
        <form
          onSubmit={onCreateProject}
          className='space-y-3 rounded-[6px] border border-cyan-300/30 bg-slate-950/80 p-3'
        >
          <div className='text-xs uppercase tracking-[0.16em] text-cyan-200'>
            New Project
          </div>
          <input
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            className='h-9 w-full rounded-[4px] border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300'
            placeholder='Project name'
            aria-label='Project name'
          />
          <input
            value={projectTask}
            onChange={(event) => onProjectTaskChange(event.target.value)}
            className='h-9 w-full rounded-[4px] border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300'
            placeholder='Main task'
            aria-label='Main task'
          />
          <button
            type='submit'
            className='h-9 w-full rounded-[4px] border border-emerald-300 bg-emerald-300 text-sm font-black text-slate-950 transition hover:bg-emerald-200'
          >
            Create Project
          </button>
        </form>

        <div className='space-y-2'>
          <div className='text-xs uppercase tracking-[0.16em] text-slate-400'>
            Projects
          </div>
          {projects.map((project) => {
            const isActive = project.id === activeProjectId
            const projectProgress = Math.min(
              100,
              Math.round((project.commits.length / 6) * 100),
            )

            return (
              <button
                key={project.id}
                type='button'
                onClick={() => onSwitchProject(project.id)}
                className={`w-full rounded-[4px] border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-emerald-300 bg-emerald-300/10 text-emerald-100"
                    : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-cyan-300"
                }`}
              >
                <div className='flex min-w-0 items-center justify-between gap-3'>
                  <span className='truncate font-bold'>{project.name}</span>
                  <span className='shrink-0 text-xs text-slate-400'>
                    {project.commits.length}/6
                  </span>
                </div>
                <div className='mt-1 truncate text-xs text-slate-500'>
                  {project.task}
                </div>
                <div className='mt-2 h-1 overflow-hidden rounded-full bg-slate-800'>
                  <div
                    className='h-full bg-cyan-300 transition-all duration-500'
                    style={{ width: `${projectProgress}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        <div>
          <div className='flex items-center gap-2 text-slate-200'>
            <span>⌄</span>
            <span className='text-cyan-300'>▣</span>
            <span>src</span>
          </div>
          <div className='mt-3 ml-5 space-y-3'>
            <div className='flex items-center gap-2 text-slate-200'>
              <span>⌄</span>
              <span className='text-emerald-300'>▣</span>
              <span>projects</span>
            </div>
            <div className='ml-6 space-y-3'>
              <div className='flex items-center gap-2 text-slate-200'>
                <span>⌄</span>
                <span className='text-emerald-300'>▣</span>
                <span className='truncate'>{activeProject.slug}</span>
              </div>
              <div className={`file-row ${!activeProject.leaped ? "file-row-active" : ""}`}>
                <span className='text-rose-300'>{`{}`}</span>
                <span>procrastination_mindset.json</span>
              </div>
              <div className={`file-row ${activeProject.leaped ? "file-row-active" : ""}`}>
                <span className='text-cyan-300'>{`<>`}</span>
                <span>disciplined_engineer.ts</span>
              </div>
            </div>
          </div>
        </div>

        <div className='rounded-[6px] border border-slate-700/80 bg-slate-900/70 p-4'>
          <div className='text-xs uppercase tracking-[0.16em] text-slate-400'>
            Task Queue
          </div>
          <div className='mt-3 space-y-2'>
            {activeProject.taskPlan.map((task, index) => {
              const isDone = index < activeProject.commits.length
              const isNext =
                index === activeProject.commits.length && !activeProject.leaped

              return (
                <button
                  key={`${task.message}-${index}`}
                  type='button'
                  onClick={() => onPickTask(task)}
                  className={`flex w-full min-w-0 items-start gap-2 rounded-[4px] border px-2 py-2 text-left transition ${
                    isNext
                      ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
                      : isDone
                        ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                        : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <span className='grid h-5 w-5 shrink-0 place-items-center rounded-[4px] bg-slate-800 text-[11px] font-black'>
                    {index + 1}
                  </span>
                  <span className='min-w-0'>
                    <span className='block truncate text-xs font-bold'>
                      {task.message}
                    </span>
                    <span className='mt-0.5 block truncate text-[11px] text-slate-500'>
                      {task.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className='rounded-[6px] border border-slate-700/80 bg-slate-900/70 p-4'>
          <div className='text-xs uppercase tracking-[0.16em] text-slate-400'>
            Quantity Log
          </div>
          <div className='mt-3 flex items-end gap-2'>
            <span className='text-3xl font-black text-emerald-300'>
              {activeProject.commits.length}
            </span>
            <span className='pb-1 text-slate-300'>/ 6 commits</span>
          </div>
          <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800'>
            <div
              className='h-full bg-cyan-300 transition-all duration-500'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}

function EditorHeader({
  activeProject,
  leaped,
  onRun,
}: {
  activeProject: ProjectSession
  leaped: boolean
  onRun: () => void
}) {
  return (
    <div className='flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-[#0b1220] px-4 sm:px-7'>
      <div className='min-w-0 font-mono text-sm text-slate-300'>
        <span className='text-slate-500'>src</span>
        <span className='mx-2 text-slate-500'>›</span>
        <span className='text-slate-500'>projects</span>
        <span className='mx-2 text-slate-500'>›</span>
        <span className='text-slate-500'>{activeProject.slug}</span>
        <span className='mx-2 text-slate-500'>›</span>
        <span className='text-cyan-200'>
          {leaped ? "disciplined_engineer.ts" : "procrastination_mindset.json"}
        </span>
      </div>

      <button
        type='button'
        onClick={onRun}
        className='h-9 rounded-[4px] border border-slate-500 px-4 font-mono text-sm font-bold text-emerald-300 transition hover:border-emerald-300 hover:bg-emerald-300/10'
      >
        ▷ Run
      </button>
    </div>
  )
}

function CodeEditor({
  activeProject,
  leaped,
  hasRunCode,
  commits,
}: {
  activeProject: ProjectSession
  leaped: boolean
  hasRunCode: boolean
  commits: CommitEntry[]
}) {
  const lines = leaped
    ? disciplinedCodeLines(activeProject)
    : commitsToCodeLines(activeProject, commits)

  return (
    <section className='relative min-h-[360px] flex-1 overflow-hidden bg-[#08101f]'>
      <div className='absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:62px_100%] opacity-30' />
      <div className='relative h-full overflow-auto px-0 py-6 font-mono text-sm leading-7 sm:text-base'>
        {lines.map((line, index) => (
          <div key={index} className='grid grid-cols-[56px_minmax(0,1fr)]'>
            <span className='select-none border-r border-slate-700/70 pr-3 text-right text-slate-500'>
              {index + 1}
            </span>
            <code className='min-w-0 px-5 text-slate-200'>{line}</code>
          </div>
        ))}
      </div>

      {!leaped && hasRunCode ? (
        <div className='absolute right-4 bottom-4 max-w-sm rounded-[6px] border border-rose-400/60 bg-rose-950/80 p-3 font-mono text-xs text-rose-100 shadow-[0_0_32px_rgba(244,63,94,0.25)]'>
          RuntimeError mapped to Chất Cũ: {activeProject.task} needs more
          accumulated practice.
        </div>
      ) : null}

      {leaped ? (
        <div className='absolute right-4 bottom-4 max-w-sm rounded-[6px] border border-emerald-300/60 bg-emerald-950/70 p-3 font-mono text-xs text-emerald-100 shadow-[0_0_32px_rgba(52,211,153,0.25)]'>
          System refactored: {activeProject.name} is stable after the leap.
        </div>
      ) : null}
    </section>
  )
}

function CommitSandbox({
  activeProject,
  commits,
  status,
  command,
  description,
  terminalLines,
  conflictActive,
  readyForLeap,
  leaped,
  setCommand,
  setDescription,
  onSubmitCommand,
  onResolve,
  onLeap,
}: {
  activeProject: ProjectSession
  commits: CommitEntry[]
  status: {
    label: string
    detail: string
    tone: "success" | "error" | "warning" | "info" | "muted"
  }
  command: string
  description: string
  terminalLines: TerminalLine[]
  conflictActive: boolean
  readyForLeap: boolean
  leaped: boolean
  setCommand: (value: string) => void
  setDescription: (value: string) => void
  onSubmitCommand: (event: FormEvent<HTMLFormElement>) => void
  onResolve: () => void
  onLeap: () => void
}) {
  const nextCommitNumber = Math.min(commits.length + 1, 6)

  return (
    <section className='border-t border-lime-300/30 bg-[#151b2b]'>
      <div className='flex h-[48px] items-center border-b border-slate-700 bg-[#293044] px-5 font-mono text-sm font-bold uppercase tracking-[0.12em]'>
        <span className='mr-6 text-slate-200'>Terminal</span>
        <span className='border-b-2 border-emerald-300 px-4 py-3 text-emerald-300'>
          Commit Grid
        </span>
      </div>

      <div className='rounded-[6px] border border-slate-700 bg-[#080d18]'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-slate-400'>
          <span>Interactive Terminal</span>
          <span className='text-emerald-300'>{activeProject.slug}</span>
        </div>

        <div className='border-b border-slate-700 bg-slate-950/50 px-4 py-3'>
          <div className='flex flex-wrap items-center gap-3'>
            <span
              className={`rounded-[4px] border px-3 py-1.5 font-mono text-xs font-bold ${statusClasses(
                status.tone,
              )}`}
            >
              {status.label}
            </span>
            <span className='min-w-0 text-sm text-slate-300'>
              {status.detail}
            </span>
          </div>
        </div>

        <div className='h-[220px] overflow-auto p-4 font-mono text-sm'>
          {terminalLines.map((line, index) => (
            <div key={`${line.text}-${index}`} className={terminalTone(line.tone)}>
              {line.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={onSubmitCommand}
          className='flex flex-col border-t border-slate-700'
        >
          <div className='border-b border-slate-700 bg-slate-900/50 px-4 py-3'>
            <div className='mb-3 flex items-center gap-2'>
              <span className='text-xs text-slate-400'>#</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                className='flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500'
                placeholder='Task summary'
              />
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className='w-full resize-none bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600'
              rows={3}
              placeholder='Task notes'
            />
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3'>
            <div className='min-w-0 text-xs text-slate-400'>
              <span className='text-cyan-200'>{activeProject.name}</span>
              <span className='px-2 text-slate-600'>/</span>
              <span className='truncate'>{activeProject.task}</span>
            </div>
            <button
              type='submit'
              className='rounded-[4px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700'
            >
              Commit task {nextCommitNumber} to main
            </button>
          </div>
        </form>

        <div className='grid gap-3 border-t border-slate-700 p-4 sm:grid-cols-2'>
          <button
            type='button'
            onClick={onResolve}
            className={`terminal-action ${
              conflictActive
                ? "border-rose-300 bg-rose-500/15 text-rose-100 shadow-[0_0_28px_rgba(244,63,94,0.25)]"
                : "border-slate-600 text-slate-300"
            }`}
          >
            git resolve --discipline
          </button>
          <button
            type='button'
            onClick={onLeap}
            className={`terminal-action ${
              readyForLeap
                ? "border-emerald-300 bg-emerald-300 text-slate-950 shadow-[0_0_30px_rgba(52,211,153,0.45)]"
                : "border-slate-600 text-slate-400"
            }`}
          >
            {leaped ? "Project Already Deployed" : "Execute Git Push / Deploy Soul"}
          </button>
        </div>
      </div>
    </section>
  )
}

function ReviewPanel({
  activeProject,
  approvals,
  approvalPercent,
  thresholdPercent,
  consensusReached,
  onApprove,
}: {
  activeProject: ProjectSession
  approvals: number
  approvalPercent: number
  thresholdPercent: number
  consensusReached: boolean
  onApprove: () => void
}) {
  const approvalGoalReached = approvals >= approvalGoal

  return (
    <aside className='bg-[#121929] p-5'>
      <h2 className='text-2xl font-black text-slate-100'>Review Panel</h2>
      <div className='mt-1 truncate font-mono text-xs uppercase tracking-[0.14em] text-cyan-200'>
        {activeProject.name}
      </div>

      <div className='mt-8 rounded-[6px] border border-slate-500 bg-slate-800/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <div className='font-mono text-sm uppercase tracking-[0.16em] text-slate-300'>
              Pull Request Status
            </div>
            <div className='mt-5 flex items-end gap-3 font-mono'>
              <span className='text-4xl font-black text-emerald-300'>
                {approvals}
              </span>
              <span className='pb-2 text-lg text-slate-300'>
                / {approvalGoal} Approvals
              </span>
            </div>
          </div>
          <div className='network-mark' aria-hidden='true'>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className='relative mt-5 h-3 overflow-hidden rounded-full bg-slate-950'>
          <div
            className='h-full bg-emerald-300 transition-all duration-500'
            style={{ width: `${approvalPercent}%` }}
          />
          <div
            className='absolute top-0 h-full w-0.5 bg-amber-300'
            style={{ left: `${thresholdPercent}%` }}
          />
        </div>

        <div className='mt-3 flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-slate-400'>
          <span>0%</span>
          <span>80% Threshold</span>
        </div>
      </div>

      <button
        type='button'
        disabled={approvalGoalReached}
        onClick={onApprove}
        className={`mt-6 flex h-14 w-full items-center justify-center rounded-[4px] border font-mono text-sm font-bold tracking-[0.08em] transition ${
          approvalGoalReached
            ? "border-emerald-300 bg-emerald-300/15 text-emerald-100"
            : "border-cyan-200 bg-[#11192d] text-cyan-100 hover:bg-cyan-300/10 hover:shadow-[0_0_26px_rgba(34,211,238,0.25)]"
        }`}
      >
        {approvalGoalReached
          ? "Approval Goal Filled"
          : consensusReached
            ? "Consensus Reached: Add Approval"
            : "↻ Simulate Peer Approve"}
      </button>

      <div
        className={`mt-6 rounded-[6px] border p-4 text-sm leading-6 ${
          consensusReached
            ? "border-emerald-300 bg-emerald-400/10 text-emerald-100"
            : "border-slate-700 bg-slate-950/60 text-slate-300"
        }`}
      >
        When approvals reach 80%, {activeProject.task} is officially merged into
        reality for this project.
      </div>
    </aside>
  )
}

function LeapOverlay() {
  return (
    <div className='leap-overlay' aria-hidden='true'>
      <div className='leap-core'>
        <span>REFactoring...</span>
        <strong>BƯỚC NHẢY</strong>
      </div>
      {Array.from({ length: 36 }, (_, index) => (
        <span
          key={index}
          className='code-particle'
          style={{
            left: `${8 + ((index * 13) % 84)}%`,
            animationDelay: `${(index % 9) * 0.12}s`,
            animationDuration: `${1.5 + (index % 5) * 0.18}s`,
          }}
        >
          {codeParticles[index % codeParticles.length]}
        </span>
      ))}
    </div>
  )
}

function statusClasses(tone: "success" | "error" | "warning" | "info" | "muted") {
  return {
    success: "border-emerald-300/60 bg-emerald-400/10 text-emerald-200",
    error: "border-rose-300/60 bg-rose-500/15 text-rose-100",
    warning: "border-amber-300/60 bg-amber-400/10 text-amber-100",
    info: "border-cyan-300/60 bg-cyan-400/10 text-cyan-100",
    muted: "border-slate-500 bg-slate-800 text-slate-300",
  }[tone]
}

function terminalTone(tone: Tone) {
  return {
    info: "text-cyan-200",
    success: "text-emerald-300",
    warning: "text-amber-200",
    error: "text-rose-300",
    muted: "text-slate-500",
  }[tone]
}

function disciplinedCodeLines(project: ProjectSession) {
  return [
    <span key='1'>
      <span className='text-violet-300'>export const</span>{" "}
      <span className='text-cyan-200'>disciplinedEngineer</span>{" "}
      <span className='text-slate-300'>= {`{`}</span>
    </span>,
    <span key='2'>
      <span className='text-cyan-200'>project</span>:{" "}
      <span className='text-emerald-300'>{quoted(project.name)}</span>,
    </span>,
    <span key='3'>
      <span className='text-cyan-200'>focus_task</span>:{" "}
      <span className='text-emerald-300'>{quoted(project.task)}</span>,
    </span>,
    <span key='4'>
      <span className='text-cyan-200'>knowledge_accumulation</span>:{" "}
      <span className='text-emerald-300'>
        {quoted(`${project.commits.length}-commit streak`)}
      </span>
      ,
    </span>,
    <span key='5'>
      <span className='text-cyan-200'>system_status</span>:{" "}
      <span className='text-emerald-300'>
        {quoted("Production-ready project habit")}
      </span>
      ,
    </span>,
    <span key='6'>
      <span className='text-cyan-200'>quality</span>:{" "}
      <span className='text-emerald-300'>{quoted("New Quality Achieved")}</span>
      ,
    </span>,
    <span key='7'>
      <span className='text-cyan-200'>deploy</span>:{" "}
      <span className='text-violet-300'>as const</span>,
    </span>,
    <span key='8' className='text-slate-300'>
      {`}`}
      <span className='text-slate-500'>;</span>
    </span>,
  ]
}

function commitsToCodeLines(project: ProjectSession, commits: CommitEntry[]) {
  const lines: ReactNode[] = [
    <span key='0' className='text-slate-300'>{`{`}</span>,
    <span key='project'>
      <span className='text-rose-300'>{quoted("project")}</span>:{" "}
      <span className='text-emerald-300'>{quoted(project.name)}</span>,
    </span>,
    <span key='task'>
      <span className='text-rose-300'>{quoted("task")}</span>:{" "}
      <span className='text-emerald-300'>{quoted(project.task)}</span>,
    </span>,
    <span key='commits'>
      <span className='text-rose-300'>{quoted("commits")}</span>:{" "}
      <span className='text-slate-300'>[</span>
    </span>,
  ]

  commits.forEach((commit, idx) => {
    lines.push(
      <span key={`commit-${idx}`}>
        {"  "}
        <span className='text-slate-300'>{`{`}</span>
      </span>,
      <span key={`msg-${idx}`}>
        {"    "}
        <span className='text-rose-300'>{quoted("message")}</span>:{" "}
        <span className='text-emerald-300'>{quoted(commit.message)}</span>,
      </span>,
      <span key={`desc-${idx}`}>
        {"    "}
        <span className='text-rose-300'>{quoted("description")}</span>:{" "}
        <span className='text-emerald-300'>{quoted(commit.description)}</span>,
      </span>,
      <span key={`time-${idx}`}>
        {"    "}
        <span className='text-rose-300'>{quoted("timestamp")}</span>:{" "}
        <span className='text-amber-200'>{commit.timestamp}</span>
      </span>,
      <span key={`close-${idx}`}>
        {"  "}
        <span className='text-slate-300'>
          {idx < commits.length - 1 ? `},` : `}`}
        </span>
      </span>,
    )
  })

  if (commits.length === 0) {
    lines.push(
      <span key='empty'>
        {"  "}
        <span className='text-slate-500'>{"// No commits yet"}</span>
      </span>,
    )
  }

  lines.push(
    <span key='close-array'>
      <span className='text-slate-300'>],</span>
    </span>,
    <span key='progress'>
      <span className='text-rose-300'>{quoted("progress")}</span>:{" "}
      <span className='text-amber-200'>{Math.min(commits.length, 6)}</span>
      <span className='text-slate-300'>/</span>
      <span className='text-amber-200'>6</span>,
    </span>,
    <span key='end' className='text-slate-300'>
      {`}`}
    </span>,
  )

  return lines
}

function quoted(value: string) {
  return JSON.stringify(value)
}
