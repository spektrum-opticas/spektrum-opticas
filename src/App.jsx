import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Calendar, ShoppingCart, Package, Users, FlaskConical, FileBarChart,
  UserCog, Upload, Settings, Printer, Trash2, X, Search, Plus,
  ChevronLeft, ChevronRight, Save, LogOut, Eye
} from "lucide-react";

/* ============================================================
   SPEKTRUM ÓPTICAS — Plataforma de gestión
   Persistencia real vía window.storage (shared=true: todo el
   equipo y el sistema ven los mismos datos).
   ============================================================ */

const SKY = "#5EB6E8";
const SKY_DARK = "#3A9BD1";
const BEIGE = "#F3EAD8";
const BEIGE_DARK = "#E4D4B5";

const SUPABASE_URL = "https://mxlmobpziadhpxwpxerr.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bG1vYnB6aWFkaHB4d3B4ZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzU3MDUsImV4cCI6MjEwMDUxMTcwNX0.MUd_qyCv7cxOwOBLF_m-awL6HhE2fEYblI9G5JhY5aY";

const STORAGE_KEYS = {
  pacientes: "pacientes",
  inventario: "inventario",
  agenda: "agenda",
  ventas: "ventas",
  usuarios: "usuarios",
  config: "configuracion",
  laboratorio: "laboratorio",
  reportes: "reportes",
  pagosProveedores: "pagos_proveedores",
};

async function supaGet(tabla) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.main&select=datos`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`No se pudo leer "${tabla}" (HTTP ${res.status})`);
  const filas = await res.json();
  return filas[0]?.datos ?? null;
}

async function supaSet(tabla, datos) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([{ id: "main", datos }]),
  });
  if (!res.ok) throw new Error(`No se pudo guardar "${tabla}" (HTTP ${res.status})`);
  return true;
}

const emptyInventario = () => ({
  armazones: [],
  lentesGraduados: [],
  lentesContacto: [],
  lentesSolares: [],
  accesorios: [],
});

const emptyConfig = () => ({
  logo: null,
  direccion: "Calle 6 Sur 1310-614, Col. Lomas del Sol 2, Puebla, Puebla",
  telefono: "2228595304",
});

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Imprime SOLO el elemento indicado. Al llamar window.print(), el navegador
// abre el diálogo nativo del sistema operativo, donde el usuario elige
// cualquiera de sus impresoras instaladas (o "Guardar como PDF").
function imprimirElemento(id) {
  document.querySelectorAll(".print-only").forEach((el) => el.classList.remove("print-only"));
  const el = document.getElementById(id);
  if (el) el.classList.add("print-only");
  setTimeout(() => window.print(), 50);
}

function exportarRespaldo(datos) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fechaHora = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `spektrum-respaldo-${fechaHora}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function useSesion() {
  const [sesion, setSesionState] = useState(() => {
    try {
      const raw = localStorage.getItem("spektrum_sesion");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const setSesion = (s) => {
    setSesionState(s);
    try {
      if (s) localStorage.setItem("spektrum_sesion", JSON.stringify(s));
      else localStorage.removeItem("spektrum_sesion");
    } catch {}
  };
  return [sesion, setSesion];
}

function LoginScreen({ usuarios, setUsuarios, onIngresar, config }) {
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const esPrimerAcceso = usuarios.length === 0;

  function entrar() {
    setError("");
    if (!nombre || !password) {
      setError("Completa usuario y contraseña.");
      return;
    }
    if (esPrimerAcceso) {
      const admin = { id: uid(), nombre, password, rol: "ADMIN" };
      setUsuarios([admin]);
      onIngresar({ nombre: admin.nombre, rol: admin.rol });
      return;
    }
    const encontrado = usuarios.find(
      (u) => u.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() && u.password === password
    );
    if (!encontrado) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    onIngresar({ nombre: encontrado.nombre, rol: encontrado.rol });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: BEIGE }}>
      <div className="bg-white border rounded-xl p-6 w-full max-w-sm shadow-lg">
        {config?.logo && <img src={config.logo} alt="logo" style={{ height: 70 }} className="mx-auto mb-2" />}
        <h1 className="text-xl font-bold text-slate-800 mb-1 text-center">Spektrum Ópticas</h1>
        <p className="text-xs text-slate-500 text-center mb-4">
          {esPrimerAcceso ? "Primer acceso — crea la cuenta de administrador" : "Acceso para personal"}
        </p>
        <Field label="Usuario" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button
          onClick={entrar}
          className="w-full py-2 rounded-lg text-white text-sm font-medium mt-2"
          style={{ background: SKY_DARK }}
        >
          {esPrimerAcceso ? "Crear cuenta y entrar" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

function GlobalPrintStyles() {
  return (
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .print-only, .print-only * { visibility: visible !important; }
        .print-only {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 24px !important;
        }
      }
    `}</style>
  );
}

function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await supaGet(key);
      setValue(datos != null ? datos : initial);
      setLoaded(true);
      setStatus("saved");
      setError(null);
    } catch (e) {
      setLoaded(true);
      setStatus("error");
      setError(e?.message || String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const persist = useCallback(
    async (next) => {
      setValue(next);
      setStatus("saving");
      try {
        await supaSet(key, next);
        setStatus("saved");
        setError(null);
      } catch (e) {
        try {
          await supaSet(key, next);
          setStatus("saved");
          setError(null);
        } catch (e2) {
          console.error("Error guardando", key, e2);
          setStatus("error");
          setError(e2?.message || String(e2));
        }
      }
    },
    [key]
  );

  const valueRef = useRef(value);
  valueRef.current = value;
  const reintentar = useCallback(() => persist(valueRef.current), [persist]);

  return [value, persist, loaded, status, error, reintentar, cargar];
}

function Icon({ name, size = 20 }) {
  const map = {
    calendar: Calendar,
    cart: ShoppingCart,
    package: Package,
    users: Users,
    lab: FlaskConical,
    report: FileBarChart,
    usercog: UserCog,
    upload: Upload,
    settings: Settings,
  };
  const C = map[name] || Calendar;
  return <C size={size} />;
}

/* ---------------- Top ribbon ---------------- */
function Ribbon({ current, onSelect }) {
  const items = [
    { id: "agenda", label: "Agenda", icon: "calendar" },
    { id: "pos", label: "POS", icon: "cart" },
    { id: "inventario", label: "Inventario", icon: "package" },
    { id: "pacientes", label: "Pacientes", icon: "users" },
    { id: "laboratorio", label: "Laboratorio", icon: "lab" },
    { id: "reportes", label: "Reportes", icon: "report" },
    { id: "usuarios", label: "Usuarios", icon: "usercog" },
    { id: "importar", label: "Importar datos", icon: "upload" },
    { id: "config", label: "Configuración", icon: "settings" },
  ];
  return (
    <div
      style={{ background: SKY }}
      className="w-full flex items-center gap-1 px-3 py-2 overflow-x-auto shadow-md"
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onSelect(it.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
            current === it.id
              ? "bg-white text-sky-700 shadow"
              : "text-white hover:bg-white/20"
          }`}
        >
          <Icon name={it.icon} size={18} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Header({ config }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3 bg-white border-b">
      {config.logo ? (
        <img src={config.logo} alt="logo" style={{ height: 96 }} className="object-contain" />
      ) : (
        <div className="h-24 w-24 rounded-full bg-sky-100 flex items-center justify-center text-sky-500 font-bold text-xl">
          SO
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Spektrum Ópticas</h1>
        <p className="text-sm text-slate-500">{config.direccion}</p>
        <p className="text-sm text-slate-500">Tel: {config.telefono}</p>
      </div>
    </div>
  );
}

/* ---------------- Modal shell ---------------- */
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] flex flex-col`}
      >
        <div
          className="flex items-center justify-between px-5 py-3 rounded-t-xl"
          style={{ background: `${SKY}CC` }}
        >
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded p-1">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <input
        {...props}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </label>
  );
}

/* ============================================================
   AGENDA
   ============================================================ */
const HORAS = Array.from({ length: 21 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

const ESTATUS_COLORS = {
  proxima: "#94a3b8",
  llego: "#3b82f6",
  en_consulta: "#f59e0b",
  piso_ventas: "#8b5cf6",
  no_acudio: "#ef4444",
};
const ESTATUS_LABEL = {
  proxima: "Próxima",
  llego: "Llegó",
  en_consulta: "En consulta",
  piso_ventas: "Piso de ventas",
  no_acudio: "No acudió",
};

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

function AgendaView({ agenda, setAgenda, pacientes, setPacientes, goToPOS }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [expediente, setExpediente] = useState(null); // paciente abierto
  const [draggingId, setDraggingId] = useState(null);
  const [nuevaCitaSlot, setNuevaCitaSlot] = useState(null); // {consultorio, hora}
  const [cerrados, setCerrados] = useState({}); // key: consultorio-hora -> 'cerrado'|'comida'

  const citasDelDia = agenda.filter((c) => c.fecha === fecha);
  const reasignar = agenda.filter((c) => c.consultorio === "reasignar");

  function citaEn(consultorio, hora) {
    return citasDelDia.find((c) => c.consultorio === consultorio && c.hora === hora);
  }

  function moverCita(id, consultorio, hora) {
    const next = agenda.map((c) =>
      c.id === id ? { ...c, consultorio, hora: hora || c.hora, fecha: consultorio === "reasignar" ? c.fecha : fecha } : c
    );
    setAgenda(next);
  }

  function cambiarEstatus(id, estatus) {
    setAgenda(agenda.map((c) => (c.id === id ? { ...c, estatus } : c)));
  }

  function eliminarCita(id) {
    setAgenda(agenda.filter((c) => c.id !== id));
  }

  function crearCita(datos) {
    const nueva = { id: uid(), fecha, ...datos, estatus: "proxima" };
    setAgenda([...agenda, nueva]);
    setNuevaCitaSlot(null);
  }

  const toggleCerrado = (key, tipo) => {
    setCerrados((prev) => {
      const cur = prev[key];
      const copy = { ...prev };
      if (cur === tipo) delete copy[key];
      else copy[key] = tipo;
      return copy;
    });
  };

  const paciente = expediente ? pacientes.find((p) => p.id === expediente) : null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(fecha);
              d.setDate(d.getDate() - 1);
              setFecha(fechaISO(d));
            }}
            className="p-2 rounded-lg hover:bg-sky-100"
          >
            <ChevronLeft />
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              const d = new Date(fecha);
              d.setDate(d.getDate() + 1);
              setFecha(fechaISO(d));
            }}
            className="p-2 rounded-lg hover:bg-sky-100"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3" style={{ maxHeight: "72vh", overflowY: "auto" }}>
        {["Consultorio 1", "Consultorio 2", "reasignar"].map((col) => (
          <div key={col} className="flex flex-col" style={{ minWidth: 0 }}>
            <div
              className="text-center font-semibold py-2 rounded-t-lg text-white text-sm"
              style={{ background: SKY_DARK }}
            >
              {col === "reasignar" ? "CITAS PARA REASIGNAR (CONSULTORIO VIRTUAL)" : col}
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) moverCita(draggingId, col, null);
              }}
              className="flex-1 border border-dashed rounded-b-lg"
              style={{ borderColor: BEIGE_DARK }}
            >
              {col === "reasignar"
                ? reasignar.map((c) => (
                    <CitaBlock
                      key={c.id}
                      cita={c}
                      onDragStart={() => setDraggingId(c.id)}
                      onClickNombre={() => setExpediente(c.pacienteId)}
                      onEliminar={() => eliminarCita(c.id)}
                      onEstatus={(e) => cambiarEstatus(c.id, e)}
                      dark
                    />
                  ))
                : HORAS.map((hora) => {
                    const c = citaEn(col, hora);
                    const key = `${col}-${hora}`;
                    const cerradoTipo = cerrados[key];
                    return (
                      <div
                        key={hora}
                        style={{ background: BEIGE, borderColor: BEIGE_DARK }}
                        className="border-b border-dashed px-1 py-1 min-h-[46px] flex items-center gap-1"
                      >
                        <span className="text-[10px] text-slate-400 w-10 shrink-0">{hora}</span>
                        {c ? (
                          <CitaBlock
                            cita={c}
                            onDragStart={() => setDraggingId(c.id)}
                            onClickNombre={() => setExpediente(c.pacienteId)}
                            onEliminar={() => eliminarCita(c.id)}
                            onEstatus={(e) => cambiarEstatus(c.id, e)}
                          />
                        ) : cerradoTipo ? (
                          <div className="flex-1 text-center text-xs italic text-slate-500">
                            {cerradoTipo === "cerrado" ? "Consultorio cerrado" : "Horario de comida"}
                            <button onClick={() => toggleCerrado(key, cerradoTipo)} className="ml-2 text-red-400">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex gap-1 justify-end">
                            <button
                              onClick={() => setNuevaCitaSlot({ consultorio: col, hora })}
                              className="text-[10px] px-1 rounded bg-sky-200 hover:bg-sky-300"
                            >
                              + Cita
                            </button>
                            <button
                              onClick={() => toggleCerrado(key, "cerrado")}
                              className="text-[10px] px-1 rounded bg-slate-200 hover:bg-slate-300"
                            >
                              Cerrar
                            </button>
                            <button
                              onClick={() => toggleCerrado(key, "comida")}
                              className="text-[10px] px-1 rounded bg-amber-200 hover:bg-amber-300"
                            >
                              Comida
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!nuevaCitaSlot} onClose={() => setNuevaCitaSlot(null)} title="Nueva cita">
        {nuevaCitaSlot && (
          <NuevaCitaForm
            pacientes={pacientes}
            setPacientes={setPacientes}
            onCrear={(datos) => crearCita({ ...nuevaCitaSlot, ...datos })}
          />
        )}
      </Modal>

      <Modal open={!!expediente} onClose={() => setExpediente(null)} title="Expediente del paciente" wide>
        {paciente && (
          <ExpedientePaciente
            paciente={paciente}
            pacientes={pacientes}
            setPacientes={setPacientes}
            onVenta={() => {
              setExpediente(null);
              goToPOS(paciente.id);
            }}
            onGuardarSalir={() => setExpediente(null)}
            onEliminar={() => {
              setPacientes(pacientes.filter((p) => p.id !== paciente.id));
              setAgenda(agenda.filter((c) => c.pacienteId !== paciente.id));
              setExpediente(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CitaBlock({ cita, onDragStart, onClickNombre, onEliminar, onEstatus, dark }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{ background: dark ? BEIGE_DARK : "white" }}
      className="flex-1 flex items-center gap-2 rounded px-2 py-1 text-xs shadow-sm cursor-move"
    >
      <span
        title={ESTATUS_LABEL[cita.estatus]}
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: ESTATUS_COLORS[cita.estatus] || "#94a3b8" }}
      />
      <button onClick={onClickNombre} className="text-sky-700 font-medium hover:underline truncate flex-1 text-left">
        {cita.nombre}
      </button>
      <select
        value={cita.estatus}
        onChange={(e) => onEstatus(e.target.value)}
        className="text-[10px] border rounded"
      >
        {Object.keys(ESTATUS_LABEL).map((k) => (
          <option key={k} value={k}>
            {ESTATUS_LABEL[k]}
          </option>
        ))}
      </select>
      <button onClick={onEliminar} className="text-red-400 hover:text-red-600">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function NuevaCitaForm({ pacientes, setPacientes, onCrear }) {
  const [busqueda, setBusqueda] = useState("");
  const [pacienteId, setPacienteId] = useState(null);
  const [nombre, setNombre] = useState("");

  const resultados = busqueda
    ? pacientes.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : [];

  return (
    <div>
      <label className="block mb-2 text-xs font-medium text-slate-500 uppercase">Buscar paciente</label>
      <input
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setPacienteId(null);
          setNombre(e.target.value);
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
        placeholder="Nombre del paciente"
      />
      {resultados.length > 0 && !pacienteId && (
        <div className="border rounded-lg mb-3 max-h-32 overflow-y-auto">
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPacienteId(p.id);
                setNombre(p.nombre);
                setBusqueda(p.nombre);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-sky-50"
            >
              {p.nombre} — {p.telefono}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          let pid = pacienteId;
          if (!pid) {
            const nuevo = { id: uid(), folio: pacientes.length + 1, nombre, telefono: "", compras: [] };
            setPacientes([...pacientes, nuevo]);
            pid = nuevo.id;
          }
          onCrear({ pacienteId: pid, nombre });
        }}
        disabled={!nombre}
        className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-40"
        style={{ background: SKY_DARK }}
      >
        Agendar cita
      </button>
    </div>
  );
}

function ExpedientePaciente({ paciente, pacientes, setPacientes, onVenta, onGuardarSalir, onEliminar }) {
  const [datos, setDatos] = useState(paciente);
  const [anamnesisA, setAnamnesisA] = useState(paciente.anamnesisA || {
    "Visión borrosa lejos": false, "Visión borrosa cerca": false, "Ardor": false, "Irritación": false,
    "Cansancio": false, "Resequedad": false, "Conjuntivitis": false,
  });
  const [anamnesisB, setAnamnesisB] = useState(paciente.anamnesisB || {
    "Pterigión": false, "Cx lasik": false, "Cx catarata": false, "Cx pterigión": false,
    "Otras Cx": false, "Diabetes": false, "Hipertensión": false,
  });
  const [receta, setReceta] = useState(
    paciente.receta || {
      OD: { ESF: "", CIL: "", EJE: "", DNP: "", ADD: "", ACO: "", PRISMA: "", BASE: "" },
      OI: { ESF: "", CIL: "", EJE: "", DNP: "", ADD: "", ACO: "", PRISMA: "", BASE: "" },
    }
  );
  const [avSin, setAvSin] = useState(paciente.avSin || "");
  const [avAnt, setAvAnt] = useState(paciente.avAnt || "");
  const [avNueva, setAvNueva] = useState(paciente.avNueva || "");
  const [lenteRec, setLenteRec] = useState(paciente.lenteRec || "");

  function guardar() {
    const actualizado = { ...datos, anamnesisA, anamnesisB, receta, avSin, avAnt, avNueva, lenteRec };
    setPacientes(pacientes.map((p) => (p.id === paciente.id ? actualizado : p)));
  }

  const camposReceta = ["ESF", "CIL", "EJE", "DNP", "ADD", "ACO", "PRISMA", "BASE"];

  return (
    <div className="space-y-4" style={{ maxHeight: "65vh", overflowY: "auto" }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" value={datos.nombre || ""} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
        <Field label="Teléfono" value={datos.telefono || ""} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
        <Field label="Dirección" value={datos.direccion || ""} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} />
        <Field label="Email" value={datos.email || ""} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
        <Field label="Ciudad" value={datos.ciudad || ""} onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })} />
        <Field label="Municipio" value={datos.municipio || ""} onChange={(e) => setDatos({ ...datos, municipio: e.target.value })} />
        <Field label="Edad" value={datos.edad || ""} onChange={(e) => setDatos({ ...datos, edad: e.target.value })} />
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Anamnesis</h3>
        <div className="grid grid-cols-2 gap-4">
          {[["A", anamnesisA, setAnamnesisA], ["B", anamnesisB, setAnamnesisB]].map(([k, obj, setObj]) => (
            <div key={k} className="space-y-1">
              {Object.keys(obj).map((padecimiento) => (
                <label key={padecimiento} className="flex items-center justify-between text-sm border-b py-1">
                  {padecimiento}
                  <input
                    type="checkbox"
                    checked={obj[padecimiento]}
                    onChange={(e) => setObj({ ...obj, [padecimiento]: e.target.checked })}
                    className="accent-black w-4 h-4"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Receta</h3>
        {["OD", "OI"].map((ojo) => (
          <div key={ojo} className="flex items-center gap-2 mb-1">
            <span className="w-10 font-semibold text-sm">{ojo === "OD" ? "O.D." : "O.I."}</span>
            {camposReceta.map((campo) => (
              <input
                key={campo}
                placeholder={campo}
                value={receta[ojo][campo]}
                onChange={(e) =>
                  setReceta({ ...receta, [ojo]: { ...receta[ojo], [campo]: e.target.value } })
                }
                className="w-16 border rounded px-1 py-1 text-xs text-center"
              />
            ))}
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Agudeza visual</h3>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-40">A.V. sin corrección</span> 20/
            <input value={avSin} onChange={(e) => setAvSin(e.target.value)} className="w-16 border rounded px-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-40">A.V. con Rx anterior</span> 20/
            <input value={avAnt} onChange={(e) => setAvAnt(e.target.value)} className="w-16 border rounded px-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-40">A.V. con nueva Rx</span> 20/
            <input value={avNueva} onChange={(e) => setAvNueva(e.target.value)} className="w-16 border rounded px-1" />
          </div>
        </div>
      </div>

      <Field label="Lente recomendado" value={lenteRec} onChange={(e) => setLenteRec(e.target.value)} />

      {/* Plantillas imprimibles (ocultas en pantalla, visibles solo al imprimir) */}
      <div style={{ position: "absolute", left: -9999, top: 0 }}>
        <div id="receta-imprimible">
          <p className="font-bold text-center mb-2">RECETA — {datos.nombre}</p>
          <p className="text-xs text-center mb-3">{new Date().toLocaleDateString("es-MX")}</p>
          {["OD", "OI"].map((ojo) => (
            <div key={ojo} className="flex gap-2 mb-1 text-sm">
              <span className="w-10 font-semibold">{ojo === "OD" ? "O.D." : "O.I."}</span>
              {camposReceta.map((campo) => (
                <span key={campo} className="w-16 text-center border-b">
                  {campo}: {receta[ojo][campo]}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div id="expediente-imprimible">
          <p className="font-bold text-center mb-2">EXPEDIENTE — {datos.nombre}</p>
          <p className="text-sm">Teléfono: {datos.telefono}</p>
          <p className="text-sm">Dirección: {datos.direccion}</p>
          <p className="text-sm">Email: {datos.email}</p>
          <p className="text-sm">Ciudad/Municipio: {datos.ciudad} / {datos.municipio}</p>
          <p className="text-sm">Edad: {datos.edad}</p>
          <p className="font-semibold mt-2">Anamnesis</p>
          {[...Object.entries(anamnesisA), ...Object.entries(anamnesisB)]
            .filter(([, v]) => v)
            .map(([k]) => (
              <p key={k} className="text-sm">• {k}</p>
            ))}
          <p className="font-semibold mt-2">Receta</p>
          {["OD", "OI"].map((ojo) => (
            <p key={ojo} className="text-sm">
              {ojo === "OD" ? "O.D." : "O.I."}: {camposReceta.map((c) => `${c} ${receta[ojo][c]}`).join(" · ")}
            </p>
          ))}
          <p className="font-semibold mt-2">Agudeza visual</p>
          <p className="text-sm">Sin corrección 20/{avSin} — Con Rx anterior 20/{avAnt} — Con nueva Rx 20/{avNueva}</p>
          <p className="font-semibold mt-2">Lente recomendado</p>
          <p className="text-sm">{lenteRec}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button onClick={guardar} className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm flex items-center gap-1">
          <Save size={16} /> Guardar
        </button>
        <button
          onClick={() => {
            guardar();
            onVenta();
          }}
          className="px-3 py-2 rounded-lg text-white text-sm flex items-center gap-1"
          style={{ background: SKY_DARK }}
        >
          <ShoppingCart size={16} /> Ir a venta (POS)
        </button>
        <button
          onClick={() => {
            guardar();
            imprimirElemento("receta-imprimible");
          }}
          className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Solo receta
        </button>
        <button
          onClick={() => {
            guardar();
            imprimirElemento("expediente-imprimible");
          }}
          className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Expediente completo
        </button>
        <button
          onClick={() => {
            guardar();
            onGuardarSalir();
          }}
          className="px-3 py-2 rounded-lg bg-slate-600 text-white text-sm flex items-center gap-1"
        >
          <LogOut size={16} /> Guardar y salir
        </button>
        <button onClick={onEliminar} className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm flex items-center gap-1 ml-auto">
          <Trash2 size={16} /> Eliminar paciente
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   POS
   ============================================================ */
function POSView({ pacientes, setPacientes, inventario, ventas, setVentas, presetPacienteId, clearPreset, config }) {
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [busquedaArt, setBusquedaArt] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [vendedor, setVendedor] = useState("");
  const [formaPago, setFormaPago] = useState("efectivo");
  const [abono, setAbono] = useState(0);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (presetPacienteId) {
      const p = pacientes.find((x) => x.id === presetPacienteId);
      if (p) setClienteSel(p);
      clearPreset();
    }
  }, [presetPacienteId]);

  const todosArticulos = Object.entries(inventario).flatMap(([cat, arr]) =>
    arr.map((a) => ({ ...a, categoria: cat }))
  );
  const articulosFiltrados = busquedaArt
    ? todosArticulos.filter((a) => a.nombre.toLowerCase().includes(busquedaArt.toLowerCase()))
    : todosArticulos;

  const resultadosCliente = busquedaCliente
    ? pacientes.filter((p) => p.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
    : [];

  function agregarArticulo(a) {
    setCarrito([...carrito, { ...a, cantidad: 1, uidLinea: uid() }]);
  }
  function quitarArticulo(uidLinea) {
    setCarrito(carrito.filter((c) => c.uidLinea !== uidLinea));
  }
  const total = carrito.reduce((s, c) => s + Number(c.precio || 0) * c.cantidad, 0);
  const saldo = total - Number(abono || 0);

  function generarNota(estatus) {
    const folio = (ventas[ventas.length - 1]?.folio || 0) + 1;
    const ahora = new Date().toISOString();
    const montoAbono = Number(abono || 0);
    const pagoInicial =
      estatus === "venta" && montoAbono > 0
        ? [{ fecha: ahora, monto: montoAbono, formaPago, tipo: saldo <= 0 ? "venta_completa" : "anticipo" }]
        : [];
    const nota = {
      folio,
      fecha: ahora,
      pacienteId: clienteSel?.id || null,
      nombreCliente: clienteSel?.nombre || busquedaCliente,
      items: carrito,
      total,
      abono: montoAbono,
      saldo,
      estatus,
      formaPago,
      vendedor,
      pagos: pagoInicial,
    };
    setVentas([...ventas, nota]);
    if (clienteSel) {
      setPacientes(
        pacientes.map((p) =>
          p.id === clienteSel.id ? { ...p, compras: [...(p.compras || []), nota] } : p
        )
      );
    }
    setPreview(nota);
    setCarrito([]);
    setAbono(0);
  }

  return (
    <div className="p-4 grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-3">
        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
            <Users size={16} /> Cliente
          </h3>
          {clienteSel ? (
            <div className="text-sm bg-sky-50 rounded p-2 flex justify-between items-center">
              <span>{clienteSel.nombre}</span>
              <button onClick={() => setClienteSel(null)} className="text-red-400">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <input
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Buscar paciente..."
                className="w-full border rounded-lg px-2 py-1.5 text-sm mb-1"
              />
              <div className="max-h-32 overflow-y-auto">
                {resultadosCliente.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setClienteSel(p)}
                    className="block w-full text-left px-2 py-1.5 text-xs hover:bg-sky-50 rounded"
                  >
                    {p.nombre} — {p.telefono}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2">Vendedor</h3>
          <input
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            placeholder="Nombre de quien vende"
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
          />
        </div>

        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2">Pago</h3>
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta_credito">Tarjeta de crédito</option>
            <option value="tarjeta_debito">Tarjeta de débito</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <label className="text-xs text-slate-500">Abono ($ MXN)</label>
          <input
            type="number"
            value={abono}
            onChange={(e) => setAbono(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="col-span-2 space-y-3">
        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
            <Search size={16} /> Buscar artículo
          </h3>
          <input
            value={busquedaArt}
            onChange={(e) => setBusquedaArt(e.target.value)}
            placeholder="Nombre del artículo..."
            className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
          />
          <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
            {articulosFiltrados.map((a) => (
              <button
                key={a.sku}
                onClick={() => agregarArticulo(a)}
                className="text-left text-xs border rounded-lg px-2 py-1.5 hover:bg-sky-50 flex justify-between"
              >
                <span className="truncate">{a.nombre}</span>
                <span className="text-slate-500">${a.precio}</span>
              </button>
            ))}
            {articulosFiltrados.length === 0 && (
              <p className="text-xs text-slate-400 col-span-2">Sin artículos en inventario aún.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2">Nota de venta — folio #{(ventas[ventas.length - 1]?.folio || 0) + 1}</h3>
          <div className="max-h-40 overflow-y-auto">
            {carrito.map((c) => (
              <div key={c.uidLinea} className="flex justify-between items-center text-sm border-b py-1">
                <span>{c.nombre}</span>
                <span className="flex items-center gap-2">
                  ${c.precio}
                  <button onClick={() => quitarArticulo(c.uidLinea)} className="text-red-400">
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-semibold mt-2 text-sm">
            <span>Total</span>
            <span>${total.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Saldo</span>
            <span>${saldo.toFixed(2)} MXN</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => generarNota("presupuesto")}
              disabled={carrito.length === 0}
              className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-40"
            >
              Guardar presupuesto
            </button>
            <button
              onClick={() => generarNota("venta")}
              disabled={carrito.length === 0}
              className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
              style={{ background: SKY_DARK }}
            >
              Confirmar venta
            </button>
          </div>
        </div>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Nota de venta">
        {preview && (
          <div>
            <div id="nota-imprimible">
              <div className="flex items-center gap-3 mb-3">
                {config.logo && <img src={config.logo} style={{ height: 60 }} alt="logo" />}
                <div>
                  <p className="font-bold">Spektrum Ópticas</p>
                  <p className="text-xs">{config.direccion}</p>
                  <p className="text-xs">Tel: {config.telefono}</p>
                </div>
              </div>
              <p className="text-center font-bold text-sm mb-2">
                {preview.estatus === "presupuesto" ? "PRESUPUESTO" : "NOTA DE VENTA"}
              </p>
              <p className="text-sm">Folio: <b>{preview.folio}</b></p>
              <p className="text-sm">Cliente: {preview.nombreCliente}</p>
              <p className="text-sm">Fecha: {new Date(preview.fecha).toLocaleString("es-MX")}</p>
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="border-b"><th className="text-left">Artículo</th><th className="text-right">Precio</th></tr>
                </thead>
                <tbody>
                  {preview.items.map((it, i) => (
                    <tr key={i} className="border-b"><td>{it.nombre}</td><td className="text-right">${it.precio}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-bold mt-2">Total: ${preview.total.toFixed(2)} MXN</p>
              <p className="text-right text-sm">Abono: ${preview.abono.toFixed(2)} — Saldo: ${preview.saldo.toFixed(2)}</p>
            </div>
            <button
              onClick={() => imprimirElemento("nota-imprimible")}
              className="mt-4 w-full py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
              style={{ background: SKY_DARK }}
            >
              <Printer size={16} /> Imprimir {preview.estatus === "presupuesto" ? "presupuesto" : "nota de venta"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   INVENTARIO
   ============================================================ */
const CATEGORIAS_INV = [
  { key: "armazones", label: "Armazones" },
  { key: "lentesGraduados", label: "Lentes graduados" },
  { key: "lentesContacto", label: "Lentes de contacto" },
  { key: "lentesSolares", label: "Lentes solares" },
  { key: "accesorios", label: "Accesorios" },
];

function InventarioView({ inventario, setInventario }) {
  const [cat, setCat] = useState("armazones");
  const [nuevo, setNuevo] = useState({
    nombre: "",
    precio: "",
    existencias: "",
    tipo: "",
    material: "",
    tratamiento: "",
    tipoLinea: "",
    categoriaArmazon: "",
  });

  const lista = inventario[cat] || [];
  const conCaracteristicas = cat === "lentesGraduados" || cat === "lentesContacto";
  const esArmazon = cat === "armazones";
  const LINEAS_ARMAZON = ["Línea económica", "Línea estándar", "Línea premium"];
  const CATEGORIAS_ARMAZON = {
    Dama: ["Dama - Metal", "Dama - Pasta", "Dama - Combinado"],
    Caballero: ["Caballero - Metal", "Caballero - Pasta", "Caballero - Combinado"],
    Unisex: ["Unisex - Metal", "Unisex - Pasta", "Unisex - Combinado"],
    Junior: ["Junior - Metal", "Junior - Pasta", "Junior - Combinado"],
  };

  function siguienteSKU() {
    const prefijo = cat.slice(0, 3).toUpperCase();
    const n = lista.length + 1;
    return `${prefijo}-${n.toString().padStart(4, "0")}`;
  }

  function agregar() {
    if (esArmazon) {
      if (!nuevo.tipoLinea || !nuevo.categoriaArmazon) return;
    } else if (!nuevo.nombre) {
      return;
    }
    const nombreFinal = esArmazon ? `${nuevo.tipoLinea} · ${nuevo.categoriaArmazon}` : nuevo.nombre;
    const articulo = { ...nuevo, nombre: nombreFinal, sku: siguienteSKU(), id: uid() };
    setInventario({ ...inventario, [cat]: [...lista, articulo] });
    setNuevo({ nombre: "", precio: "", existencias: "", tipo: "", material: "", tratamiento: "", tipoLinea: "", categoriaArmazon: "" });
  }

  function eliminar(id) {
    setInventario({ ...inventario, [cat]: lista.filter((a) => a.id !== id) });
  }

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIAS_INV.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              cat === c.key ? "text-white" : "bg-white border text-slate-600"
            }`}
            style={cat === c.key ? { background: SKY_DARK } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-end">
        {esArmazon ? (
          <>
            <div>
              <label className="text-xs text-slate-500">Línea</label>
              <select
                value={nuevo.tipoLinea}
                onChange={(e) => setNuevo({ ...nuevo, tipoLinea: e.target.value })}
                className="block border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {LINEAS_ARMAZON.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Categoría</label>
              <select
                value={nuevo.categoriaArmazon}
                onChange={(e) => setNuevo({ ...nuevo, categoriaArmazon: e.target.value })}
                className="block border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {Object.entries(CATEGORIAS_ARMAZON).map(([grupo, opciones]) => (
                  <optgroup key={grupo} label={grupo}>
                    {opciones.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs text-slate-500">Nombre</label>
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              className="block border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500">Precio (MXN)</label>
          <input
            type="number"
            value={nuevo.precio}
            onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
            className="block border rounded-lg px-2 py-1.5 text-sm w-28"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Existencias</label>
          <input
            type="number"
            value={nuevo.existencias}
            onChange={(e) => setNuevo({ ...nuevo, existencias: e.target.value })}
            className="block border rounded-lg px-2 py-1.5 text-sm w-24"
          />
        </div>
        {conCaracteristicas && (
          <>
            <div>
              <label className="text-xs text-slate-500">Tipo</label>
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option>Monofocal</option>
                <option>Bifocal</option>
                <option>Progresivo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Material</label>
              <select value={nuevo.material} onChange={(e) => setNuevo({ ...nuevo, material: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option>CR39</option>
                <option>Policarbonato</option>
                <option>Hi Index</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Tratamiento</label>
              <select value={nuevo.tratamiento} onChange={(e) => setNuevo({ ...nuevo, tratamiento: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option>Antireflejante</option>
                <option>Antiblue</option>
                <option>Fotocromático</option>
              </select>
            </div>
          </>
        )}
        <button onClick={agregar} className="px-3 py-1.5 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Plus size={16} /> Agregar
        </button>
        <button onClick={() => imprimirElemento("inventario-imprimible")} className="ml-auto px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1">
          <Printer size={16} /> Imprimir inventario
        </button>
      </div>

      <div id="inventario-imprimible" className="bg-white border rounded-xl overflow-hidden">
        <p className="hidden print:block font-bold px-3 pt-3">Inventario — {CATEGORIAS_INV.find((c) => c.key === cat)?.label}</p>
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-right px-3 py-2">Precio</th>
              <th className="text-right px-3 py-2">Existencias</th>
              <th className="px-3 py-2 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 text-slate-500">{a.sku}</td>
                <td className="px-3 py-2">{a.nombre}</td>
                <td className="px-3 py-2 text-right">${a.precio}</td>
                <td className="px-3 py-2 text-right">{a.existencias}</td>
                <td className="px-3 py-2 text-right print:hidden">
                  <button onClick={() => eliminar(a.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  Sin artículos en esta categoría todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   PACIENTES (Compilación)
   ============================================================ */
function PacientesView({ pacientes, setPacientes, agenda, setAgenda }) {
  const [busqueda, setBusqueda] = useState("");
  const filtrados = busqueda
    ? pacientes.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : pacientes;

  function eliminarPaciente(id) {
    const restantes = pacientes.filter((p) => p.id !== id).map((p, i) => ({ ...p, folio: i + 1 }));
    setPacientes(restantes);
    setAgenda(agenda.filter((c) => c.pacienteId !== id));
  }

  return (
    <div className="p-4">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar paciente por nombre..."
        className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
      />
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Folio</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-right px-3 py-2"># Compras</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-3 py-2">{p.folio}</td>
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2">{p.telefono}</td>
                <td className="px-3 py-2 text-right">{(p.compras || []).length}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => eliminarPaciente(p.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  Sin pacientes registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   LABORATORIO
   ============================================================ */
function LaboratorioView({ laboratorio, setLaboratorio, pacientes }) {
  const [nueva, setNueva] = useState({ pacienteId: "", fechaEnvio: "", fechaPrometida: "", fechaRecepcion: "" });

  function agregar() {
    if (!nueva.pacienteId) return;
    setLaboratorio([...laboratorio, { ...nueva, id: uid() }]);
    setNueva({ pacienteId: "", fechaEnvio: "", fechaPrometida: "", fechaRecepcion: "" });
  }

  return (
    <div className="p-4">
      <div className="bg-white border rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-end">
        <select
          value={nueva.pacienteId}
          onChange={(e) => setNueva({ ...nueva, pacienteId: e.target.value })}
          className="border rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">Paciente...</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <div>
          <label className="text-xs text-slate-500">Envío a laboratorio</label>
          <input type="date" value={nueva.fechaEnvio} onChange={(e) => setNueva({ ...nueva, fechaEnvio: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Prometida al cliente</label>
          <input type="date" value={nueva.fechaPrometida} onChange={(e) => setNueva({ ...nueva, fechaPrometida: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Recepción de laboratorio</label>
          <input type="date" value={nueva.fechaRecepcion} onChange={(e) => setNueva({ ...nueva, fechaRecepcion: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <button onClick={agregar} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>
          Agregar orden
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Paciente</th>
              <th className="text-left px-3 py-2">Envío</th>
              <th className="text-left px-3 py-2">Prometida</th>
              <th className="text-left px-3 py-2">Recepción</th>
            </tr>
          </thead>
          <tbody>
            {laboratorio.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2">{pacientes.find((p) => p.id === o.pacienteId)?.nombre || "—"}</td>
                <td className="px-3 py-2">{o.fechaEnvio}</td>
                <td className="px-3 py-2">{o.fechaPrometida}</td>
                <td className="px-3 py-2">{o.fechaRecepcion || "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   REPORTES
   ============================================================ */
function ReportesView({ ventas, setVentas, inventario, setInventario, pacientes, laboratorio, pagosProveedores, setPagosProveedores }) {
  const [modo, setModo] = useState("corte");
  const canceladas = ventas.filter((v) => v.estatus === "cancelada" || v.estatus === "devolucion");

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setModo("corte")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "corte" ? "text-white" : "bg-white border"}`} style={modo === "corte" ? { background: SKY_DARK } : {}}>
          El corte diario
        </button>
        <button onClick={() => setModo("cancel")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "cancel" ? "text-white" : "bg-white border"}`} style={modo === "cancel" ? { background: SKY_DARK } : {}}>
          Cancelaciones y/o devoluciones
        </button>
      </div>

      {modo === "corte" ? (
        <CorteDiario
          ventas={ventas}
          setVentas={setVentas}
          pacientes={pacientes}
          pagosProveedores={pagosProveedores}
          setPagosProveedores={setPagosProveedores}
        />
      ) : (
        <CancelacionesTab
          ventas={ventas}
          setVentas={setVentas}
          inventario={inventario}
          setInventario={setInventario}
          pacientes={pacientes}
          laboratorio={laboratorio}
          canceladas={canceladas}
        />
      )}
    </div>
  );
}

function TotalBox({ titulo, monto, color, subtitulo }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{titulo}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>
        ${monto.toFixed(2)}
      </p>
      {subtitulo && <p className="text-xs text-slate-400 mt-1">{subtitulo}</p>}
    </div>
  );
}

function CorteDiario({ ventas, setVentas, pacientes, pagosProveedores, setPagosProveedores }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [cobrando, setCobrando] = useState(null); // folio de nota a cobrar saldo
  const [montoCobro, setMontoCobro] = useState("");
  const [formaPagoCobro, setFormaPagoCobro] = useState("efectivo");
  const [mostrarProveedor, setMostrarProveedor] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState({ proveedor: "", concepto: "", monto: "" });

  const esDelDia = (isoFecha) => isoFecha.slice(0, 10) === fecha;

  // Ventas (notas confirmadas) creadas ese día
  const ventasDelDia = ventas.filter((v) => v.estatus === "venta" && esDelDia(v.fecha));
  const totalVendido = ventasDelDia.reduce((s, v) => s + v.total, 0);

  // Pagos individuales de todas las notas, filtrados por fecha del pago
  const todosPagos = ventas.flatMap((v) => (v.pagos || []).map((p) => ({ ...p, folio: v.folio, cliente: v.nombreCliente })));
  const pagosDelDia = todosPagos.filter((p) => esDelDia(p.fecha));

  const anticipos = pagosDelDia.filter((p) => p.tipo === "anticipo");
  const liquidaciones = pagosDelDia.filter((p) => p.tipo === "liquidacion");
  const ventasCompletas = pagosDelDia.filter((p) => p.tipo === "venta_completa");

  const totalAnticipos = anticipos.reduce((s, p) => s + p.monto, 0);
  const totalLiquidaciones = liquidaciones.reduce((s, p) => s + p.monto, 0);
  const totalCobradoHoy = totalAnticipos + totalLiquidaciones + ventasCompletas.reduce((s, p) => s + p.monto, 0);

  // Saldo pendiente global (a la fecha de hoy, acumulado de todas las notas activas)
  const notasConSaldo = ventas.filter((v) => (v.estatus === "venta" || v.estatus === "devolucion") && v.saldo > 0);
  const totalSaldoPendiente = notasConSaldo.reduce((s, v) => s + v.saldo, 0);

  const pagosProvDelDia = pagosProveedores.filter((p) => esDelDia(p.fecha));
  const totalProveedores = pagosProvDelDia.reduce((s, p) => s + Number(p.monto || 0), 0);

  function cambiarDia(delta) {
    const d = new Date(fecha);
    d.setDate(d.getDate() + delta);
    setFecha(fechaISO(d));
  }

  function registrarCobro() {
    const monto = Number(montoCobro || 0);
    if (!cobrando || monto <= 0) return;
    setVentas(
      ventas.map((v) => {
        if (v.folio !== cobrando) return v;
        const nuevoAbono = v.abono + monto;
        const nuevoSaldo = Math.max(0, v.saldo - monto);
        const pago = { fecha: new Date().toISOString(), monto, formaPago: formaPagoCobro, tipo: "liquidacion" };
        return { ...v, abono: nuevoAbono, saldo: nuevoSaldo, pagos: [...(v.pagos || []), pago] };
      })
    );
    setCobrando(null);
    setMontoCobro("");
  }

  function registrarPagoProveedor() {
    if (!nuevoProveedor.proveedor || !nuevoProveedor.monto) return;
    setPagosProveedores([
      ...pagosProveedores,
      { id: uid(), fecha: new Date(fecha).toISOString(), ...nuevoProveedor, monto: Number(nuevoProveedor.monto) },
    ]);
    setNuevoProveedor({ proveedor: "", concepto: "", monto: "" });
    setMostrarProveedor(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Corte Diario</h2>
      <div className="flex items-center gap-2 mb-5 bg-white border rounded-xl px-3 py-2 w-fit">
        <button onClick={() => cambiarDia(-1)} className="p-1.5 rounded-lg hover:bg-sky-100">
          <ChevronLeft size={18} />
        </button>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border-none text-sm font-medium focus:outline-none" />
        <button onClick={() => cambiarDia(1)} className="p-1.5 rounded-lg hover:bg-sky-100">
          <ChevronRight size={18} />
        </button>
        {fecha !== fechaISO(new Date()) && (
          <button onClick={() => setFecha(fechaISO(new Date()))} className="text-xs text-sky-600 underline ml-1">
            Hoy
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <TotalBox titulo="Vendido del día" monto={totalVendido} color="#2563eb" subtitulo={`${ventasDelDia.length} nota(s)`} />
        <TotalBox titulo="Anticipos cobrados" monto={totalAnticipos} color="#0891b2" subtitulo={`${anticipos.length} pago(s)`} />
        <TotalBox titulo="Saldos cobrados al entregar" monto={totalLiquidaciones} color="#059669" subtitulo={`${liquidaciones.length} pago(s)`} />
        <TotalBox titulo="Total cobrado hoy" monto={totalCobradoHoy} color="#047857" subtitulo="Anticipos + liquidaciones + ventas de contado" />
        <TotalBox titulo="Saldo pendiente" monto={totalSaldoPendiente} color="#dc2626" subtitulo={`${notasConSaldo.length} nota(s) por cobrar`} />
        <TotalBox titulo="Pago a proveedores" monto={totalProveedores} color="#7c3aed" subtitulo={`${pagosProvDelDia.length} pago(s)`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose — Vendido del día</h4>
          <table className="w-full text-xs">
            <tbody>
              {ventasDelDia.map((v) => (
                <tr key={v.folio} className="border-t"><td className="py-1">#{v.folio} {v.nombreCliente}</td><td className="text-right py-1">${v.total.toFixed(2)}</td></tr>
              ))}
              {ventasDelDia.length === 0 && <tr><td className="text-slate-400 py-2">Sin ventas este día.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose — Anticipos cobrados</h4>
          <table className="w-full text-xs">
            <tbody>
              {anticipos.map((p, i) => (
                <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} ({p.formaPago})</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
              ))}
              {anticipos.length === 0 && <tr><td className="text-slate-400 py-2">Sin anticipos este día.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose — Saldos cobrados al entregar</h4>
          <table className="w-full text-xs">
            <tbody>
              {liquidaciones.map((p, i) => (
                <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} ({p.formaPago})</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
              ))}
              {liquidaciones.length === 0 && <tr><td className="text-slate-400 py-2">Sin liquidaciones este día.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose — Total cobrado hoy</h4>
          <table className="w-full text-xs">
            <tbody>
              {[...anticipos, ...liquidaciones, ...ventasCompletas].map((p, i) => (
                <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} — {p.tipo.replace("_", " ")}</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
              ))}
              {pagosDelDia.length === 0 && <tr><td className="text-slate-400 py-2">Sin cobros este día.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Desglose — Saldo pendiente</h4>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {notasConSaldo.map((v) => (
                <tr key={v.folio} className="border-t">
                  <td className="py-1">#{v.folio} {v.nombreCliente}</td>
                  <td className="text-right py-1">${v.saldo.toFixed(2)}</td>
                  <td className="text-right py-1">
                    <button onClick={() => { setCobrando(v.folio); setMontoCobro(v.saldo.toString()); }} className="text-xs text-emerald-600 underline">
                      Cobrar
                    </button>
                  </td>
                </tr>
              ))}
              {notasConSaldo.length === 0 && <tr><td className="text-slate-400 py-2">Sin saldos pendientes.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Desglose — Pago a proveedores</h4>
            <button onClick={() => setMostrarProveedor(!mostrarProveedor)} className="text-xs text-sky-600 underline">
              + Registrar pago
            </button>
          </div>
          {mostrarProveedor && (
            <div className="flex flex-wrap gap-1 mb-2 bg-slate-50 p-2 rounded-lg">
              <input placeholder="Proveedor" value={nuevoProveedor.proveedor} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, proveedor: e.target.value })} className="border rounded px-2 py-1 text-xs flex-1" />
              <input placeholder="Concepto" value={nuevoProveedor.concepto} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, concepto: e.target.value })} className="border rounded px-2 py-1 text-xs flex-1" />
              <input placeholder="Monto" type="number" value={nuevoProveedor.monto} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, monto: e.target.value })} className="border rounded px-2 py-1 text-xs w-20" />
              <button onClick={registrarPagoProveedor} className="px-2 py-1 rounded text-white text-xs" style={{ background: SKY_DARK }}>Guardar</button>
            </div>
          )}
          <table className="w-full text-xs">
            <tbody>
              {pagosProvDelDia.map((p) => (
                <tr key={p.id} className="border-t"><td className="py-1">{p.proveedor} — {p.concepto}</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
              ))}
              {pagosProvDelDia.length === 0 && <tr><td className="text-slate-400 py-2">Sin pagos a proveedores este día.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!cobrando} onClose={() => setCobrando(null)} title="Cobrar saldo pendiente">
        <div className="space-y-3">
          <Field label="Monto a cobrar" type="number" value={montoCobro} onChange={(e) => setMontoCobro(e.target.value)} />
          <label className="block">
            <span className="text-xs font-medium text-slate-500 uppercase">Forma de pago</span>
            <select value={formaPagoCobro} onChange={(e) => setFormaPagoCobro(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta_credito">Tarjeta de crédito</option>
              <option value="tarjeta_debito">Tarjeta de débito</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
          <button onClick={registrarCobro} className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ background: SKY_DARK }}>
            Confirmar cobro
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CancelacionesTab({ ventas, setVentas, inventario, setInventario, pacientes, laboratorio, canceladas }) {
  const [busqueda, setBusqueda] = useState("");
  const [folioSel, setFolioSel] = useState(null);
  const [marcados, setMarcados] = useState({}); // uidLinea -> true (a devolver)

  const activas = ventas.filter((v) => v.estatus === "venta" || v.estatus === "devolucion");
  const q = busqueda.trim().toLowerCase();
  const resultados = q
    ? activas.filter((v) => {
        const paciente = pacientes.find((p) => p.id === v.pacienteId);
        return (
          (v.nombreCliente || "").toLowerCase().includes(q) ||
          (paciente?.telefono || "").toLowerCase().includes(q) ||
          (paciente?.email || "").toLowerCase().includes(q) ||
          v.fecha.slice(0, 10).includes(q) ||
          v.items.some((it) => it.nombre.toLowerCase().includes(q))
        );
      })
    : activas;

  const nota = resultados.find((v) => v.folio === folioSel);
  const paciente = nota ? pacientes.find((p) => p.id === nota.pacienteId) : null;
  const ordenesLab = nota ? laboratorio.filter((o) => o.pacienteId === nota.pacienteId) : [];

  function reintegrarInventario(items) {
    let inv = { ...inventario };
    items.forEach((it) => {
      if (!it.categoria || !inv[it.categoria]) return;
      inv[it.categoria] = inv[it.categoria].map((art) =>
        art.sku === it.sku
          ? { ...art, existencias: Number(art.existencias || 0) + Number(it.cantidad || 1) }
          : art
      );
    });
    setInventario(inv);
  }

  function cancelarCompleta() {
    reintegrarInventario(nota.items);
    setVentas(
      ventas.map((v) => (v.folio === nota.folio ? { ...v, estatus: "cancelada", total: 0, saldo: 0 } : v))
    );
    setFolioSel(null);
    setMarcados({});
  }

  function devolucionParcial() {
    const itemsADevolver = nota.items.filter((it) => marcados[it.uidLinea]);
    if (itemsADevolver.length === 0) return;
    reintegrarInventario(itemsADevolver);
    const itemsRestantes = nota.items.filter((it) => !marcados[it.uidLinea]);
    const nuevoTotal = itemsRestantes.reduce((s, it) => s + Number(it.precio || 0), 0);
    const todoDevuelto = itemsRestantes.length === 0;
    setVentas(
      ventas.map((v) =>
        v.folio === nota.folio
          ? {
              ...v,
              items: itemsRestantes,
              total: nuevoTotal,
              saldo: Math.max(0, nuevoTotal - v.abono),
              estatus: todoDevuelto ? "cancelada" : "devolucion",
            }
          : v
      )
    );
    setFolioSel(null);
    setMarcados({});
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono, correo, fecha (AAAA-MM-DD) o artículo..."
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        />
        <div className="bg-white border rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ background: BEIGE }}>
              <tr>
                <th className="text-left px-2 py-1">Folio</th>
                <th className="text-left px-2 py-1">Cliente</th>
                <th className="text-right px-2 py-1">Total</th>
                <th className="text-left px-2 py-1">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((v) => (
                <tr
                  key={v.folio}
                  onClick={() => {
                    setFolioSel(v.folio);
                    setMarcados({});
                  }}
                  className={`border-t cursor-pointer hover:bg-sky-50 ${folioSel === v.folio ? "bg-sky-50" : ""}`}
                >
                  <td className="px-2 py-1">{v.folio}</td>
                  <td className="px-2 py-1">{v.nombreCliente}</td>
                  <td className="px-2 py-1 text-right">${v.total.toFixed(2)}</td>
                  <td className="px-2 py-1 capitalize">{v.estatus}</td>
                </tr>
              ))}
              {resultados.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-4">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 className="text-sm font-semibold mt-4 mb-1">Ya canceladas / con devolución</h4>
        <div className="bg-white border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {canceladas.map((v) => (
                <tr key={v.folio} className="border-t">
                  <td className="px-2 py-1">{v.folio}</td>
                  <td className="px-2 py-1">{v.nombreCliente}</td>
                  <td className="px-2 py-1 text-right">${v.total.toFixed(2)}</td>
                </tr>
              ))}
              {canceladas.length === 0 && (
                <tr><td className="text-center text-slate-400 py-3">Ninguna todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4">
        {!nota ? (
          <p className="text-sm text-slate-400">Selecciona una nota para ver el expediente de la visita.</p>
        ) : (
          <div>
            <h3 className="font-semibold mb-2">Expediente de la visita — Folio {nota.folio}</h3>
            <p className="text-sm">Cliente: {nota.nombreCliente}</p>
            {paciente && (
              <>
                <p className="text-sm">Teléfono: {paciente.telefono}</p>
                <p className="text-sm">Email: {paciente.email}</p>
              </>
            )}
            <p className="text-sm">Fecha de compra: {new Date(nota.fecha).toLocaleString("es-MX")}</p>
            <p className="text-sm">Monto pagado (abono): ${nota.abono.toFixed(2)}</p>
            <p className="text-sm">Forma de pago: {nota.formaPago}</p>
            {ordenesLab.map((o) => (
              <p key={o.id} className="text-sm">Envío a laboratorio: {o.fechaEnvio} — Prometida: {o.fechaPrometida} — Recepción: {o.fechaRecepcion || "pendiente"}</p>
            ))}

            <h4 className="text-sm font-semibold mt-3 mb-1">Artículos (marca los que se devuelven)</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {nota.items.map((it) => (
                <label key={it.uidLinea} className="flex items-center justify-between text-sm border-b py-1">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!marcados[it.uidLinea]}
                      onChange={(e) => setMarcados({ ...marcados, [it.uidLinea]: e.target.checked })}
                    />
                    {it.nombre}
                  </span>
                  <span>${it.precio}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={devolucionParcial}
                disabled={Object.values(marcados).every((v) => !v)}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium disabled:opacity-40"
              >
                Devolución parcial (marcados)
              </button>
              <button onClick={cancelarCompleta} className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium">
                Cancelar nota completa
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Los artículos devueltos se reintegran al inventario de inmediato y el monto se descuenta del corte del día.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   USUARIOS
   ============================================================ */
function UsuariosView({ usuarios, setUsuarios }) {
  const [nuevo, setNuevo] = useState({ nombre: "", password: "", rol: "VENDEDOR" });

  function agregar() {
    if (!nuevo.nombre) return;
    setUsuarios([...usuarios, { ...nuevo, id: uid() }]);
    setNuevo({ nombre: "", password: "", rol: "VENDEDOR" });
  }
  function eliminar(id) {
    setUsuarios(usuarios.filter((u) => u.id !== id));
  }

  return (
    <div className="p-4">
      <div className="bg-white border rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-end">
        <Field label="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Field label="Contraseña" type="password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />
        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Rol</span>
          <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })} className="mt-1 border rounded-lg px-2 py-2 text-sm block">
            <option>OPTOMETRISTA</option>
            <option>VENDEDOR</option>
            <option>LABORATORIO</option>
            <option>GERENTE</option>
          </select>
        </label>
        <button onClick={agregar} className="px-3 py-2 rounded-lg text-white text-sm h-fit" style={{ background: SKY_DARK }}>
          Agregar usuario
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr><th className="text-left px-3 py-2">Nombre</th><th className="text-left px-3 py-2">Rol</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.nombre}</td>
                <td className="px-3 py-2">{u.rol}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => eliminar(u.id)} className="text-red-400"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   IMPORTAR DATOS
   ============================================================ */
function ImportarView({ pacientes, setPacientes, inventario, setInventario }) {
  const [categoria, setCategoria] = useState("Pacientes");
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef(null);

  function procesarCSV(text) {
    const lineas = text.split(/\r?\n/).filter(Boolean);
    const headers = lineas[0].split(",").map((h) => h.trim().toLowerCase());
    return lineas.slice(1).map((linea) => {
      const valores = linea.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (valores[i] || "").trim()));
      return obj;
    });
  }

  function normalizarFilas(filas) {
    // homogeniza encabezados a minúsculas para que nombre/telefono/precio/etc. funcionen igual
    return filas.map((fila) => {
      const obj = {};
      Object.entries(fila).forEach(([k, v]) => {
        obj[String(k).trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
      });
      return obj;
    });
  }

  function manejarArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const esExcel = /\.(xlsx|xls)$/i.test(file.name);
    setProgreso(10);

    const procesarFilas = (filas) => {
      setProgreso(95);
      const filasNorm = normalizarFilas(filas);
      aplicarImportacion(filasNorm);
      setProgreso(100);
      setTimeout(() => setProgreso(null), 1200);
    };

    if (esExcel) {
      const reader = new FileReader();
      reader.onprogress = (ev) => {
        if (ev.lengthComputable) setProgreso(Math.round((ev.loaded / ev.total) * 80) + 10);
      };
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: "array" });
          const hoja = wb.Sheets[wb.SheetNames[0]];
          const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
          procesarFilas(filas);
        } catch (err) {
          setResultado({ tipo: categoria, cantidad: 0, error: "No se pudo leer el Excel: " + err.message });
          setProgreso(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onprogress = (ev) => {
        if (ev.lengthComputable) setProgreso(Math.round((ev.loaded / ev.total) * 80) + 10);
      };
      reader.onload = () => {
        const filas = procesarCSV(reader.result);
        procesarFilas(filas);
      };
      reader.readAsText(file);
    }
  }

  function aplicarImportacion(filas) {
    if (categoria === "Pacientes") {
      const nuevos = filas.map((f, i) => ({
        id: uid(),
        folio: pacientes.length + i + 1,
        nombre: f.nombre || f.name || "Sin nombre",
        telefono: f.telefono || f.phone || "",
        email: f.email || "",
        direccion: f.direccion || "",
        ciudad: f.ciudad || "",
        compras: [],
      }));
      setPacientes([...pacientes, ...nuevos]);
      setResultado({ tipo: "Pacientes", cantidad: nuevos.length });
    } else {
      const key = { Armazones: "armazones", "Lentes graduados": "lentesGraduados", "Lentes de contacto": "lentesContacto", "Lentes solares": "lentesSolares" }[categoria];
      const lista = inventario[key] || [];
      const nuevos = filas.map((f, i) => ({
        id: uid(),
        nombre: f.nombre || f.name || "Sin nombre",
        precio: f.precio || f.price || "0",
        existencias: f.existencias || f.stock || "0",
        sku: `${key.slice(0, 3).toUpperCase()}-${(lista.length + i + 1).toString().padStart(4, "0")}`,
      }));
      setInventario({ ...inventario, [key]: [...lista, ...nuevos] });
      setResultado({ tipo: categoria, cantidad: nuevos.length });
    }
  }

  return (
    <div className="p-4 max-w-xl">
      <div className="bg-white border rounded-xl p-4">
        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
            <option>Pacientes</option>
            <option>Armazones</option>
            <option>Lentes graduados</option>
            <option>Lentes de contacto</option>
            <option>Lentes solares</option>
          </select>
        </label>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={manejarArchivo} className="text-sm" />
        <p className="text-xs text-slate-400 mt-1">Acepta CSV o Excel (.xlsx/.xls) con encabezados (nombre, telefono, email... o nombre, precio, existencias...)</p>

        {progreso !== null && (
          <div className="mt-4">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 rounded-full transition-all" style={{ width: `${progreso}%`, background: SKY_DARK }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{progreso}%</p>
          </div>
        )}

        {resultado && !resultado.error && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            Se importaron {resultado.cantidad} registros a "{resultado.tipo}".
          </div>
        )}
        {resultado?.error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{resultado.error}</div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
function ConfigView({ config, setConfig, respaldoCompleto, restaurarRespaldo }) {
  const [local, setLocal] = useState(config);
  const fileRef = useRef(null);
  const [mensaje, setMensaje] = useState("");

  function subirLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLocal({ ...local, logo: reader.result });
    reader.readAsDataURL(file);
  }

  function manejarRestaurar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const datos = JSON.parse(reader.result);
        restaurarRespaldo(datos);
        setMensaje("Respaldo restaurado correctamente.");
      } catch (err) {
        setMensaje("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="p-4 max-w-lg space-y-4">
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase block mb-1">Logotipo</label>
          {local.logo && <img src={local.logo} alt="logo" style={{ height: 100 }} className="mb-2" />}
          <input type="file" accept="image/*" onChange={subirLogo} className="text-sm" />
        </div>
        <Field label="Dirección" value={local.direccion} onChange={(e) => setLocal({ ...local, direccion: e.target.value })} />
        <Field label="Teléfono" value={local.telefono} onChange={(e) => setLocal({ ...local, telefono: e.target.value })} />
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar configuración
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-semibold text-amber-800 mb-1">Respaldo manual (recomendado)</h3>
        <p className="text-xs text-amber-700 mb-3">
          Esto guarda TODA la información (pacientes, inventario, agenda, ventas, usuarios, laboratorio) en un
          archivo en tu dispositivo. No depende de la conexión con el almacenamiento en línea — funciona siempre.
          Descárgalo después de capturar información importante, y si algo no se guarda solo, puedes restaurarlo aquí.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportarRespaldo(respaldoCompleto)}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium"
          >
            Descargar respaldo ahora
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-medium"
          >
            Restaurar desde un archivo
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={manejarRestaurar} className="hidden" />
        </div>
        {mensaje && <p className="text-xs text-emerald-700 mt-2">{mensaje}</p>}
      </div>
    </div>
  );
}

/* ============================================================
   PORTAL DE PACIENTES (acceso público)
   ============================================================ */
function PortalPaciente({ pacientes, setPacientes, agenda, setAgenda, ventas, setVentas, inventario, config, onVolver }) {
  const [paso, setPaso] = useState("inicio"); // inicio | agendar | comprar | confirmacion
  const [datosCliente, setDatosCliente] = useState({ nombre: "", telefono: "", email: "" });
  const [mensajeFinal, setMensajeFinal] = useState("");

  function confirmar(mensaje) {
    setMensajeFinal(mensaje);
    setPaso("confirmacion");
  }

  return (
    <div className="min-h-screen" style={{ background: BEIGE }}>
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b">
        {config.logo && <img src={config.logo} alt="logo" style={{ height: 64 }} />}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Spektrum Ópticas — Portal de pacientes</h1>
          <p className="text-xs text-slate-500">{config.direccion} · Tel: {config.telefono}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {paso === "inicio" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setPaso("agendar")}
              className="bg-white border rounded-xl p-6 text-left hover:shadow-md transition-shadow"
            >
              <Calendar className="mb-2 text-sky-600" />
              <p className="font-semibold">Agendar una cita</p>
              <p className="text-sm text-slate-500">Elige fecha y hora disponible para tu examen de la vista.</p>
            </button>
            <button
              onClick={() => setPaso("comprar")}
              className="bg-white border rounded-xl p-6 text-left hover:shadow-md transition-shadow"
            >
              <ShoppingCart className="mb-2 text-sky-600" />
              <p className="font-semibold">Comprar en línea</p>
              <p className="text-sm text-slate-500">Armazones, lentes graduados, solares y de contacto.</p>
            </button>
          </div>
        )}

        {paso === "agendar" && (
          <PortalAgendar
            pacientes={pacientes}
            setPacientes={setPacientes}
            agenda={agenda}
            setAgenda={setAgenda}
            datosCliente={datosCliente}
            setDatosCliente={setDatosCliente}
            onListo={(fecha, hora, consultorio) =>
              confirmar(
                `Tu cita quedó agendada para el ${fecha} a las ${hora} (${consultorio}). Te enviamos la confirmación por correo/WhatsApp.`
              )
            }
            onVolver={() => setPaso("inicio")}
          />
        )}

        {paso === "comprar" && (
          <PortalComprar
            pacientes={pacientes}
            setPacientes={setPacientes}
            ventas={ventas}
            setVentas={setVentas}
            inventario={inventario}
            datosCliente={datosCliente}
            setDatosCliente={setDatosCliente}
            onNecesitaCita={() => setPaso("agendar")}
            onListo={(folio) =>
              confirmar(`Tu pedido quedó registrado con folio #${folio}. Te enviamos la confirmación y el presupuesto por correo/WhatsApp.`)
            }
            onVolver={() => setPaso("inicio")}
          />
        )}

        {paso === "confirmacion" && (
          <div className="bg-white border rounded-xl p-6 text-center">
            <p className="text-emerald-600 font-semibold mb-2">¡Listo!</p>
            <p className="text-sm text-slate-600">{mensajeFinal}</p>
            <button
              onClick={() => {
                setPaso("inicio");
                setDatosCliente({ nombre: "", telefono: "", email: "" });
              }}
              className="mt-4 px-4 py-2 rounded-lg text-white text-sm"
              style={{ background: SKY_DARK }}
            >
              Volver al inicio
            </button>
          </div>
        )}

        <button onClick={onVolver} className="mt-6 text-xs text-slate-400 underline">
          Acceso para trabajadores
        </button>
      </div>
    </div>
  );
}

function PortalAgendar({ pacientes, setPacientes, agenda, setAgenda, datosCliente, setDatosCliente, onListo, onVolver }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [consultorio, setConsultorio] = useState("Consultorio 1");
  const [hora, setHora] = useState("");

  const ocupadas = agenda.filter((c) => c.fecha === fecha && c.consultorio === consultorio).map((c) => c.hora);
  const disponibles = HORAS.filter((h) => !ocupadas.includes(h));

  function agendar() {
    if (!hora || !datosCliente.nombre) return;
    let paciente = pacientes.find(
      (p) => p.telefono && datosCliente.telefono && p.telefono === datosCliente.telefono
    );
    if (!paciente) {
      paciente = { id: uid(), folio: pacientes.length + 1, ...datosCliente, compras: [] };
      setPacientes([...pacientes, paciente]);
    }
    setAgenda([
      ...agenda,
      { id: uid(), fecha, hora, consultorio, pacienteId: paciente.id, nombre: paciente.nombre, estatus: "proxima", origen: "portal" },
    ]);
    onListo(fecha, hora, consultorio);
  }

  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="font-semibold mb-3">Agendar cita</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Nombre" value={datosCliente.nombre} onChange={(e) => setDatosCliente({ ...datosCliente, nombre: e.target.value })} />
        <Field label="Teléfono" value={datosCliente.telefono} onChange={(e) => setDatosCliente({ ...datosCliente, telefono: e.target.value })} />
        <Field label="Email" value={datosCliente.email} onChange={(e) => setDatosCliente({ ...datosCliente, email: e.target.value })} />
      </div>
      <div className="flex gap-2 mb-3">
        <select value={consultorio} onChange={(e) => { setConsultorio(e.target.value); setHora(""); }} className="border rounded-lg px-2 py-2 text-sm">
          <option>Consultorio 1</option>
          <option>Consultorio 2</option>
        </select>
        <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setHora(""); }} className="border rounded-lg px-2 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-4 gap-1 mb-4 max-h-40 overflow-y-auto">
        {disponibles.map((h) => (
          <button
            key={h}
            onClick={() => setHora(h)}
            className={`text-xs py-1.5 rounded ${hora === h ? "text-white" : "bg-slate-100"}`}
            style={hora === h ? { background: SKY_DARK } : {}}
          >
            {h}
          </button>
        ))}
        {disponibles.length === 0 && <p className="text-xs text-slate-400 col-span-4">Sin horarios libres ese día.</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={onVolver} className="flex-1 py-2 rounded-lg bg-slate-100 text-sm">Volver</button>
        <button
          onClick={agendar}
          disabled={!hora || !datosCliente.nombre}
          className="flex-1 py-2 rounded-lg text-white text-sm disabled:opacity-40"
          style={{ background: SKY_DARK }}
        >
          Confirmar cita
        </button>
      </div>
    </div>
  );
}

function PortalComprar({ pacientes, setPacientes, ventas, setVentas, inventario, datosCliente, setDatosCliente, onNecesitaCita, onListo, onVolver }) {
  const [cat, setCat] = useState("armazones");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [filtroTratamiento, setFiltroTratamiento] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [receta, setReceta] = useState(null); // {nombreArchivo, dataUrl}
  const fileRef = useRef(null);

  const lista = (inventario[cat] || []).filter(
    (a) =>
      (!filtroTipo || a.tipo === filtroTipo) &&
      (!filtroMaterial || a.material === filtroMaterial) &&
      (!filtroTratamiento || a.tratamiento === filtroTratamiento)
  );

  const requiereReceta = cat === "lentesGraduados" || cat === "lentesContacto";
  const total = carrito.reduce((s, c) => s + Number(c.precio || 0), 0);

  function agregar(a) {
    setCarrito([...carrito, { ...a, categoria: cat, uidLinea: uid() }]);
  }

  function subirReceta(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceta({ nombreArchivo: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }

  const faltaReceta = requiereReceta && !receta && carrito.some((c) => c.categoria === "lentesGraduados" || c.categoria === "lentesContacto");

  function finalizar() {
    if (!datosCliente.nombre || carrito.length === 0) return;
    let paciente = pacientes.find((p) => p.telefono && datosCliente.telefono && p.telefono === datosCliente.telefono);
    if (!paciente) {
      paciente = { id: uid(), folio: pacientes.length + 1, ...datosCliente, compras: [] };
      setPacientes([...pacientes, paciente]);
    }
    const folio = (ventas[ventas.length - 1]?.folio || 0) + 1;
    const nota = {
      folio,
      fecha: new Date().toISOString(),
      pacienteId: paciente.id,
      nombreCliente: paciente.nombre,
      items: carrito,
      total,
      abono: 0,
      saldo: total,
      estatus: "presupuesto",
      formaPago: "pendiente",
      vendedor: "Portal en línea",
      origen: "portal",
      recetaArchivo: receta,
    };
    setVentas([...ventas, nota]);
    onListo(folio);
  }

  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="font-semibold mb-3">Comprar en línea</h3>
      <div className="flex gap-2 flex-wrap mb-3">
        {CATEGORIAS_INV.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCat(c.key); setFiltroTipo(""); setFiltroMaterial(""); setFiltroTratamiento(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cat === c.key ? "text-white" : "bg-slate-100"}`}
            style={cat === c.key ? { background: SKY_DARK } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>

      {(cat === "lentesGraduados" || cat === "lentesContacto") && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs">
            <option value="">Tipo (todos)</option>
            <option>Monofocal</option><option>Bifocal</option><option>Progresivo</option>
          </select>
          <select value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs">
            <option value="">Material (todos)</option>
            <option>CR39</option><option>Policarbonato</option><option>Hi Index</option>
          </select>
          <select value={filtroTratamiento} onChange={(e) => setFiltroTratamiento(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs">
            <option value="">Tratamiento (todos)</option>
            <option>Antireflejante</option><option>Antiblue</option><option>Fotocromático</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-4">
        {lista.map((a) => (
          <button key={a.sku} onClick={() => agregar(a)} className="text-left text-xs border rounded-lg px-2 py-2 hover:bg-sky-50">
            <p className="font-medium">{a.nombre}</p>
            <p className="text-slate-500">${a.precio} MXN</p>
          </button>
        ))}
        {lista.length === 0 && <p className="text-xs text-slate-400 col-span-2">Sin artículos disponibles con esos filtros.</p>}
      </div>

      <div className="border-t pt-3 mb-3">
        <h4 className="text-sm font-semibold mb-1">Cesta / presupuesto</h4>
        {carrito.map((c) => (
          <div key={c.uidLinea} className="flex justify-between text-sm border-b py-1">
            <span>{c.nombre}</span>
            <span className="flex items-center gap-2">
              ${c.precio}
              <button onClick={() => setCarrito(carrito.filter((x) => x.uidLinea !== c.uidLinea))} className="text-red-400">
                <X size={14} />
              </button>
            </span>
          </div>
        ))}
        {carrito.length === 0 && <p className="text-xs text-slate-400">Tu cesta está vacía.</p>}
        <p className="text-right font-semibold text-sm mt-1">Total: ${total.toFixed(2)} MXN</p>
      </div>

      {requiereReceta && (
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">Sube tu receta (foto o PDF)</label>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={subirReceta} className="text-xs" />
          {receta && <p className="text-xs text-emerald-600 mt-1">Receta cargada: {receta.nombreArchivo}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Nombre" value={datosCliente.nombre} onChange={(e) => setDatosCliente({ ...datosCliente, nombre: e.target.value })} />
        <Field label="Teléfono" value={datosCliente.telefono} onChange={(e) => setDatosCliente({ ...datosCliente, telefono: e.target.value })} />
        <Field label="Email" value={datosCliente.email} onChange={(e) => setDatosCliente({ ...datosCliente, email: e.target.value })} />
      </div>

      {faltaReceta ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-3">
          Necesitas subir tu receta para comprar lentes graduados o de contacto en línea. Si no la tienes a la mano, puedes agendar una cita para atenderte en tienda.
        </div>
      ) : null}

      <div className="flex gap-2">
        <button onClick={onVolver} className="flex-1 py-2 rounded-lg bg-slate-100 text-sm">Volver</button>
        {faltaReceta ? (
          <button onClick={onNecesitaCita} className="flex-1 py-2 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>
            Agendar cita en tienda
          </button>
        ) : (
          <button
            onClick={finalizar}
            disabled={carrito.length === 0 || !datosCliente.nombre}
            className="flex-1 py-2 rounded-lg text-white text-sm disabled:opacity-40"
            style={{ background: SKY_DARK }}
          >
            Confirmar pedido
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [pacientes, setPacientes, loadedP, statusP, errorP, retryP, cargarP] = useStoredState(STORAGE_KEYS.pacientes, []);
  const [inventario, setInventario, loadedI, statusI, errorI, retryI, cargarI] = useStoredState(STORAGE_KEYS.inventario, emptyInventario());
  const [agenda, setAgenda, loadedA, statusA, errorA, retryA, cargarA] = useStoredState(STORAGE_KEYS.agenda, []);
  const [ventas, setVentas, loadedV, statusV, errorV, retryV, cargarV] = useStoredState(STORAGE_KEYS.ventas, []);
  const [usuarios, setUsuarios, loadedU, statusU, errorU, retryU, cargarU] = useStoredState(STORAGE_KEYS.usuarios, []);
  const [config, setConfig, loadedC, statusC, errorC, retryC, cargarC] = useStoredState(STORAGE_KEYS.config, emptyConfig());
  const [laboratorio, setLaboratorio, loadedL, statusL, errorL, retryL, cargarL] = useStoredState(STORAGE_KEYS.laboratorio, []);
  const [pagosProveedores, setPagosProveedores, loadedPP, statusPP, errorPP, retryPP, cargarPP] = useStoredState(STORAGE_KEYS.pagosProveedores, []);

  function recargarTodo() {
    cargarP(); cargarI(); cargarA(); cargarV(); cargarU(); cargarC(); cargarL(); cargarPP();
  }

  const secciones = [
    { nombre: "Pacientes", status: statusP, error: errorP, retry: retryP },
    { nombre: "Inventario", status: statusI, error: errorI, retry: retryI },
    { nombre: "Agenda", status: statusA, error: errorA, retry: retryA },
    { nombre: "Ventas", status: statusV, error: errorV, retry: retryV },
    { nombre: "Usuarios", status: statusU, error: errorU, retry: retryU },
    { nombre: "Configuración", status: statusC, error: errorC, retry: retryC },
    { nombre: "Laboratorio", status: statusL, error: errorL, retry: retryL },
    { nombre: "Pagos a proveedores", status: statusPP, error: errorPP, retry: retryPP },
  ];
  const seccionesConError = secciones.filter((s) => s.status === "error");
  const guardandoAlgo = secciones.some((s) => s.status === "saving");

  const [seccion, setSeccion] = useState("agenda");
  const [presetPacienteId, setPresetPacienteId] = useState(null);
  const [vista, setVista] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("portal") === "1" ? "portal" : "staff";
    } catch {
      return "staff";
    }
  });
  const [sesion, setSesion] = useSesion();

  const todoListo = loadedP && loadedI && loadedA && loadedV && loadedU && loadedC && loadedL && loadedPP;

  if (!todoListo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Cargando plataforma…</p>
      </div>
    );
  }

  const bannerGuardado = seccionesConError.length > 0 && (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex flex-wrap items-center gap-2">
      <span>
        ⚠ No se pudo guardar: <b>{seccionesConError.map((s) => s.nombre).join(", ")}</b>. Tus últimos cambios en{" "}
        {seccionesConError.length > 1 ? "esas secciones" : "esa sección"} podrían no haberse guardado.
      </span>
      <button
        onClick={() => seccionesConError.forEach((s) => s.retry())}
        className="px-2 py-1 rounded bg-red-600 text-white text-xs"
      >
        Reintentar guardar ahora
      </button>
      <button
        onClick={() =>
          exportarRespaldo({ pacientes, inventario, agenda, ventas, usuarios, config, laboratorio, pagosProveedores })
        }
        className="px-2 py-1 rounded bg-white border border-red-300 text-red-700 text-xs"
      >
        Descargar respaldo ahora (no pierdas tu trabajo)
      </button>
    </div>
  );

  if (vista === "portal") {
    return (
      <div>
        {bannerGuardado}
        <PortalPaciente
          pacientes={pacientes}
          setPacientes={setPacientes}
          agenda={agenda}
          setAgenda={setAgenda}
          ventas={ventas}
          setVentas={setVentas}
          inventario={inventario}
          config={config}
          onVolver={() => setVista("staff")}
        />
      </div>
    );
  }

  if (!sesion) {
    return <LoginScreen usuarios={usuarios} setUsuarios={setUsuarios} onIngresar={setSesion} config={config} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <GlobalPrintStyles />
      {bannerGuardado}
      {guardandoAlgo && !bannerGuardado && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-1 text-xs text-sky-600">Guardando cambios…</div>
      )}
      <div className="flex items-center justify-between bg-white border-b px-6 pt-2">
        <div className="flex-1">
          <Header config={config} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {sesion.nombre} · {sesion.rol}
          </span>
          <button
            onClick={recargarTodo}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600"
            title="Trae los cambios hechos desde otro equipo o celular"
          >
            ↻ Actualizar
          </button>
          <button
            onClick={() => setVista("portal")}
            className="text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: SKY_DARK }}
          >
            Ver portal de pacientes
          </button>
          <button onClick={() => setSesion(null)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
            Cerrar sesión
          </button>
        </div>
      </div>
      <Ribbon current={seccion} onSelect={setSeccion} />
      <div>
        {seccion === "agenda" && (
          <AgendaView
            agenda={agenda}
            setAgenda={setAgenda}
            pacientes={pacientes}
            setPacientes={setPacientes}
            goToPOS={(id) => {
              setPresetPacienteId(id);
              setSeccion("pos");
            }}
          />
        )}
        {seccion === "pos" && (
          <POSView
            pacientes={pacientes}
            setPacientes={setPacientes}
            inventario={inventario}
            ventas={ventas}
            setVentas={setVentas}
            presetPacienteId={presetPacienteId}
            clearPreset={() => setPresetPacienteId(null)}
            config={config}
          />
        )}
        {seccion === "inventario" && <InventarioView inventario={inventario} setInventario={setInventario} />}
        {seccion === "pacientes" && (
          <PacientesView pacientes={pacientes} setPacientes={setPacientes} agenda={agenda} setAgenda={setAgenda} />
        )}
        {seccion === "laboratorio" && (
          <LaboratorioView laboratorio={laboratorio} setLaboratorio={setLaboratorio} pacientes={pacientes} />
        )}
        {seccion === "reportes" && (
          <ReportesView
            ventas={ventas}
            setVentas={setVentas}
            inventario={inventario}
            setInventario={setInventario}
            pacientes={pacientes}
            laboratorio={laboratorio}
            pagosProveedores={pagosProveedores}
            setPagosProveedores={setPagosProveedores}
          />
        )}
        {seccion === "usuarios" && <UsuariosView usuarios={usuarios} setUsuarios={setUsuarios} />}
        {seccion === "importar" && (
          <ImportarView pacientes={pacientes} setPacientes={setPacientes} inventario={inventario} setInventario={setInventario} />
        )}
        {seccion === "config" && (
          <ConfigView
            config={config}
            setConfig={setConfig}
            respaldoCompleto={{ pacientes, inventario, agenda, ventas, usuarios, config, laboratorio, pagosProveedores }}
            restaurarRespaldo={(datos) => {
              if (datos.pacientes) setPacientes(datos.pacientes);
              if (datos.inventario) setInventario(datos.inventario);
              if (datos.agenda) setAgenda(datos.agenda);
              if (datos.ventas) setVentas(datos.ventas);
              if (datos.usuarios) setUsuarios(datos.usuarios);
              if (datos.config) setConfig(datos.config);
              if (datos.laboratorio) setLaboratorio(datos.laboratorio);
              if (datos.pagosProveedores) setPagosProveedores(datos.pagosProveedores);
            }}
          />
        )}
      </div>
    </div>
  );
}
