let blocked = false;

export function blockPage(score: number): void {
  if (blocked) return;

  blocked = true;

  const blockedUrl = chrome.runtime.getURL("blocked.html");

  document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Blocked by Zengen</title>
      <link rel="stylesheet" href="${chrome.runtime.getURL("assets/blocked.css")}">
    </head>
    <body>
      <iframe
        src="${blockedUrl}"
        style="
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          z-index: 2147483647;
        "
      ></iframe>
    </body>
  `;
}
