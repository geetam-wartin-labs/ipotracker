// FR-13: permanent notice, present on every page showing a GMP value.
export default function GmpNotice() {
  return (
    <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
      Grey market premium (GMP) figures on this page are unofficial. They are not
      sourced from any exchange and are for indication only.
    </p>
  );
}
