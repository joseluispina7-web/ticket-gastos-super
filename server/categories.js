export const CATEGORIES = [
  "Carne",
  "Lácteos",
  "Fruta",
  "Verdura",
  "Charcutería",
  "Higiene",
  "Panadería",
  "Bebidas",
  "Bebé",
  "Limpieza",
  "Cereales y pasta",
  "Platos y conservas",
  "Salsas",
  "Pescado",
  "Dulces y snacks",
  "Frutos secos",
  "Huevos",
  "Congelados",
  "Mascotas",
  "Hogar",
  "Otros",
];

export const CATEGORY_ALIASES = {
  Lacteos: "Lácteos",
  Charcuteria: "Charcutería",
  Panaderia: "Panadería",
  Bebe: "Bebé",
};

// Ordered from the most specific concepts to the broadest ones. A trailing *
// matches ticket abbreviations and singular/plural variants by word prefix.
export const PRODUCT_CATEGORY_RULES = [
  { category: "Salsas", terms: ["salsa", "mayonesa", "ketchup", "mostaza", "alioli", "barbacoa", "pesto", "sofrito", "tomate frito"] },
  { category: "Pescado", terms: ["salmon", "merluza", "pescadilla", "bacalao", "atun", "bonito", "melva", "pota", "gamba", "langostino", "calamar", "sardina", "sepia", "mejillon", "lubina", "dorada", "rape", "pulpo", "surimi", "anchoa", "boqueron", "trucha", "caballa", "chipiron", "marisco", "pescado"] },
  { category: "Charcutería", terms: ["pechuga lonchas", "fiambre", "jamon", "pate", "chopped", "fuet", "salami", "mortadela", "charcuteria", "embutido", "lacon"] },
  { category: "Carne", terms: ["costill*", "pechuga", "albondig*", "solomillo", "cuarto trasero", "pollo", "pavo", "ternera", "cerdo", "lomo", "carne", "burger", "hamburguesa", "salchicha", "chorizo", "bacon", "conejo", "chuleta", "entrecot", "secreto iberico", "presa iberica", "magro"] },
  { category: "Bebidas", terms: ["proteina beber", "agua", "cerveza", "vino", "refresco", "cola", "zumo", "cafe", "bebida", "tonica", "sidra", "licor"] },
  { category: "Platos y conservas", terms: ["crema de calabaza", "crema de verdura", "gazpacho", "salmorejo", "vinagre", "aceite oliva", "aceite girasol", "conserva", "garbanzo", "lenteja", "fabada", "caldo", "sopa"] },
  { category: "Dulces y snacks", terms: ["kinder", "menta con chocolate", "chocolate", "galleta", "snack", "patata frita", "helado", "dulce", "caramelo", "bizcocho", "turron", "gominola", "bombon", "miel"] },
  { category: "Limpieza", terms: ["cucarachicida", "insecticida", "detergente", "lejia", "limpiador", "lavavajillas", "suavizante", "fregasuelos", "bayeta", "estropajo", "bolsa basura", "ambientador"] },
  { category: "Higiene", terms: ["discos desm*", "desmaquillante", "champu", "gel", "dental", "pasta dientes", "desodorante", "compresa", "papel higienico", "afeitado", "colonia", "jabon manos", "laca"] },
  { category: "Bebé", terms: ["panal*", "pañal*", "potito", "bebe", "infantil", "toallitas", "dodot", "leche crecimiento", "papilla"] },
  { category: "Lácteos", terms: ["leche", "yogur*", "queso", "feta", "burrata", "mantequilla", "nata", "kefir", "cuajada", "flan", "requeson", "batido", "colacao shake"] },
  { category: "Fruta", terms: ["platano", "banana", "manzana", "pera", "naranja", "melon", "sandia", "kiwi", "uva", "fresa", "limon", "mandarina", "aguacate", "melocoton", "paraguayo", "mango", "pina"] },
  { category: "Verdura", terms: ["tomate", "lechuga", "cebolla", "patata", "zanahoria", "calabacin", "pimiento", "brocoli", "verdura", "pepino", "berenjena", "ensalada", "calabaza", "champinon", "puerro", "judia verde", "alcachofa", "esparrago"] },
  { category: "Panadería", terms: ["tortilla trigo", "pan", "barra", "baguette", "pan molde", "croissant", "napolitana", "bolleria", "brioche", "picos", "colines"] },
  { category: "Cereales y pasta", terms: ["pasta", "macarron*", "spaghetti", "espagueti", "arroz", "cereal", "avena", "muesli", "quinoa", "chia", "harina", "cuscus", "fideo"] },
  { category: "Frutos secos", terms: ["almendra", "nuez", "nueces", "pistacho", "cacahuete", "anacardo", "avellana"] },
  { category: "Huevos", terms: ["huevo", "huevos"] },
  { category: "Congelados", terms: ["congelad*", "pizza", "croqueta", "hielo", "ultracongelad*"] },
  { category: "Mascotas", terms: ["perro", "gato", "mascota", "pienso", "arena gatos"] },
  { category: "Hogar", terms: ["papel cocina", "servilleta", "aluminio", "film", "pila", "bombilla", "menaje", "bolsa congelacion"] },
];

const CATALOG_CATEGORY_RULES = [
  { category: "Congelados", terms: ["congelado*", "ultracongelado*"] },
  { category: "Charcutería", terms: ["charcuteria", "embutido*", "fiambre*", "jamon*", "pavo y pollo", "pollo pavo y jamon cocido"] },
  { category: "Pescado", terms: ["pescad*", "marisco*", "ahumado*", "surimi"] },
  { category: "Carne", terms: ["carne*", "carniceria", "aves", "pollo", "vacuno", "cerdo", "cordero", "conejo"] },
  { category: "Lácteos", terms: ["lacteo*", "leche", "yogur*", "queso*"] },
  { category: "Fruta", terms: ["fruta*"] },
  { category: "Verdura", terms: ["verdura*", "hortaliza*", "patata*"] },
  { category: "Higiene", terms: ["higiene", "cuidado personal", "perfumeria", "belleza", "cosmetica"] },
  { category: "Panadería", terms: ["panaderia", "panes", "bolleria"] },
  { category: "Bebidas", terms: ["bebida*", "refresco*", "cerveza*", "vino*"] },
  { category: "Bebé", terms: ["bebe", "infantil", "pañal*", "panal*"] },
  { category: "Limpieza", terms: ["limpieza", "drogueria"] },
  { category: "Cereales y pasta", terms: ["cereal*", "pasta*", "arroz", "harina*"] },
  { category: "Platos y conservas", terms: ["conserva*", "platos preparado*", "alimentacion preparada", "comida preparada*", "listo para comer", "caldo*", "crema*", "sopa*", "pizza*", "aceite*", "vinagre*"] },
  { category: "Salsas", terms: ["salsa*", "mayonesa", "ketchup", "mostaza"] },
  { category: "Dulces y snacks", terms: ["dulce*", "chocolate*", "galleta*", "snack*", "caramelo*", "helado*"] },
  { category: "Frutos secos", terms: ["fruto* seco*"] },
  { category: "Huevos", terms: ["huevo*"] },
  { category: "Mascotas", terms: ["mascota*", "perro*", "gato*"] },
  { category: "Hogar", terms: ["hogar", "menaje", "papel y bolsas"] },
];

export function normalizeCategoryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTerm(normalized, term) {
  const cleanTerm = normalizeCategoryText(term.replace(/\*+$/, ""));
  if (!cleanTerm) return false;
  if (term.endsWith("*")) {
    if (cleanTerm.includes(" ")) {
      const words = cleanTerm.split(" ");
      const prefix = words.pop();
      const phrase = words.join(" ");
      const start = phrase ? ` ${phrase} ` : " ";
      const index = ` ${normalized} `.indexOf(start);
      if (index < 0) return false;
      return normalized.slice(index + start.length - 1).split(" ").some((word) => word.startsWith(prefix));
    }
    return normalized.split(" ").some((word) => word.startsWith(cleanTerm));
  }
  return (` ${normalized} `).includes(` ${cleanTerm} `);
}

function classifyWithRules(value, rules, source) {
  const normalized = normalizeCategoryText(value);
  if (!normalized) return { category: "Otros", confidence: 0, source, matched: "" };
  for (const rule of rules) {
    const matched = rule.terms.find((term) => matchesTerm(normalized, term));
    if (matched) return { category: rule.category, confidence: source === "catálogo" ? 0.9 : 0.97, source, matched };
  }
  return { category: "Otros", confidence: 0, source, matched: "" };
}

export function classifyProductName(name) {
  return classifyWithRules(name, PRODUCT_CATEGORY_RULES, "diccionario");
}

export function classifyCatalogProduct(sourceCategory, productName) {
  const catalog = classifyWithRules(sourceCategory, CATALOG_CATEGORY_RULES, "catálogo");
  return catalog.category !== "Otros" ? catalog : classifyProductName(productName);
}

export function canonicalCategory(category) {
  const value = String(category || "").trim();
  return CATEGORY_ALIASES[value] || (CATEGORIES.includes(value) ? value : "Otros");
}

export function storeKeyFromName(value) {
  const normalized = normalizeCategoryText(value);
  if (normalized.includes("mercadona")) return "mercadona";
  if (normalized === "dia" || normalized.includes("dia plaza")) return "dia";
  if (normalized.includes("carrefour")) return "carrefour";
  if (normalized.includes("alcampo")) return "alcampo";
  if (normalized.includes("ahorramas")) return "ahorramas";
  if (normalized.includes("aldi")) return "aldi";
  if (normalized.includes("hipercor") || normalized.includes("el corte ingles")) return "hipercor";
  return "";
}
