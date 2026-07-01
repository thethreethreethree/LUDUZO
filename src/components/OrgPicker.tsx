// Renders an org selector inside a create form. If the user can write to exactly
// one org, it's a hidden field; otherwise a <select>. Server component (no client JS).
export function OrgPicker({ orgs }: { orgs: { id: string; name: string }[] }) {
  if (orgs.length === 1) {
    return <input type="hidden" name="organization_id" value={orgs[0].id} />;
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Gym</span>
      <select
        name="organization_id"
        required
        className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
