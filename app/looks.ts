export const LOOKS = [
  { id: "paper", label: "Paper", hint: "Warm serif, like a letter" },
  { id: "index", label: "Index", hint: "Swiss sans, like a directory" },
  { id: "night", label: "Night", hint: "Dark mono, like a terminal" },
] as const;

export type LookId = (typeof LOOKS)[number]["id"];

export const DEFAULT_LOOK: LookId = "paper";
export const LOOK_STORAGE_KEY = "jose-look";

export function isLookId(value: string | null | undefined): value is LookId {
  return LOOKS.some((look) => look.id === value);
}

export const LOOK_BOOTSTRAP_SCRIPT = `(function(){try{var a={paper:1,index:1,night:1};var v=localStorage.getItem("${LOOK_STORAGE_KEY}");if(!a[v])v="${DEFAULT_LOOK}";var r=document.documentElement;r.setAttribute("data-look",v);r.style.colorScheme=v==="night"?"dark":"light"}catch(e){document.documentElement.setAttribute("data-look","${DEFAULT_LOOK}")}})();`;

export function applyLook(look: LookId) {
  const root = document.documentElement;
  root.setAttribute("data-look", look);
  root.style.colorScheme = look === "night" ? "dark" : "light";
  const canvas = getComputedStyle(root).getPropertyValue("--canvas").trim();
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme && canvas) theme.setAttribute("content", canvas);
}
