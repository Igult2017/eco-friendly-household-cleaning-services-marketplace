import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { onBookingCreated } from "@/lib/inngest/functions/booking"
import { onBookingCompleted } from "@/lib/inngest/functions/completion"
import { weeklyPayoutRun, processProviderPayout } from "@/lib/inngest/functions/payouts"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onBookingCreated,
    onBookingCompleted,
    weeklyPayoutRun,
    processProviderPayout,
  ],
})
