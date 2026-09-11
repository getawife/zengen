let blocked = false;

export function blockPage(score: number): void {
  if (blocked) return;

  blocked = true;

  document.documentElement.innerHTML = "";

  const root = document.createElement("div");

  root.id = "zengen-blocker";

  root.innerHTML = `
    <main>
      <p class="kicker">ZENGEN</p>
      <h1>Page blocked</h1>
      <p class="description">Adult content detected.</p>
    </main>
  `;

  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "grid",
    placeItems: "center",
    background: "#eef1f4",
    color: "#17202a",
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
  });

  const main = root.querySelector("main");

  if (main) {
    Object.assign(main as HTMLElement, {
      width: "min(100% - 48px, 620px)",
      padding: "0 0 0 24px",
      borderLeft: "4px solid #c53d43",
      textAlign: "left",
    });
  }

  const kicker = root.querySelector(".kicker");
  const heading = root.querySelector("h1");
  const description = root.querySelector(".description");

  Object.assign(kicker as HTMLElement, {
    margin: "0 0 20px",
    color: "#c53d43",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.16em",
  });

  Object.assign(heading as HTMLElement, {
    margin: "0",
    fontSize: "clamp(48px, 7vw, 76px)",
    lineHeight: "0.95",
    letterSpacing: "-0.065em",
    fontWeight: "850",
  });

  Object.assign(description as HTMLElement, {
    margin: "18px 0 0",
    color: "#687483",
    fontSize: "16px",
    lineHeight: "1.5",
  });

  document.documentElement.appendChild(root);
}
