// Renders directly under the input it belongs to, instead of one generic banner at the bottom of
// the form — so a mistake is obvious at the field that caused it.
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}
