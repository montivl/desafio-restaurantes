# Desafío Técnico

Aplicación web para llevar registro de restaurantes, bares, cafeterías y otros lugares para comer. Permite agregar, editar, eliminar y filtrar lugares, con persistencia en base de datos.

---

## Tecnologías utilizadas

| Capa          | Tecnología                              |
| ------------- | --------------------------------------- |
| Frontend      | React + TypeScript (Vite)               |
| Estilos       | CSS propio (sin framework)              |
| Backend       | Python 3.11 + FastAPI                   |
| ORM           | SQLAlchemy 2.0                          |
| Base de datos | SQLite (archivo local 'restaurants.db') |
| Validación    | Pydantic v2                             |

---

## Estructura del proyecto

```
restaurant-project/
├── src/
│   ├── backend/
│   │   ├── main.py          # App FastAPI
│   │   ├── models.py        # Modelo SQLAlchemy (tabla restaurants)
│   │   ├── schemas.py       # Schemas Pydantic (Create / Update / Out)
│   │   ├── database.py      # Conexión SQLite + sesión + get_db
│   │   └── restaurants.db   # Generado automáticamente al iniciar
│   ├── components/
│   │   ├── Restaurants.tsx  # Vista principal
│   │   └── Restaurants.css  # Estilos de la vista
│   ├── App.tsx              # Monta <Restaurants />
│   └── main.tsx             # Entry point de React
├── requirements.txt
├── package.json
└── README.md
```

---

## Requisitos previos

- **Node.js** v24.x
- **Python** 3.9 o superior
- **pip**

---

## Cómo correr el proyecto

Se necesitan 2 terminales abiertas simultáneamente: una para el back y otra para el front

### 1. Backend con FastAPI

```bash
# Desde la raíz
cd src/backend

# Instalar requirements.txt (en env)
pip install -r ../../requirements.txt

# Iniciar el servidor
uvicorn main:app --reload
```

El servidor queda en 'http://localhost:8000'.

> La base de datos SQLite se crea automáticamente como `restaurants.db` en `src/backend/` la primera vez que corre.
> Documentación interactiva disponible en: `http://localhost:8000/docs`

---

### 2. Frontend con React + Vite

```bash
# Desde la raíz
cd restaurant-project

# Instalar dependencias
npm install

# Iniciar el servidor
npm run dev
```

La app queda en **`http://localhost:5173`**.

---

## Funcionalidades implementadas

### CRUD completo

- Agregar restaurante desde el botón "+ Agregar"
- Editar desde el botón en cada tarjeta
- Eliminar desde el botón en cada tarjeta (pide confirmación)
- Todas las operaciones persisten en SQLite
- Se mantuvo la idea del desafío en la vista de tabla

### Filtros

| Filtro              | Nivel    | Descripción                                                        |
| ------------------- | -------- | ------------------------------------------------------------------ |
| Categoría (sidebar) | Backend  | Hace 'GET /restaurants?category=Peruana', el backend filtra en SQL |
| Búsqueda por nombre | Frontend | Filtra sobre los datos ya cargados en memoria                      |
| Ciudad              | Frontend | Coincidencia parcial sobre el campo `location`                     |
| Tipo de lugar       | Backend  | '?type=Cafetería', el backend filtra en SQL                        |
| Calificación mínima | Frontend | Muestra solo lugares con `rate >= N` estrellas                     |
| Visitado            | Backend  | '?visited=true/false', tres estados: Todos / Sí / No               |

### Ordenamiento

Columnas disponibles: Nombre, Calificación, Categoría, Ubicación. Cada columna alterna ascendente / descendente al hacer clic.

---

## Endpoints del backend

| Método   | Ruta                | Descripción                                              |
| -------- | ------------------- | -------------------------------------------------------- |
| `GET`    | `/restaurants`      | Acepta ?category=, ?name=, ?location=, ?visited=, ?type= |
| `POST`   | `/restaurants`      | Crea un nuevo restaurante                                |
| `PUT`    | `/restaurants/{id}` | Edita campos específicos                                 |
| `DELETE` | `/restaurants/{id}` | Elimina por ID, retorna 204                              |

## Modelo de datos

```
Restaurant
├── id          Integer     PK, autoincrement
├── name        String      Nombre del lugar
├── type        String      Restaurante | Cafetería | Comida Rápida | Bar | Pastelería
├── schedule    String      Horario en formato "HH:MM - HH:MM"
├── location    String      Ciudad, País (ej: "Lima, Perú")
├── category    String      Tipo de cocina (Peruana, Italiana, Japonesa…)
├── rate        Float?      Calificación 0.0–5.0 en pasos de 0.5 (nullable)
├── visited     Boolean     Si el lugar ya fue visitado
└── image_url   Text?        Foto en base64 data URL (nullable)
```

---

## Extras

### Autocomplete de ubicación

**SQLite en vez de PostgreSQL/MySQL**
Se eligió SQLite para simplificar la configuración, como no requiere instalar ni configurar un servidor de base de datos externo. Cualquier persona que clone el repo puede correrlo con `pip install`.

**Calificación de 0 a 5 estrellas (float)**
El enunciado pedía un campo de calificación sin especificar rango. Se eligió 0–5 en pasos de 0.5 porque es el estándar más reconocible para usuarios. Internamente se guarda como `Float` en la BD.

**Filtro de categoría en backend, resto en frontend**
El filtro más "pesado" semánticamente (categoría de cocina) se resuelve en el servidor para cumplir el requisito del desafío. Los demás filtros (ciudad, tipo, estrellas mínimas) operan sobre los datos ya en memoria para evitar round-trips innecesarios y dar respuesta inmediata al usuario.

**Autocomplete con Nominatim**
Se usó la API pública de OpenStreetMap en vez de Google Places para no requerir API key ni tarjeta de crédito. El input tiene debounce de 350ms para no saturar el servicio.
Referencia: https://nominatim.org/release-docs/develop/api/Search/

**Un solo componente de página (`Restaurants.tsx`)**
Dado que el proyecto es sencillo se optó por una sola vista, y así mantener todo en un archivo para facilitar la revisión. Los subcomponentes (`RestaurantCard`, `RestaurantModal`, `FilterPanel`, `LocationInput`) están clocalizados en el mismo archivo ya que son exclusivos de esta vista.

**Todas** las imágenes son sin copyright, sacadas desde https://pixabay.com/, el template CSS corresponde al de 'https://freehtml5.co/present-free-website-template-using-bootstrap-for-portfolio/', con leves modificicaciones.

---

## Seguridad

**XSS**
Validan que el valor sea estrictamente un data URL base64 de JPEG o PNG, pero React ya maneja este tipo de ataque.

**Validación de imágenes (doble capa)**

- _Frontend_: se verifica el MIME type del archivo y sus magic bytes
  (FF D8 FF para JPEG, 89 50 4E 47 para PNG) antes de convertirlo a base64.
  El atributo `accept` del input restringe el selector del SO, pero no es
  suficiente por sí solo ya que el usuario puede modificarlo.
- _Backend_: `schemas.py` vuelve a verificar que el data URL empiece con
  `data:image/jpeg` o `data:image/png`, decodifica el base64 y re-verifica
  los magic bytes. Tamaño máximo: 2 MB.

**Validación de campos (backend)**
Todos los campos tienen longitud máxima en Pydantic. `type` y `category`
se validan contra listas cerradas, rechazando valores arbitrarios.
`schedule` se valida con regex `HH:MM - HH:MM` y consistencia de horas.

**SQL Injection**
Cubierto por SQLAlchemy ORM: todos los filtros usan parámetros vinculados
(`ilike`, `==`), nunca interpolación de strings en SQL.

**CORS**
Configurado para aceptar solo `localhost:5173` y `localhost:3000`.

---

## Supuestos

- No se implementó autenticación porque el enunciado indica explícitamente que no es necesario registrarse ni iniciar sesión.
- El checkbox "visitado" se puede marcar independientemente de si hay calificación.

---

## Fuentes y referencias

- FastAPI docs: https://fastapi.tiangolo.com
- SQLAlchemy 2.0: https://docs.sqlalchemy.org/en/20/
- Pydantic v2: https://docs.pydantic.dev/latest/
- Nominatim API: https://nominatim.org/release-docs/develop/api/Search/
- Vite + React + TypeScript: https://vitejs.dev/guide/
