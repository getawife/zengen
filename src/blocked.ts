import { createIcons, ShieldX } from "lucide";
const params = new URLSearchParams(window.location.search);
const site = params.get("site");

createIcons({
  icons: {
    ShieldX,
  },
});

if (site) {
  const hostname = site.toLowerCase().replace(/^www\./, "");

  document.title = `${hostname} blocked by Zengen`;
}
