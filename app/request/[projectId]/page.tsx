"use client"

import { use, useEffect, useState } from "react"

const approvalGoal = 20

type RequestApprovalPageProps = {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{
    projectName?: string | string[]
    task?: string | string[]
  }>
}

type RequestStatus = "idle" | "pending" | "success" | "error"

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default function RequestApprovalPage({
  params,
  searchParams,
}: RequestApprovalPageProps) {
  const { projectId } = use(params)
  const query = use(searchParams)
  const [status, setStatus] = useState<RequestStatus>("idle")

  const projectName = firstValue(query.projectName)
  const task = firstValue(query.task)

  useEffect(() => {
    if (status !== "success") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStatus("idle")
    }, 1200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status])

  async function requestApproval() {
    if (status === "pending") {
      return
    }

    setStatus("pending")

    try {
      const response = await fetch("/api/peer-approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvalGoal,
          currentApprovals: 0,
          projectId,
          projectName,
          task,
        }),
      })

      if (!response.ok) {
        throw new Error("Approval request failed.")
      }

      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  const buttonText = {
    idle: "Request Peer Approval",
    pending: "Requesting Peer Approval...",
    success: "Approval Sent",
    error: "Try Again",
  }[status]

  return (
    <main className='grid min-h-screen place-items-center bg-[#080d18] p-5 text-slate-100'>
      <button
        type='button'
        disabled={status === "pending"}
        onClick={requestApproval}
        className={`flex h-14 w-full max-w-103 items-center justify-center rounded-sm border font-mono text-sm font-bold tracking-[0.08em] transition ${
          status === "success"
            ? "border-emerald-300 bg-emerald-300/15 text-emerald-100"
            : status === "pending"
              ? "border-cyan-200 bg-cyan-300/10 text-cyan-100 opacity-80"
              : status === "error"
                ? "border-rose-300 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                : "border-cyan-200 bg-[#11192d] text-cyan-100 hover:bg-cyan-300/10 hover:shadow-[0_0_26px_rgba(34,211,238,0.25)]"
        }`}
      >
        {buttonText}
      </button>
    </main>
  )
}
