import { useState, useEffect, useCallback, useRef } from "react";
import "./Restaurants.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | "Asiática"
  | "Pollo"
  | "Completos"
  | "Sushi"
  | "Sandwiches"
  | "Coreana"
  | "China"
  | "Pizzas"
  | "Hamburguesas"
  | "Peruana"
  | "Mexicana"
  | "Árabe"
  | "Saludable"
  | "Carnes"
  | "Vegetariana"
  | "Vegana";

type RestaurantType =
  | "Restaurante"
  | "Cafetería"
  | "Comida Rápida"
  | "Bar"
  | "Pastelería";
type SortKey = "name" | "rate" | "category" | "location";

export interface Restaurant {
  id: number;
  name: string;
  type: RestaurantType;
  schedule: string;
  location: string;
  category: Category;
  rate: number | null;
  visited: boolean;
  image_url: string | null;
}

interface NominatimResult {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

const API = "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Nominatim (OpenStreetMap)
// Referencia: https://nominatim.org/release-docs/develop/api/Search/
async function searchLocations(
  query: string,
): Promise<{ label: string; sub: string }[]> {
  if (query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&featuretype=city`;
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  const data: NominatimResult[] = await res.json();
  return data
    .map((r) => {
      const city =
        r.address.city ||
        r.address.town ||
        r.address.village ||
        r.address.county ||
        "";
      const country = r.address.country || "";
      const state = r.address.state || "";
      return {
        label: [city, country].filter(Boolean).join(", "),
        sub: state !== city ? state : "",
      };
    })
    .filter((r) => r.label);
}

// ─── Image helpers ────────────────────────────────────────────────────────────

// Tipos permitidos: JPEG y PNG (validación por MIME + magic bytes en el cliente)
const ALLOWED_MIME = ["image/jpeg", "image/png"];

// Verifica magic bytes: JPEG = FF D8 FF, PNG = 89 50 4E 47
function checkMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, 4);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  return isJpeg || isPng;
}

// Convierte File a base64 data URL tras validar tipo y magic bytes
// Referencia: https://developer.mozilla.org/en-US/docs/Web/API/FileReader
async function fileToBase64(
  file: File,
): Promise<{ data: string | null; error: string | null }> {
  // 1) Validar extensión y MIME
  if (!ALLOWED_MIME.includes(file.type)) {
    return { data: null, error: "Solo se aceptan imágenes JPG o PNG." };
  }
  // 2) Validar tamaño (máx 2 MB)
  if (file.size > 2 * 1024 * 1024) {
    return { data: null, error: "La imagen no puede superar 2 MB." };
  }
  // 3) Leer magic bytes para confirmar que el contenido coincide con la extensión
  const headerBuffer = await file.slice(0, 4).arrayBuffer();
  if (!checkMagicBytes(headerBuffer)) {
    return { data: null, error: "El archivo no es un JPG o PNG válido." };
  }
  // 4) Convertir a base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ data: reader.result as string, error: null });
    reader.onerror = () =>
      resolve({ data: null, error: "Error al leer el archivo." });
    reader.readAsDataURL(file);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES: { label: string; category: Category | "all" }[] = [
  { label: "Todas", category: "all" },
  { label: "Asiática", category: "Asiática" },
  { label: "Pollo", category: "Pollo" },
  { label: "Completos", category: "Completos" },
  { label: "Sushi", category: "Sushi" },
  { label: "Sandwiches", category: "Sandwiches" },
  { label: "Coreana", category: "Coreana" },
  { label: "China", category: "China" },
  { label: "Pizzas", category: "Pizzas" },
  { label: "Hamburguesas", category: "Hamburguesas" },
  { label: "Peruana", category: "Peruana" },
  { label: "Mexicana", category: "Mexicana" },
  { label: "Árabe", category: "Árabe" },
  { label: "Saludable", category: "Saludable" },
  { label: "Carnes", category: "Carnes" },
  { label: "Vegetariana", category: "Vegetariana" },
  { label: "Vegana", category: "Vegana" },
];

const TYPES: RestaurantType[] = [
  "Restaurante",
  "Cafetería",
  "Comida Rápida",
  "Bar",
  "Pastelería",
];

const CATEGORIES: Category[] = [
  "Asiática",
  "Pollo",
  "Completos",
  "Sushi",
  "Sandwiches",
  "Coreana",
  "China",
  "Pizzas",
  "Hamburguesas",
  "Peruana",
  "Mexicana",
  "Árabe",
  "Saludable",
  "Carnes",
  "Vegetariana",
  "Vegana",
];

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: "Nombre", key: "name" },
  { label: "Calificación", key: "rate" },
  { label: "Categoría", key: "category" },
  { label: "Ubicación", key: "location" },
];

const STAR_OPTIONS = [
  { label: "Cualquiera", value: 0 },
  { label: "★ 1+", value: 1 },
  { label: "★★ 2+", value: 2 },
  { label: "★★★ 3+", value: 3 },
  { label: "★★★★ 4+", value: 4 },
  { label: "★★★★★ 5", value: 5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function StarDisplay({ rate }: { rate: number | null }) {
  if (rate === null)
    return <span className="stars stars--empty">Sin calificar</span>;
  const full = Math.floor(rate);
  const half = rate % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="stars">
      {"★".repeat(full)}
      {half ? "½" : ""}
      {"☆".repeat(empty)}
      <span className="stars__num"> {rate.toFixed(1)}</span>
    </span>
  );
}

// ─── Location autocomplete ────────────────────────────────────────────────────

function LocationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<
    { label: string; sub: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (val: string) => {
    onChange(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchLocations(val);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 350);
  };

  const pick = (label: string) => {
    onChange(label);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="location-wrap">
      <input
        className="modal__input"
        type="text"
        placeholder="ej: Santiago, Chile"
        value={value}
        autoComplete="off"
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="location-suggestions">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="location-suggestion"
              onMouseDown={() => pick(s.label)}
            >
              <span className="location-suggestion__main">{s.label}</span>
              {s.sub && (
                <span className="location-suggestion__sub">{s.sub}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

interface Filters {
  city: string;
  type: RestaurantType | "";
  minStars: number;
  visited: "all" | "yes" | "no";
}

const EMPTY_FILTERS: Filters = {
  city: "",
  type: "",
  minStars: 0,
  visited: "all",
};

function FilterPanel({
  filters,
  onChange,
  onClear,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  const active =
    filters.city !== "" ||
    filters.type !== "" ||
    filters.minStars > 0 ||
    filters.visited !== "all";

  return (
    <div className="filter-panel">
      <div className="filter-panel__header">
        <span className="filter-panel__title">Filtros</span>
        {active && (
          <button className="filter-panel__clear" onClick={onClear}>
            Limpiar
          </button>
        )}
      </div>

      <div className="filter-panel__group">
        <label className="filter-panel__label">Ciudad</label>
        <input
          className="filter-panel__input"
          type="text"
          placeholder="ej: Tokyo"
          value={filters.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </div>

      <div className="filter-panel__group">
        <label className="filter-panel__label">Tipo</label>
        <select
          className="filter-panel__select"
          value={filters.type}
          onChange={(e) => set("type", e.target.value as RestaurantType | "")}
        >
          <option value="">Todos</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-panel__group">
        <label className="filter-panel__label">Visitado</label>
        <div className="filter-panel__toggle-row">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              className={`filter-panel__toggle-btn ${filters.visited === v ? "filter-panel__toggle-btn--active" : ""}`}
              onClick={() => set("visited", v)}
            >
              {{ all: "Todos", yes: "✓ Sí", no: "✗ No" }[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-panel__group">
        <label className="filter-panel__label">Calificación mínima</label>
        <div className="filter-panel__stars">
          {STAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-panel__star-btn ${filters.minStars === opt.value ? "filter-panel__star-btn--active" : ""}`}
              onClick={() => set("minStars", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────────────────────

function RestaurantCard({
  restaurant,
  onEdit,
  onDelete,
}: {
  restaurant: Restaurant;
  onEdit: (r: Restaurant) => void;
  onDelete: (id: number) => void;
}) {
  const { name, type, schedule, location, category, rate, visited, image_url } =
    restaurant;

  return (
    <div className="card">
      {/*
        Imagen: se muestra solo si hay image_url.
        React escapa automáticamente los atributos JSX, por lo que no hay
        riesgo de XSS al usar src={image_url} con un data URL base64 ya
        validado en el backend (magic bytes + MIME + tamaño).
      */}
      {image_url && (
        <div className="card__image">
          <img src={image_url} alt={name} className="card__img" />
          {visited && <span className="card__visited">✓ Visitado</span>}
        </div>
      )}

      <div className="card__body">
        {!image_url && visited && (
          <span className="card__visited card__visited--inline">
            ✓ Visitado
          </span>
        )}
        <div className="card__tags">
          <span className="card__tag">{type}</span>
          <span className="card__tag">{category}</span>
        </div>
        <p className="card__name">{name}</p>
        <p className="card__meta">📍 {location}</p>
        <p className="card__meta">🕐 {schedule}</p>
        <div className="card__rate">
          <StarDisplay rate={rate} />
        </div>
        <div className="card__actions">
          <button
            className="card__btn card__btn--edit"
            onClick={() => onEdit(restaurant)}
          >
            Editar
          </button>
          <button
            className="card__btn card__btn--delete"
            onClick={() => onDelete(restaurant.id)}
          >
            🗑 Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  type: "Restaurante" as RestaurantType,
  timeFrom: "12:00",
  timeTo: "23:00",
  location: "",
  category: "Peruana" as Category,
  rate: "" as string,
  visited: false,
  image_url: null as string | null,
};

function parseSchedule(s: string) {
  const p = s.split(" - ");
  return { timeFrom: p[0] ?? "12:00", timeTo: p[1] ?? "23:00" };
}

function RestaurantModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Restaurant;
  onSave: (data: Omit<Restaurant, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...initial,
          ...parseSchedule(initial.schedule),
          rate: initial.rate !== null ? String(initial.rate) : "",
        }
      : EMPTY_FORM,
  );
  const [timeError, setTimeError] = useState("");
  const [imageError, setImageError] = useState("");

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Valida y convierte la imagen a base64 antes de guardarla en el estado
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");
    const { data, error } = await fileToBase64(file);
    if (error) {
      setImageError(error);
      // Limpiar el input para que el usuario pueda intentar de nuevo
      e.target.value = "";
      return;
    }
    set("image_url", data);
  };

  const handleSubmit = () => {
    if (!form.name || !form.location) {
      alert("Completa nombre y ubicación.");
      return;
    }

    if (timeToMin(form.timeFrom) >= timeToMin(form.timeTo)) {
      setTimeError("La hora de cierre debe ser posterior a la de apertura.");
      return;
    }
    setTimeError("");

    onSave({
      name: form.name,
      type: form.type,
      schedule: `${form.timeFrom} - ${form.timeTo}`,
      location: form.location,
      category: form.category,
      rate: form.rate !== "" ? Number(form.rate) : null,
      visited: form.visited,
      image_url: form.image_url ?? null,
    });
  };

  const rateOptions = Array.from({ length: 11 }, (_, i) =>
    (i * 0.5).toFixed(1),
  );

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal__title">
          {initial ? "Editar restaurante" : "Nuevo restaurante"}
        </h2>

        <div>
          <label className="modal__label">Nombre *</label>
          <input
            className="modal__input"
            type="text"
            maxLength={200}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div>
          <label className="modal__label">Ubicación *</label>
          <LocationInput
            value={form.location}
            onChange={(v) => set("location", v)}
          />
        </div>

        <div>
          <label className="modal__label">Horario de atención</label>
          <div className="modal__time-row">
            <input
              className="modal__input"
              type="time"
              value={form.timeFrom}
              onChange={(e) => {
                set("timeFrom", e.target.value);
                setTimeError("");
              }}
            />
            <span className="modal__time-sep">–</span>
            <input
              className="modal__input"
              type="time"
              value={form.timeTo}
              onChange={(e) => {
                set("timeTo", e.target.value);
                setTimeError("");
              }}
            />
          </div>
          {timeError && <p className="modal__field-error">{timeError}</p>}
        </div>

        {/* Upload de imagen — solo JPG/PNG, máx 2 MB, validado por MIME + magic bytes */}
        <div>
          <label className="modal__label">
            Foto del lugar (JPG o PNG, máx 2 MB)
          </label>
          <div className="modal__image-upload">
            {form.image_url ? (
              <img
                src={form.image_url}
                alt="preview"
                className="modal__image-preview"
              />
            ) : (
              <span className="modal__image-placeholder">Sin imagen</span>
            )}
            <label className="modal__image-btn">
              {form.image_url ? "Cambiar foto" : "Subir foto"}
              {/*
                accept limita el selector de archivos del SO.
                La validación real (MIME + magic bytes) ocurre en fileToBase64(),
                ya que accept es bypasseable por el usuario.
              */}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={handleImageChange}
              />
            </label>
            {form.image_url && (
              <button
                className="modal__image-remove"
                onClick={() => set("image_url", null)}
              >
                Quitar
              </button>
            )}
          </div>
          {imageError && <p className="modal__field-error">{imageError}</p>}
        </div>

        <div>
          <label className="modal__label">Calificación (0 – 5 estrellas)</label>
          <select
            className="modal__select"
            value={form.rate}
            onChange={(e) => set("rate", e.target.value)}
          >
            <option value="">Sin calificar</option>
            {rateOptions.map((v) => (
              <option key={v} value={v}>
                {"★".repeat(Math.floor(Number(v)))}
                {Number(v) % 1 ? "½" : ""}
                {"☆".repeat(5 - Math.ceil(Number(v)))} — {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="modal__label">Tipo</label>
          <select
            className="modal__select"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="modal__label">Categoría</label>
          <select
            className="modal__select"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <label className="modal__checkbox-label">
          <input
            type="checkbox"
            checked={form.visited}
            onChange={(e) => set("visited", e.target.checked)}
          />
          Visitado
        </label>

        <div className="modal__actions">
          <button className="modal__btn modal__btn--cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="modal__btn modal__btn--save"
            onClick={handleSubmit}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

// ─── Table view ───────────────────────────────────────────────────────────────

function TableView({
  restaurants,
  sortKey,
  sortAsc,
  onSortChange,
  onEdit,
  onDelete,
}: {
  restaurants: Restaurant[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSortChange: (key: SortKey) => void;
  onEdit: (r: Restaurant) => void;
  onDelete: (id: number) => void;
}) {
  const cols: { label: string; key: SortKey }[] = [
    { label: "Nombre", key: "name" },
    { label: "Ubicación", key: "location" },
    { label: "Categoría", key: "category" },
    { label: "Calificación", key: "rate" },
  ];

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 54 }}>Foto</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={sortKey === c.key ? "sorted" : ""}
                onClick={() => onSortChange(c.key)}
              >
                {c.label} {sortKey === c.key ? (sortAsc ? "↑" : "↓") : ""}
              </th>
            ))}
            <th>Tipo</th>
            <th>Horario</th>
            <th style={{ textAlign: "center" }}>Visitado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r) => (
            <tr key={r.id}>
              <td>
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="table__thumb"
                  />
                ) : (
                  <div className="table__thumb--empty">🍽️</div>
                )}
              </td>
              <td style={{ fontWeight: 500, color: "#212121" }}>{r.name}</td>
              <td>{r.location}</td>
              <td>
                <span className="table__tag">{r.category}</span>
              </td>
              <td>
                {r.rate !== null ? (
                  <span className="table__stars">
                    {"★".repeat(Math.floor(r.rate))}
                    {r.rate % 1 ? "½" : ""}{" "}
                    <span style={{ color: "#bfbfbf", fontSize: 11 }}>
                      {r.rate.toFixed(1)}
                    </span>
                  </span>
                ) : (
                  <span className="table__no-rate">Sin calificar</span>
                )}
              </td>
              <td>
                <span className="table__tag">{r.type}</span>
              </td>
              <td style={{ color: "#bfbfbf", fontSize: 12 }}>{r.schedule}</td>
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  className="table__checkbox"
                  checked={r.visited}
                  readOnly
                />
              </td>
              <td>
                <div className="table__actions">
                  <button
                    className="table__btn table__btn--edit"
                    onClick={() => onEdit(r)}
                  >
                    Editar
                  </button>
                  <button
                    className="table__btn table__btn--delete"
                    onClick={() => onDelete(r.id)}
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [backendCategory, setBackendCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortAsc, setSortAsc] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | undefined>();

  // ── Fetch — filtros de backend: category, visited, type ──────────────────────

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (backendCategory) params.set("category", backendCategory);
      if (filters.visited === "yes") params.set("visited", "true");
      if (filters.visited === "no") params.set("visited", "false");
      if (filters.type) params.set("type", filters.type);
      const data = await apiFetch<Restaurant[]>(`/restaurants?${params}`);
      setRestaurants(data);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [backendCategory, filters.visited, filters.type]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  useEffect(() => {
    const close = () => setSortOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const handleSave = async (data: Omit<Restaurant, "id">) => {
    if (editTarget)
      await apiFetch(`/restaurants/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    else
      await apiFetch("/restaurants", {
        method: "POST",
        body: JSON.stringify(data),
      });
    setModalOpen(false);
    setEditTarget(undefined);
    fetchRestaurants();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este restaurante?")) return;
    await apiFetch(`/restaurants/${id}`, { method: "DELETE" });
    fetchRestaurants();
  };

  const openCreate = () => {
    setEditTarget(undefined);
    setModalOpen(true);
  };
  const openEdit = (r: Restaurant) => {
    setEditTarget(r);
    setModalOpen(true);
  };

  // ── Filtros frontend (ciudad y estrellas) ─────────────────────────────────────

  const filtered = restaurants
    .filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        r.name.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q);
      const matchCategory =
        activeCategory === "all" || r.category === activeCategory;
      const matchCity =
        filters.city === "" ||
        r.location.toLowerCase().includes(filters.city.toLowerCase());
      const matchStars =
        filters.minStars === 0 ||
        (r.rate !== null && r.rate >= filters.minStars);
      return matchSearch && matchCategory && matchCity && matchStars;
    })
    .sort((a, b) => {
      const cmp =
        sortKey === "rate"
          ? (a.rate ?? -1) - (b.rate ?? -1)
          : (a[sortKey] as string).localeCompare(b[sortKey] as string, "es");
      return sortAsc ? cmp : -cmp;
    });

  const activeGenre = GENRES.find((g) => g.category === activeCategory);
  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.key === sortKey)?.label ?? "Calificación";
  const title =
    activeCategory === "all"
      ? "Todos los Restaurantes"
      : `Cocina ${activeGenre?.label}`;
  const activeFilters =
    filters.city !== "" ||
    filters.type !== "" ||
    filters.minStars > 0 ||
    filters.visited !== "all";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <span className="sidebar__logo-text">FoodList</span>
        </div>
        <nav className="sidebar__nav">
          <p className="sidebar__section-label">Categorías</p>
          {GENRES.map((g) => (
            <button
              key={g.category}
              className={`sidebar__btn ${activeCategory === g.category ? "sidebar__btn--active" : ""}`}
              onClick={() => {
                setActiveCategory(g.category);
                setBackendCategory(g.category === "all" ? "" : g.category);
              }}
            >
              <span className="sidebar__label">{g.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="searchbar">
            <input
              className="searchbar__input"
              type="text"
              placeholder="Buscar restaurantes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="searchbar__clear"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>
          <button className="btn-add" onClick={openCreate}>
            + Agregar
          </button>
        </div>

        <div className="content-row">
          <div className="filter-col">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          </div>

          <div className="grid-col">
            <div className="grid-header">
              <h1 className="page-title">{title}</h1>
              <div className="pills">
                {activeFilters && (
                  <span className="pill pill--active">
                    {[
                      filters.city && `Ciudad: ${filters.city}`,
                      filters.type && filters.type,
                      filters.minStars > 0 && `≥ ${filters.minStars}★`,
                      filters.visited === "yes" && "Solo visitados",
                      filters.visited === "no" && "Sin visitar",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="pill--btn"
                    onClick={() => setSortOpen((o) => !o)}
                  >
                    Ordenar: {activeSortLabel} {sortAsc ? "↑" : "↓"}
                  </button>
                  {sortOpen && (
                    <div className="dropdown__menu">
                      {SORT_OPTIONS.map((s) => (
                        <button
                          key={s.key}
                          className={`dropdown__item ${sortKey === s.key ? "dropdown__item--active" : ""}`}
                          onClick={() => {
                            if (sortKey === s.key) setSortAsc((a) => !a);
                            else {
                              setSortKey(s.key);
                              setSortAsc(false);
                            }
                            setSortOpen(false);
                          }}
                        >
                          {s.label}{" "}
                          {sortKey === s.key ? (sortAsc ? "↑" : "↓") : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="view-toggle">
                  <button
                    className={`view-toggle__btn ${viewMode === "cards" ? "view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("cards")}
                    title="Vista tarjetas"
                  >
                    ⊞
                  </button>
                  <button
                    className={`view-toggle__btn ${viewMode === "table" ? "view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("table")}
                    title="Vista tabla"
                  >
                    ☰
                  </button>
                </div>
              </div>
            </div>

            {loading && <p className="status status--loading">Cargando...</p>}
            {error && <p className="status status--error">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="status status--empty">
                No se encontraron restaurantes.
              </p>
            )}

            {!loading &&
              !error &&
              (viewMode === "cards" ? (
                <div className="grid">
                  {filtered.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ) : (
                <TableView
                  restaurants={filtered}
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSortChange={(key) => {
                    if (sortKey === key) setSortAsc((a) => !a);
                    else {
                      setSortKey(key);
                      setSortAsc(false);
                    }
                  }}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
          </div>
        </div>
      </main>

      {modalOpen && (
        <RestaurantModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditTarget(undefined);
          }}
        />
      )}
    </div>
  );
}
