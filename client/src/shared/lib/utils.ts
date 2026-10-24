export const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

export const getInitials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w).filter((ch) => /\p{L}/u.test(ch)).join(""))
    .filter(Boolean);
  if (words.length === 0) return Array.from(name.trim())[0] ?? "?";
  const letters = words.length > 1 ? Array.from(words[0])[0] + Array.from(words[1])[0] : Array.from(words[0]).slice(0, 2).join("");
  return letters.toUpperCase();
};

export const roundShares = (val: number) => Math.round(val * 1000) / 1000;

export const formatShares = (val: number, intlLocale = "id-ID") =>
  new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(Math.round(val * 100) / 100);

export const getAvatarBg = (name: string) => {
  const colors = [
    "bg-slate-700 text-slate-100",
    "bg-sage text-background",
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
    "bg-slate-800 text-slate-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
