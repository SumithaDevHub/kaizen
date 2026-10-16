/** Keep native HTML drag-and-drop usable in overflowing boards and lanes. */
export function scrollDragEdge(
  element: HTMLElement,
  pointer: { clientX: number; clientY: number },
  axis: "horizontal" | "vertical",
) {
  const rect = element.getBoundingClientRect();
  const edge = 44;
  const step = 24;
  let left = 0, top = 0;
  if (axis === "horizontal" && element.scrollWidth > element.clientWidth) {
    if (pointer.clientX < rect.left + edge) left = -step;
    else if (pointer.clientX > rect.right - edge) left = step;
  }
  if (axis === "vertical" && element.scrollHeight > element.clientHeight) {
    if (pointer.clientY < rect.top + edge) top = -step;
    else if (pointer.clientY > rect.bottom - edge) top = step;
  }
  if (left || top) element.scrollBy({ left, top, behavior: "auto" });
}
