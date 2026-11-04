import { Account, Frame, OrgName } from "@/app/(app)/frame"
import { OrgSidebar } from "@/components/app-sidebar"

// Project selection mode: pick a project or start one, see every project at once in the 3D workspace, manage
// the team. Tasks only exist inside a project, under (project)/projects/[projectId].
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <Frame sidebar={<OrgSidebar orgName={<OrgName />} account={<Account />} />}>{children}</Frame>
}
