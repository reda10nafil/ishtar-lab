// Aggiorna soltanto identita dimostrative note; non modifica il catalogo o gli ID.
const OWNER_NAME = "Reda Zahloul";
const OWNER_EMAIL = "ralreda54@gmail.com";
const staffIds = ["noor", "tomasz", "adaeze", "lucia", "kenji", "freya"];

export function normalizeIshtarIdentity(state) {
  if (!state || typeof state !== "object") return { changed: false };
  let changed = false;
  const substitutions = [];
  function set(object, key, value) {
    if (object[key] !== value) { object[key] = value; changed = true; }
  }
  for (const member of state.staff || []) {
    const index = staffIds.indexOf(member.id);
    if (index < 0) continue;
    const email = String(member.email || "");
    const oldDemo = /@[^@\s]*candle\.[^\s]+$/i.test(email);
    const neutralDemo = /@example\.invalid$/i.test(email);
    if (!oldDemo && !neutralDemo && !(index === 0 && email === OWNER_EMAIL)) continue;
    const name = index === 0 ? OWNER_NAME : "Collaboratore Demo " + index;
    if (oldDemo && member.name && member.name !== name) {
      substitutions.push([member.name, name]);
      const first = member.name.split(" ")[0];
      if (first.length > 2) substitutions.push([first, index === 0 ? "Reda" : "Collaboratore Demo " + index]);
    }
    set(member, "name", name);
    set(member, "email", index === 0 ? OWNER_EMAIL : "collaboratore.demo." + index + "@example.invalid");
  }
  const settings = state.settings;
  if (settings && /@[^@\s]*candle\.[^\s]+$/i.test(String(settings.email || ""))) {
    set(settings, "email", OWNER_EMAIL);
    set(settings, "store", "Ishtar Hub");
    if (settings.phone === "01273 555 0148") set(settings, "phone", "");
    if (String(settings.address || "").startsWith("14 Kensington Gardens")) set(settings, "address", "");
    if (settings.vatNo === "GB 318 4420 61") set(settings, "vatNo", "");
    if (String(settings.announcement || "").startsWith("Free UK postage")) set(settings, "announcement", "Catalogo Ishtar Hub");
  }
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && ["what", "text", "message", "body", "title"].includes(key)) {
        let next = item;
        for (const [from, to] of substitutions) next = next.split(from).join(to);
        set(value, key, next);
      } else if (typeof item === "object") visit(item);
    }
  }
  for (const key of ["log", "notices", "orders", "drafts", "returns", "tickets"]) visit(state[key]);
  return { changed };
}
