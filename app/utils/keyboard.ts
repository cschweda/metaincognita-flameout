/**
 * True when a keyboard event's target is somewhere the user types. Game
 * shortcuts (Space to bet/cashout, arrows to steer) must neither fire from
 * nor preventDefault inside a form field — arrow keys in a number input are
 * the input's own stepper, not steering.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable
}
