"use client";

// Delete is destructive (cascades to bookings/check-ins/measurements/history), so
// it requires an explicit confirm before the server action fires.
export function DeleteMemberButton({
  action,
  id,
  name,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  name: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete ${name}?\n\nThis permanently removes their bookings, check-ins, measurements, and history. It cannot be undone.\n\nTo keep the record, cancel and set their status to "cancelled" instead.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-md border border-loss/50 px-4 py-2 text-sm font-semibold text-loss hover:bg-loss/10">
        Delete member
      </button>
    </form>
  );
}
