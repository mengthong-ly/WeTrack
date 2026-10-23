// The (app) loading boundary sits above this segment, so it doesn't re-show on navigations inside it
// (e.g. /tasks/[id] → /tasks). This one does: same skeleton, scoped to the segment.
export { default } from "../loading"
