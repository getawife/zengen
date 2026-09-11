let blocked = false;

export function blockPage(score: number): void {
  if (blocked) return;

  blocked = true;

  document.documentElement.innerHTML = "";

  const root = document.createElement("div");

  root.id = "zengen-blocker";

  root.innerHTML = `
    <main>
      <div class="zengen-mark">Z</div>
      <h1>Content blocked</h1>
      <p>Zengen detected adult content on this page.</p>
      <span>Detection confidence: ${score}%</span>
    </main>
  `;

  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "grid",
    placeItems: "center",
    background: "#090a0c",
    color: "#f5f5f5",
    fontFamily: "system-ui, sans-serif",
  });

  const main = root.querySelector("main");

  if (main) {
    Object.assign(main as HTMLElement, {
      textAlign: "center",
      maxWidth: "420px",
      padding: "40px",
    });
  }

  document.documentElement.appendChild(root);
}
