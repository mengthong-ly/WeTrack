// Every task lives in a project, and so does every URL for one: pick a project (/projects), then work inside it.
// Old flat links (/tasks/<id>, /feedback/<id>) redirect here, so emails, Slack posts and notifications keep working.

export const CREATE_PROJECT_HREF = "/create"
export const projectHref = (projectId: string) => `/projects/${projectId}`
export const tasksHref = (projectId: string, query?: string) => `/projects/${projectId}/tasks${query ? `?${query}` : ""}`
export const taskHref = (projectId: string, taskId: string) => `/projects/${projectId}/tasks/${taskId}`
// The New task page in `projectId`, with any other preset fields (priority, status, assigneeId) in the query.
export function newTaskHref(projectId: string, preset: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams(Object.entries(preset).filter((e): e is [string, string] => !!e[1] && e[0] !== "projectId"))
  return `${tasksHref(projectId)}/new${query.size ? `?${query}` : ""}`
}
export const feedbackHref = (projectId: string, feedbackId?: string) =>
  `/projects/${projectId}/feedback${feedbackId ? `/${feedbackId}` : ""}`
export const updatesHref = (projectId: string) => `/projects/${projectId}/updates`

// The project a path is inside, or null in project selection mode.
export function projectIdFromPath(pathname: string | null) {
  return pathname?.match(/^\/projects\/([^/?#]+)/)?.[1] ?? null
}
