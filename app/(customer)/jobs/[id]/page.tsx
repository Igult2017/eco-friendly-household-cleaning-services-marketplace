import { redirect } from "next/navigation"

// Notification links (e.g. "new bid on your job") point to /jobs/{id}, but the job detail — bids,
// actions, chat — lives inline on My Jobs. Land there instead of a 404. Also covers every such
// link already stored in the notifications table.
export default async function JobDetailRedirect() {
  redirect("/jobs")
}
