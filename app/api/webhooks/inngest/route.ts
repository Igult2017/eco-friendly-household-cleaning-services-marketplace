import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { onBookingCreated } from "@/lib/inngest/functions/booking"
import { onBookingCompleted } from "@/lib/inngest/functions/completion"
import { bookingReminders } from "@/lib/inngest/functions/reminders"
import { weeklyPayoutRun, processProviderPayout } from "@/lib/inngest/functions/payouts"
import { onJobPosted, onJobExpired } from "@/lib/inngest/functions/jobs"
import { onDisputeOpened } from "@/lib/inngest/functions/disputes"
import { onRecurringScheduleCreated, recurringBookingCron } from "@/lib/inngest/functions/recurring"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onBookingCreated,
    onBookingCompleted,
    bookingReminders,
    weeklyPayoutRun,
    processProviderPayout,
    onJobPosted,
    onJobExpired,
    onDisputeOpened,
    onRecurringScheduleCreated,
    recurringBookingCron,
  ],
})
