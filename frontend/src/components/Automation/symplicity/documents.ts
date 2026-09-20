import { withTitleSuffix } from "../work/automationHelpers"
import { closeModalIfPresent } from "./submission"
import { addLog } from "../work/automationStore"
import { AutomationWebview } from "../work/automationWebview"
import { createDocumentTask } from "./tasks"

export async function handleNoCoverLetter(
  companyName: string,
  userId: string | undefined,
  applicationId?: string | null,
  jobTitle?: string,
  webview?: AutomationWebview
) {
  addLog(`No cover letter found for ${companyName}.`)
  if (!userId) {
    addLog(`Error occured.`)
    return
  }
  await createDocumentTask(
    `Upload ${companyName} cover letter`,
    withTitleSuffix(
      jobTitle,
      `Upload your ${companyName} cover letter in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    ),
    userId,
    applicationId
  )
  if (webview) {
    await closeModalIfPresent(webview)
  }
}

export async function handleNoWorkSample(
  companyName: string,
  userId: string | undefined,
  applicationId?: string | null,
  jobTitle?: string
) {
  addLog(`No work sample found for ${companyName}.`)
  if (!userId) {
    addLog(`Error occured.`)
    return
  }
  await createDocumentTask(
    `Upload ${companyName} work sample`,
    withTitleSuffix(
      jobTitle,
      `Upload a work sample for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    ),
    userId,
    applicationId
  )
}

export async function handleNoPortfolio(
  companyName: string,
  userId: string | undefined,
  applicationId?: string | null,
  jobTitle?: string
) {
  addLog(`No portfolio found for ${companyName}.`)
  if (!userId) {
    addLog(`Error occured.`)
    return
  }
  await createDocumentTask(
    `Upload ${companyName} portfolio`,
    withTitleSuffix(
      jobTitle,
      `Upload a portfolio for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    ),
    userId,
    applicationId
  )
}

export async function handleNoTranscript(
  companyName: string,
  userId: string | undefined,
  applicationId?: string | null,
  jobTitle?: string
) {
  addLog(`No transcript found for ${companyName}.`)
  if (!userId) {
    addLog(`Error occured.`)
    return
  }
  await createDocumentTask(
    `Upload ${companyName} transcript`,
    withTitleSuffix(
      jobTitle,
      `Upload a transcript for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    ),
    userId,
    applicationId
  )
}