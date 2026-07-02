"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Address } from "@/types"

interface BookingDraft {
  categoryId: string | null
  categoryName: string | null
  address: Address | null
  latitude: number | null
  longitude: number | null
  selectedProviderId: string | null
  providerCountry: string | null  // selected cleaner's country → currency + locale (EU vs US)
  providerName: string | null     // display name for the "Booking with X" banner
  providerPreselected: boolean    // true when the cleaner was chosen BEFORE the wizard (browse/profile Book) — skips the search step
  scheduledAt: string | null   // ISO 8601 string — survives sessionStorage round-trip
  // Raw wall-clock parts as picked (cleaner's tz) — restoring from the UTC instant via the BROWSER's
  // tz shifted times for cross-tz clients on back-navigation.
  scheduledDateStr: string | null
  scheduledTimeStr: string | null
  durationMinutes: number
  specialInstructions: string
  ecoOptions: string[]
  addOnIds: string[]           // selected provider add-on ids
  carbonOffsetCents: number    // 0 | 200 — persisted so 3DS redirect restores it
  bidAmountCents: number | null // non-null when booking originates from an accepted bid
  // "recurring" = cadence unspecified (bid-flow jobs only state one-time vs recurrent)
  frequency: "one_time" | "recurring" | "weekly" | "biweekly" | "monthly"
  recurringDays: number[]         // 0=Sun..6=Sat — which weekdays the client wants repeat service on
  step: 1 | 2 | 3 | 4 | 5
}

interface BidFlowData {
  providerId: string
  categorySlug: string | null
  categoryName: string | null
  serviceAddress: Address
  serviceLatitude: number
  serviceLongitude: number
  scheduledAt: string | null
  durationMinutes: number
  bidAmountCents: number
  providerCountry?: string | null
  requestedFrequency?: string | null
}

interface BookingStore extends BookingDraft {
  setCategory: (id: string, name: string) => void
  setAddress: (address: Address, lat: number, lng: number) => void
  setProvider: (providerId: string, country?: string | null) => void
  setPreselectedProvider: (providerId: string, name: string, country?: string | null) => void
  clearPreselection: () => void
  setSchedule: (date: Date, durationMinutes: number, dateStr?: string, timeStr?: string) => void
  setExtras: (instructions: string, ecoOptions: string[], addOnIds: string[]) => void
  setCarbonOffset: (cents: number) => void
  setFrequency: (frequency: BookingDraft["frequency"]) => void
  setRecurringDays: (days: number[]) => void
  setStep: (step: BookingDraft["step"]) => void
  setBidFlow: (data: BidFlowData) => void  // pre-populate all wizard fields from accepted bid
  reset: () => void
}

const initialState: BookingDraft = {
  categoryId: null,
  categoryName: null,
  address: null,
  latitude: null,
  longitude: null,
  selectedProviderId: null,
  providerCountry: null,
  providerName: null,
  providerPreselected: false,
  scheduledAt: null,
  scheduledDateStr: null,
  scheduledTimeStr: null,
  durationMinutes: 120,
  specialInstructions: "",
  ecoOptions: [],
  addOnIds: [],
  carbonOffsetCents: 0,
  bidAmountCents: null,
  frequency: "one_time",
  recurringDays: [],
  step: 1,
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      ...initialState,
      // Wizard setters clear any leftover bid draft — a persisted bidAmountCents from an old accepted
      // bid otherwise poisons the price of every later wizard/preselected booking.
      setCategory: (id, name) => set({ categoryId: id, categoryName: name, bidAmountCents: null, step: 2 }),
      setAddress: (address, latitude, longitude) => set({ address, latitude, longitude }),
      setProvider: (selectedProviderId, providerCountry = null) =>
        set({ selectedProviderId, providerCountry, providerPreselected: false, providerName: null, bidAmountCents: null, step: 3 }),
      setPreselectedProvider: (selectedProviderId, providerName, providerCountry = null) =>
        set({ selectedProviderId, providerName, providerCountry, providerPreselected: true, bidAmountCents: null }),
      clearPreselection: () =>
        set({ selectedProviderId: null, providerName: null, providerCountry: null, providerPreselected: false }),
      setSchedule: (date, durationMinutes, dateStr, timeStr) =>
        set({ scheduledAt: date.toISOString(), durationMinutes, scheduledDateStr: dateStr ?? null, scheduledTimeStr: timeStr ?? null, step: 4 }),
      setExtras: (specialInstructions, ecoOptions, addOnIds) =>
        set({ specialInstructions, ecoOptions, addOnIds, step: 5 }),
      setCarbonOffset: (carbonOffsetCents) => set({ carbonOffsetCents }),
      setFrequency: (frequency) => set({ frequency }),
      setRecurringDays: (recurringDays) => set({ recurringDays }),
      setStep: (step) => set({ step }),
      setBidFlow: (data) =>
        set({
          selectedProviderId: data.providerId,
          providerCountry: data.providerCountry ?? null,
          categoryId: data.categorySlug,
          categoryName: data.categoryName,
          address: data.serviceAddress,
          latitude: data.serviceLatitude,
          longitude: data.serviceLongitude,
          scheduledAt: data.scheduledAt,
          durationMinutes: data.durationMinutes,
          bidAmountCents: data.bidAmountCents,
          frequency: (["recurring", "weekly", "biweekly", "monthly"] as const).includes(
            data.requestedFrequency as "recurring" | "weekly" | "biweekly" | "monthly",
          )
            ? (data.requestedFrequency as BookingDraft["frequency"])
            : "one_time",
          step: 5,
        }),
      reset: () => set(initialState),
    }),
    {
      name: "booking-draft",
      // Bug 2: sessionStorage is cleared on cross-origin 3DS redirects; localStorage survives them
      storage: createJSONStorage(() => localStorage),
    }
  )
)
