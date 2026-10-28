// Drives the `=== "Label"` tab groups the build emits into ReDoc's description
// sections. Delegated, because ReDoc renders those sections after load.
document.addEventListener("click", (event) => {
  const label = event.target.closest(".code-tabs__label");
  if (!label) return;

  const group = label.closest(".code-tabs");
  for (const element of group.querySelectorAll("[data-tab]")) {
    element.classList.toggle("is-active", element.dataset.tab === label.dataset.tab);
  }
});
