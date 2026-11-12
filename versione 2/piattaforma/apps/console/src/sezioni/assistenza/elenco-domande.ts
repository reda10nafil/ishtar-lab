export type Profilo = "admin" | "azienda"
export type Domanda = { categoria: string; domanda: string; risposta: string; profili: Profilo[] }

const SOLO_ADMIN: Profilo[] = ["admin"]
const SOLO_AZIENDA: Profilo[] = ["azienda"]
const TUTTI: Profilo[] = ["admin", "azienda"]

/** Descrivono come funziona davvero Ishtar Lab: se una funzione cambia, va cambiata anche la risposta. */
export const DOMANDE: Domanda[] = [
  {
    categoria: "Start",
    domanda: "What is Ishtar Lab?",
    risposta: "It is the panel for running the store. The Ishtar Lab team looks after companies, products and settings. Each partner company works on its own products and sees only its own data.",
    profili: TUTTI,
  },
  {
    categoria: "Start",
    domanda: "What is the bell at the top for?",
    risposta: "It shows what is waiting for you, worked out from the current data. The number counts the notifications you have not read yet. Tap one to open the right page and mark it as read; this only applies to your account.",
    profili: TUTTI,
  },
  {
    categoria: "Start",
    domanda: "How do I sign in?",
    risposta: "Use the company sign-in page, with the email and password you chose when you accepted your invitation. If you cannot get in, contact the Ishtar Lab team.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Products",
    domanda: "Why is a product not on sale yet?",
    risposta: "Nothing goes live without approval. Products proposed by companies stay in review until they are approved on the Review page.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Products",
    domanda: "How do I approve a product?",
    risposta: "Open Review. For each product you can approve it, reject it or ask for changes with a note for the company. The same page lists the changes proposed on products that are already approved.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Products",
    domanda: "How do I add a new product?",
    risposta: "In My products choose New product, then enter the title, description, item code, sizes and photos. The product goes into review and customers see it only after the Ishtar Lab team approves it.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Products",
    domanda: "Why is my product stuck in review?",
    risposta: "It is waiting for the Ishtar Lab team to check it. If changes are needed you will get a notification with the note to read. If the product is rejected, the notification appears in the bell.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Products",
    domanda: "Can other companies see my products?",
    risposta: "No. A product belongs to the company that creates it: other companies cannot see or change it.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Companies",
    domanda: "How do I add a partner company?",
    risposta: "In Companies choose New company. The company receives an email invitation to activate its access. Companies join by invitation only: there is no open registration.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Companies",
    domanda: "Can I suspend a company?",
    risposta: "Yes. In Companies you can suspend an active company and reinstate it later.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Companies",
    domanda: "Why can I not see selling prices and customers?",
    risposta: "Ishtar Lab sells as the retailer: it takes payment and invoices the customer, while companies are suppliers. Selling prices and customer details therefore stay with the Ishtar Lab team. Companies can read their own orders.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Shipping",
    domanda: "Who ships the goods?",
    risposta: "Each company keeps its own stock and ships its own orders. Ishtar Lab has no warehouse of its own.",
    profili: TUTTI,
  },
  {
    categoria: "Shipping",
    domanda: "Where do I set shipping rates and thresholds?",
    risposta: "In Settings, under Shipping. Open an option to change its name and rate, set the basket value above which shipping is free, or switch it off. The same page holds the fulfilment deadline for companies.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Team",
    domanda: "How do I invite a team member?",
    risposta: "In Team choose Invite and pick a role: Catalogue manager, Orders operator, Marketing, Accounting or Read only. They receive an email to activate their access. You can change the role later.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Team",
    domanda: "Which roles are there in my company?",
    risposta: "Owner, Staff, Warehouse and Accounting. The Owner invites people from the Team page and chooses each person's role.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Team",
    domanda: "Are role limits real?",
    risposta: "Yes. They are checked on the server: if a role lacks a permission, the action is refused even if someone tries it without going through the panel.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Team",
    domanda: "Where can I see who changed something?",
    risposta: "In the Activity log: it lists the latest changes with the person, the action and the result, including refused attempts. It does not contain the data entered.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Apps",
    domanda: "How do I connect an outside service?",
    risposta: "Open Apps, choose the service, then enter its API key or sign in with your account. The same window lets you test the connection or disconnect it.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Apps",
    domanda: "Are service keys safe?",
    risposta: "Keys are stored encrypted and never come back to the panel: the field stays empty once saved. If you leave it empty when editing later, the saved key is kept.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Apps",
    domanda: "Why will Instagram not connect?",
    risposta: "Some services only accept a public HTTPS address. The app currently stays on your computer, so signing in to those services becomes available once it goes online.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Data",
    domanda: "Which currency can I use?",
    risposta: "In Settings, under Store, you can choose EUR, GBP or USD. This changes the symbol shown next to amounts. Prices are not converted: 100 stays 100.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Data",
    domanda: "How do I download a copy of the data?",
    risposta: "In Settings, under Data, you can download products, companies and customers as CSV or JSON. Every export is kept in the activity log.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Data",
    domanda: "Can I load an exported file back in?",
    risposta: "No. Restoring is not available: exported files are copies to keep or open in a spreadsheet.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Data",
    domanda: "How do I choose which alerts I get?",
    risposta: "In Settings, under Alerts, switch each type of alert on or off. The choice applies to your account. Alerts appear in the bell: they are not sent by email yet.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Help",
    domanda: "Who answers requests?",
    risposta: "Requests go to the Ishtar Lab team, who reply right here. There are no outside agents.",
    profili: SOLO_AZIENDA,
  },
  {
    categoria: "Help",
    domanda: "Who can see help requests?",
    risposta: "The Ishtar Lab team and panel team members can see them and reply. Each company sees only its own. There are no outside agents.",
    profili: SOLO_ADMIN,
  },
  {
    categoria: "Help",
    domanda: "How do I open a request?",
    risposta: "Use the form on the Help page: enter a subject, pick a topic and describe the problem. When a reply arrives you will find it in the same request and in the bell.",
    profili: TUTTI,
  },
]
