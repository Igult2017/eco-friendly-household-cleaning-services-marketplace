import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"

// Import all Inngest functions here as they are created
// import { onBookingCreated } from "@/lib/inngest/functions/bookingCreated"
// import { onBookingCompleted } from "@/lib/inngest/functions/bookingCompleted"
// import { weeklyPayoutRun } from "@/lib/inngest/functions/payouts"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Functions will be registered here in Phase 2–3
  ],
})
