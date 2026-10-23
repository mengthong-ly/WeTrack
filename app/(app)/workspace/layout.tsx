// The workspace and its @panel slot: a task opened from the 3D scene shows in a side sheet
// (@panel/(..)tasks/[id]); /tasks/<id> opened directly is still the full page.
export default function WorkspaceLayout({ children, panel }: { children: React.ReactNode; panel: React.ReactNode }) {
  return (
    <>
      {children}
      {panel}
    </>
  )
}
