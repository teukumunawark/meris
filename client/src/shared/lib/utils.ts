export const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

export const getInitials = (name: string) => {
  return name.trim().slice(0, 2).toUpperCase();
};

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
