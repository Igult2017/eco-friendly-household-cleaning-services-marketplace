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
  scheduledAt: string | null   // ISO 8601 string — survives sessionStorage round-trip
  durationMinutes: number
  specialInstructions: string
  ecoOptions: string[]
  carbonOffsetCents: number    // 0 | 200 — persisted so 3DS redirect restores it
  bidAmountCents: number | null // non-null when booking originates from an accepted bid
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
}

interface BookingStore extends BookingDraft {
  setCategory: (id: string, name: string) => void
  setAddress: (address: Address, lat: number, lng: number) => void
  setProvider: (providerId: string) => void
  setSchedule: (date: Date, durationMinutes: number) => void
  setExtras: (instructions: string, ecoOptions: string[]) => void
  setCarbonOffset: (cents: number) => void
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
  scheduledAt: null,
  durationMinutes: 120,
  specialInstructions: "",
  ecoOptions: [],
  carbonOffsetCents: 0,
  bidAmountCents: null,
  step: 1,
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      ...initialState,
      setCategory: (id, name) => set({ categoryId: id, categoryName: name, step: 2 }),
      setAddress: (address, latitude, longitude) => set({ address, latitude, longitude }),
      setProvider: (selectedProviderId) => set({ selectedProviderId, step: 3 }),
      setSchedule: (date, durationMinutes) =>
        set({ scheduledAt: date.toISOString(), durationMinutes, step: 4 }),
      setExtras: (specialInstructions, ecoOptions) =>
        set({ specialInstructions, ecoOptions, step: 5 }),
      setCarbonOffset: (carbonOffsetCents) => set({ carbonOffsetCents }),
      setStep: (step) => set({ step }),
      setBidFlow: (data) =>
        set({
          selectedProviderId: data.providerId,
          categoryId: data.categorySlug,
          categoryName: data.categoryName,
          address: data.serviceAddress,
          latitude: data.serviceLatitude,
          longitude: data.serviceLongitude,
          scheduledAt: data.scheduledAt,
          durationMinutes: data.durationMinutes,
          bidAmountCents: data.bidAmountCents,
          step: 5,
        }),
      reset: () => set(initialState),
    }),
    {
      name: "booking-draft",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
