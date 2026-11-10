/**
 * Helper pembentukan singkatan dan kode aset otomatis
 * Mengikuti hierarki 5 tingkat: Kompleks > Klaster > Taman > Kategori > Nomor Urut
 */

export function abbreviateEntity(rawName: string, length = 3): string {
  if (!rawName) return "AST";

  // Pisahkan camelCase: "GreenPark" -> "Green Park"
  const splitCamel = rawName.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Hapus tanda kurung dan karakter non-alphanumeric
  const cleaned = splitCamel
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();

  // Filter kata kosong dan stopwords umum
  const ignored = new Set(["DAN", "&", "THE", "OF"]);
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.toUpperCase())
    .filter((w) => w.length > 0 && !ignored.has(w));

  if (words.length === 0) {
    const fallback = rawName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return fallback.slice(0, length) || "AST";
  }

  // Jika terdiri dari 2 kata atau lebih
  if (words.length >= 2) {
    // Jika kata terakhir TAMAN dan ada kata sebelumnya (misal: "Lampu Taman" -> "LMP")
    if (words.length === 2 && words[1] === "TAMAN") {
      return abbreviateSingleWord(words[0], length);
    }

    // Penanganan singkatan umum yang sudah ditentukan
    const joined = words.join(" ");
    if (joined === "TAMAN UTAMA") return "TMU";
    if (joined === "PLAYGROUND ANAK") return "PGA";

    // Abaikan awalan umum seperti "CLUSTER" atau "KLASTER" jika masih ada kata lainnya
    const filteredWords = words.filter(
      (w) => w !== "CLUSTER" && w !== "KLASTER"
    );
    if (filteredWords.length >= 2) {
      const initials = filteredWords.map((w) => w[0]).join("");
      return initials.slice(0, 4);
    }
    if (filteredWords.length === 1) {
      return abbreviateSingleWord(filteredWords[0], length);
    }
    const initials = words.map((w) => w[0]).join("");
    return initials.slice(0, 4);
  }

  return abbreviateSingleWord(words[0], length);
}

function abbreviateSingleWord(word: string, length = 3): string {
  if (word.length <= length) return word;

  const first = word[0];
  const restConsonants = word.slice(1).replace(/[AEIOU]/g, "");

  if (restConsonants.length >= length - 1) {
    return first + restConsonants.slice(0, length - 1);
  }

  return word.slice(0, length);
}

export function buildAssetPrefix(
  complexName: string,
  clusterName: string,
  parkName: string,
  categoryName: string
): string {
  const kmp = abbreviateEntity(complexName, 3);
  const cls = abbreviateEntity(clusterName, 3);
  const tmn = abbreviateEntity(parkName, 3);
  const ktg = abbreviateEntity(categoryName, 3);

  return `${kmp}-${cls}-${tmn}-${ktg}`;
}
