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
  dashboard: "dashboard",
  proveedores: "proveedores",
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
  mail: "optispektrum@hotmail.com",
  imagenPrincipal: "",
  redesSociales: { facebook: "", x: "", instagram: "", tiktok: "" },
  contenidoPaginas: {},
  suscriptores: [],
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

const NOMBRE_OPTICA = "Spektrum Ópticas";

const AVISO_PRIVACIDAD_DEFAULT = `AVISO DE PRIVACIDAD — ${NOMBRE_OPTICA}

En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, ${NOMBRE_OPTICA} es responsable del uso y protección de tus datos personales.

1. Datos que recabamos: nombre, teléfono, correo electrónico, domicilio, y datos de salud visual (receta óptica) necesarios para brindarte el servicio de examen de la vista y venta de armazones, lentes graduados, de contacto y solares.

2. Finalidades: agendar tus citas, elaborar tu receta y tus lentes, procesar tus compras y pagos, dar seguimiento a garantías y devoluciones, y enviarte avisos relacionados con tu pedido por correo electrónico o WhatsApp.

3. Datos sensibles: tu receta óptica se considera un dato de salud. Solo se usa para la elaboración de tus lentes y no se comparte con terceros ajenos al proceso de laboratorio óptico.

4. Transferencia de datos: no vendemos ni compartimos tus datos con terceros para fines distintos a los aquí señalados, salvo requerimiento de autoridad competente.

5. Derechos ARCO: puedes solicitar en cualquier momento el Acceso, Rectificación, Cancelación u Oposición al uso de tus datos personales escribiendo a optispektrum@hotmail.com o llamando al teléfono de contacto de la óptica.

6. Cambios al aviso: cualquier modificación a este aviso de privacidad se publicará en esta misma página.

Última actualización: 2026.`;

function mensajeCitaConfirmada(nombre, fecha, hora, consultorio, urlSitio) {
  return {
    email: {
      asunto: `Tu cita en ${NOMBRE_OPTICA} quedó confirmada`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `Tu cita para examen de la vista quedó agendada:\n📅 Fecha: ${fecha}\n⏰ Hora: ${hora}\n📍 ${consultorio}\n\n` +
        `Puedes ver o modificar tu cuenta aquí: ${urlSitio}\n\n` +
        `Te esperamos.\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Hola, ${nombre}! 👋 Tu cita en ${NOMBRE_OPTICA} quedó confirmada para el ${fecha} a las ${hora} (${consultorio}). ` +
      `Consulta o administra tu cuenta aquí: ${urlSitio} ¡Te esperamos! 🤓`,
  };
}

function mensajeAgradecimiento(nombre) {
  return {
    email: {
      asunto: `¡Gracias por confiar tu visión en nosotros, ${nombre}! 🤓`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `Queremos agradecerte sinceramente por elegirnos para el cuidado de tus ojos y por tu reciente compra de lentes. Nos entusiasma mucho ayudarte a ver el mundo con total claridad.\n\n` +
        `Nuestro equipo ya está trabajando en tu orden con los más altos estándares de calidad. En un próximo mensaje te avisaremos en cuanto tus lentes estén listos para entrega.\n\n` +
        `Si tienes alguna duda con tu pedido, responde a este correo o escríbenos por WhatsApp.\n\n` +
        `Atentamente,\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Hola, ${nombre}! 👋 Gracias por tu compra en ${NOMBRE_OPTICA}. Nos hace muy felices cuidar de tu salud visual y saber que pronto estrenarás lentes. 🤓 ` +
      `Nuestro laboratorio ya está trabajando en ellos. Te avisaremos por aquí mismo en cuanto estén listos. ¡Que tengas un excelente día! ✨`,
  };
}

function mensajeListos(nombre, direccion, horario) {
  return {
    email: {
      asunto: `¡Buenas noticias, ${nombre}! Tus lentes ya están listos 🥳`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `Te informamos que tus nuevos lentes han pasado todas nuestras pruebas de calidad y ¡ya están listos para ti!\n\n` +
        `Puedes pasar por ellos a nuestra sucursal en el siguiente horario:\n📍 Dirección: ${direccion || "—"}\n⏰ Horario: ${horario || "nuestro horario de atención"}\n\n` +
        `Nota: Recuerda que al entregártelos realizaremos un ajuste personalizado para que te queden perfectos y cómodos.\n\n` +
        `¡Te esperamos pronto!\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Hola, ${nombre}! 🎉 ¡Buenas noticias! Tus lentes ya están listos en ${NOMBRE_OPTICA}. ` +
      `Puedes pasar por ellos a nuestra sucursal ubicada en ${direccion || "nuestra dirección"} de ${horario || "nuestro horario de atención"}. ` +
      `Te sugerimos traer unos minutos disponibles para ajustarlos perfectamente a tu rostro. ¡Te esperamos! 🤓✨`,
  };
}

function abrirWhatsApp(telefono, mensaje) {
  const numero = (telefono || "").replace(/\D/g, "");
  const url = `https://wa.me/${numero ? "52" + numero : ""}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}

function abrirEmail(destinatario, asunto, cuerpo) {
  const url = `mailto:${destinatario || ""}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  window.open(url, "_blank");
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
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body * { visibility: hidden !important; }
        .print-only, .print-only * { visibility: visible !important; }
        .plantilla-oculta { position: static !important; left: 0 !important; top: 0 !important; }
        .print-only {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 24px !important;
        }
        .print-only * {
          overflow: visible !important;
          max-height: none !important;
          white-space: normal !important;
        }
        .print-only .flex {
          flex-wrap: wrap !important;
        }
        .print-only table {
          width: 100% !important;
          table-layout: auto !important;
        }
        .dashboard-print-compact table {
          font-size: 8px !important;
        }
        .dashboard-print-compact th,
        .dashboard-print-compact td {
          padding: 2px 3px !important;
        }
        .dashboard-print-compact input {
          border: none !important;
          font-size: 8px !important;
          padding: 0 !important;
          width: auto !important;
        }
        @page {
          size: auto;
          margin: 12mm;
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
    { id: "importar", label: "Importar datos", icon: "upload" },
    { id: "dashboard", label: "Dashboard", icon: "report" },
    { id: "administracion", label: "Administración", icon: "usercog" },
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
        {paciente ? (
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
        ) : (
          <p className="text-sm text-slate-400">
            No se encontró el expediente de este paciente (puede que haya sido eliminado). Cierra esta ventana e
            inténtalo de nuevo.
          </p>
        )}
      </Modal>
    </div>
  );
}

function CitaBlock({ cita, onDragStart, onClickNombre, onEliminar, onEstatus, dark }) {
  return (
    <div
      style={{ background: dark ? BEIGE_DARK : "white" }}
      className="flex-1 flex items-center gap-2 rounded px-2 py-1 text-xs shadow-sm"
    >
      <span draggable onDragStart={onDragStart} title="Arrastrar para mover" className="cursor-move text-slate-400 shrink-0 select-none">
        ⠿
      </span>
      <span
        title={ESTATUS_LABEL[cita.estatus]}
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: ESTATUS_COLORS[cita.estatus] || "#94a3b8" }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickNombre();
        }}
        className="text-sky-700 font-medium hover:underline truncate flex-1 text-left"
      >
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
    const visita = {
      id: uid(),
      fecha: new Date().toISOString(),
      od: {
        esf: receta.OD.ESF, cil: receta.OD.CIL, eje: receta.OD.EJE,
        di: receta.OD.DNP, add: receta.OD.ADD, obs: [receta.OD.ACO, receta.OD.PRISMA, receta.OD.BASE].filter(Boolean).join(" "),
      },
      os: {
        esf: receta.OI.ESF, cil: receta.OI.CIL, eje: receta.OI.EJE,
        di: receta.OI.DNP, add: receta.OI.ADD, obs: [receta.OI.ACO, receta.OI.PRISMA, receta.OI.BASE].filter(Boolean).join(" "),
      },
      descripcion: lenteRec,
      origen: "agenda",
    };
    actualizado.compras = [...(datos.compras || []), visita];
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
      <div className="plantilla-oculta" style={{ position: "absolute", left: -9999, top: 0 }}>
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
function POSView({ pacientes, setPacientes, inventario, ventas, setVentas, presetPacienteId, clearPreset, config, laboratorio, setLaboratorio }) {
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [busquedaArt, setBusquedaArt] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [vendedor, setVendedor] = useState("");
  const [optometrista, setOptometrista] = useState("");
  const [descuentoTipo, setDescuentoTipo] = useState("porcentaje");
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [formaPago, setFormaPago] = useState("efectivo");
  const [abono, setAbono] = useState(0);
  const [preview, setPreview] = useState(null);
  const [modoFechaPasada, setModoFechaPasada] = useState(false);
  const [fechaVentaManual, setFechaVentaManual] = useState(fechaISO(new Date()));

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

  const pedidosPortal = ventas.filter((v) => v.origen === "portal" && v.estatus === "presupuesto");

  function cargarPedidoPortal(pedido) {
    const p = pacientes.find((x) => x.id === pedido.pacienteId);
    if (p) setClienteSel(p);
    setCarrito(pedido.items.map((it) => ({ ...it, uidLinea: uid() })));
    setVentas(ventas.map((v) => (v.folio === pedido.folio ? { ...v, estatus: "convertido" } : v)));
    window.scrollTo(0, 0);
  }

  function agregarArticulo(a) {
    setCarrito([...carrito, { ...a, cantidad: 1, uidLinea: uid() }]);
  }
  function quitarArticulo(uidLinea) {
    setCarrito(carrito.filter((c) => c.uidLinea !== uidLinea));
  }
  const subtotal = carrito.reduce((s, c) => s + Number(c.precio || 0) * c.cantidad, 0);
  const montoDescuento =
    descuentoTipo === "porcentaje"
      ? subtotal * (Number(descuentoValor || 0) / 100)
      : Math.min(Number(descuentoValor || 0), subtotal);
  const total = Math.max(0, subtotal - montoDescuento);
  const saldo = total - Number(abono || 0);

  function generarNota(estatus) {
    const folio = (ventas[ventas.length - 1]?.folio || 0) + 1;
    const ahora = modoFechaPasada
      ? new Date(`${fechaVentaManual}T12:00:00`).toISOString()
      : new Date().toISOString();
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
      subtotal,
      descuentoTipo,
      descuentoValor: Number(descuentoValor || 0),
      montoDescuento,
      total,
      abono: montoAbono,
      saldo,
      estatus,
      formaPago,
      vendedor,
      optometrista,
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
    if (estatus === "venta") {
      const armazon = carrito.find((it) => it.categoria === "armazones");
      const material = carrito.find((it) => it.categoria === "lentesGraduados" || it.categoria === "lentesContacto");
      if (armazon || material) {
        const p = clienteSel;
        const historial = ordenarVisitasDesc(p?.compras || []);
        const hoyISO = fechaISO(new Date());
        const visitaHoy = historial.find((v) => v.origen === "agenda" && v.fecha && v.fecha.slice(0, 10) === hoyISO && (v.od || v.os));
        const visitaReceta = visitaHoy || historial.find((v) => v.od || v.os);
        const materialFinal = material?.nombre || visitaReceta?.materialReceta || "—";
        const fechaEnvioAuto = new Date(new Date(ahora).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        setLaboratorio([
          ...laboratorio,
          {
            id: uid(),
            pacienteId: clienteSel?.id || null,
            nombreCliente: nota.nombreCliente,
            folioVenta: folio,
            od: visitaReceta?.od || null,
            os: visitaReceta?.os || null,
            descripcion: visitaReceta?.descripcion || "",
            material: materialFinal,
            armazon: armazon?.nombre || "—",
            fechaVenta: ahora,
            fechaEnvio: fechaEnvioAuto,
            fechaPrometida: visitaReceta?.fechaPrometido || p?.fechaPrometido || "",
            fechaRecepcion: "",
            origen: "venta",
          },
        ]);
      }
      // Mensaje de agradecimiento automático (WhatsApp y/o correo, lo que esté disponible)
      const nombreParaMensaje = clienteSel?.nombre || nota.nombreCliente;
      const msj = mensajeAgradecimiento(nombreParaMensaje);
      if (clienteSel?.telefono) abrirWhatsApp(clienteSel.telefono, msj.whatsapp);
      if (clienteSel?.mail) abrirEmail(clienteSel.mail, msj.email.asunto, msj.email.cuerpo);
    }
    setPreview(nota);
    setCarrito([]);
    setAbono(0);
    setDescuentoTipo("porcentaje");
    setDescuentoValor(0);
    setModoFechaPasada(false);
    setFechaVentaManual(fechaISO(new Date()));
  }

  return (
    <div className="p-4">
      {pedidosPortal.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <h3 className="font-semibold text-amber-800 text-sm mb-2">
            📦 Pedidos nuevos de la tienda en línea ({pedidosPortal.length})
          </h3>
          <div className="space-y-2">
            {pedidosPortal.map((v) => (
              <div key={v.folio} className="bg-white rounded-lg border border-amber-200 p-2 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <p className="font-medium">{v.nombreCliente} — ${v.total.toFixed(2)} MXN</p>
                  <p className="text-xs text-slate-500">
                    {v.items.map((it) => it.nombre).join(", ")} · {new Date(v.fecha).toLocaleString("es-MX")}
                    {v.recetaArchivo && " · Con receta adjunta"}
                  </p>
                </div>
                <button
                  onClick={() => cargarPedidoPortal(v)}
                  className="text-xs px-3 py-1.5 rounded-lg text-white"
                  style={{ background: SKY_DARK }}
                >
                  Cargar en el POS para cobrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    <div className="grid grid-cols-3 gap-4">
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
            className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
          />
          <label className="text-xs text-slate-500">Optometrista que atendió (para el Dashboard)</label>
          <input
            value={optometrista}
            onChange={(e) => setOptometrista(e.target.value)}
            placeholder="Nombre del optometrista"
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
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="font-semibold text-sm">Nota de venta — folio #{(ventas[ventas.length - 1]?.folio || 0) + 1}</h3>
            <button
              onClick={() => setModoFechaPasada(!modoFechaPasada)}
              className={`text-xs px-2 py-1 rounded-lg ${modoFechaPasada ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {modoFechaPasada ? "✕ Cancelar fecha pasada" : "📅 Registrar venta de fecha pasada"}
            </button>
          </div>
          {modoFechaPasada && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 flex items-center gap-2">
              <label className="text-xs text-amber-700">Fecha real de la venta:</label>
              <input
                type="date"
                value={fechaVentaManual}
                max={fechaISO(new Date())}
                onChange={(e) => setFechaVentaManual(e.target.value)}
                className="border rounded px-2 py-1 text-xs"
              />
            </div>
          )}
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

          <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-lg p-2">
            <label className="text-xs text-slate-500">Descuento</label>
            <select value={descuentoTipo} onChange={(e) => setDescuentoTipo(e.target.value)} className="border rounded px-1 py-1 text-xs">
              <option value="porcentaje">%</option>
              <option value="monto">$ MXN</option>
            </select>
            <input
              type="number"
              value={descuentoValor}
              onChange={(e) => setDescuentoValor(e.target.value)}
              min="0"
              className="w-20 border rounded px-2 py-1 text-xs"
            />
            {montoDescuento > 0 && <span className="text-xs text-emerald-600">-${montoDescuento.toFixed(2)}</span>}
          </div>

          <div className="flex justify-between text-sm text-slate-500 mt-2">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between font-semibold mt-1 text-sm">
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
              {preview.montoDescuento > 0 && (
                <>
                  <p className="text-right text-sm mt-2">Subtotal: ${preview.subtotal.toFixed(2)} MXN</p>
                  <p className="text-right text-sm text-emerald-600">
                    Descuento ({preview.descuentoTipo === "porcentaje" ? `${preview.descuentoValor}%` : "monto fijo"}): -${preview.montoDescuento.toFixed(2)} MXN
                  </p>
                </>
              )}
              <p className="text-right font-bold mt-2">Total: ${preview.total.toFixed(2)} MXN</p>
              <p className="text-right text-sm">Abono: ${preview.abono.toFixed(2)} — Saldo: ${preview.saldo.toFixed(2)}</p>
            </div>
            {preview.estatus === "venta" && (
              <p className="text-xs text-slate-400 mt-2">
                El mensaje de agradecimiento se intentó abrir automáticamente por WhatsApp y/o correo. Si tu navegador
                bloqueó la ventana, usa los botones de abajo. Imprimir la nota es opcional.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {preview.estatus === "venta" && preview.pacienteId && (() => {
                const p = pacientes.find((x) => x.id === preview.pacienteId);
                const msj = mensajeAgradecimiento(preview.nombreCliente);
                return (
                  <>
                    {p?.telefono && (
                      <button
                        onClick={() => abrirWhatsApp(p.telefono, msj.whatsapp)}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm"
                      >
                        Reenviar por WhatsApp
                      </button>
                    )}
                    {p?.mail && (
                      <button
                        onClick={() => abrirEmail(p.mail, msj.email.asunto, msj.email.cuerpo)}
                        className="flex-1 py-2 rounded-lg bg-slate-600 text-white text-sm"
                      >
                        Reenviar por correo
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <button
              onClick={() => imprimirElemento("nota-imprimible")}
              className="mt-2 w-full py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
              style={{ background: SKY_DARK }}
            >
              <Printer size={16} /> Imprimir {preview.estatus === "presupuesto" ? "presupuesto" : "nota de venta"} (opcional)
            </button>
          </div>
        )}
      </Modal>
    </div>
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

const RANGOS_RX = {
  "Rango 1": "Desde ESF +/-0.00 hasta +/-3.00, CIL -0.25 hasta -2.00 D",
  "Rango 2": "Desde ESF +/-3.25 hasta +/-6.00, CIL -2.25 hasta -4.00 D",
  "Rango 3": "Desde ESF +/-6.25 hasta +/-25.00, CIL -0.25 hasta -4.25 hasta 7.00 D",
};
const RANGOS_POR_MATERIAL = {
  CR39: ["Rango 1"],
  Policarbonato: ["Rango 1", "Rango 2"],
  "Hi Index": ["Rango 2", "Rango 3"],
};

const LENTES_CONTACTO_DATA = {
  Mensual: [
    { marca: "Biofinity (CooperVision)", cosmetico: false },
    { marca: "Air Optix (Alcon)", cosmetico: false },
    { marca: "Acuvue Vita (Johnson & Johnson)", cosmetico: false },
    { marca: "Ultra (Bausch + Lomb)", cosmetico: false },
    { marca: "SofLens Esférico (Bausch + Lomb)", cosmetico: false },
    { marca: "PureVision 2 (Bausch + Lomb)", cosmetico: false },
    { marca: "Biomedics (CooperVision)", cosmetico: false },
    { marca: "Hidrosoft Monthly (Maxvue / Max Hydrosoft)", cosmetico: false },
    { marca: "SofLens StarColors II (Bausch + Lomb)", cosmetico: true },
    { marca: "Air Optix Colors (Alcon)", cosmetico: true },
    { marca: "Lunare Tricolor (Bausch + Lomb)", cosmetico: true },
    { marca: "FreshLook ColorBlends (Alcon)", cosmetico: true },
  ],
  Anual: [
    { marca: "Optima 38 (Bausch + Lomb)", cosmetico: false },
    { marca: "Contalux", cosmetico: false },
    { marca: "Hidrosoft UV Soft Esférico (Hidrosoft de México)", cosmetico: false },
    { marca: "Hidrosoft UV Soft Tórico (Hidrosoft de México)", cosmetico: false },
    { marca: "Lenticon One Year / GM Advance (Laboratorios Grin)", cosmetico: false },
    { marca: "Lenticon Ex Torica (Laboratorios Grin)", cosmetico: false },
    { marca: "Lenticon Pupila Negra (Laboratorios Grin)", cosmetico: false },
    { marca: "Meetone", cosmetico: true },
    { marca: "Freshgo", cosmetico: true },
    { marca: "Mill Creek", cosmetico: true },
  ],
};

function InventarioView({ inventario, setInventario }) {
  const [cat, setCat] = useState("armazones");
  const [nuevo, setNuevo] = useState({
    nombre: "",
    precio: "",
    existencias: "",
    tipo: "",
    material: "",
    tratamiento: "",
    rango: "",
    tipoLinea: "",
    categoriaArmazon: "",
    tipoReemplazo: "",
    marcaContacto: "",
    cosmetico: false,
    marcaSolar: "",
    modeloSolar: "",
    colorSolar: "",
    imagen: "",
  });

  const lista = inventario[cat] || [];
  const esArmazon = cat === "armazones";
  const esGraduado = cat === "lentesGraduados";
  const esContacto = cat === "lentesContacto";
  const esSolar = cat === "lentesSolares";
  const esAccesorio = cat === "accesorios";

  const LINEAS_ARMAZON = ["Armazón Línea Económica", "Armazón Línea Estándar", "Armazón Línea Premium"];
  const CATEGORIAS_ARMAZON = {
    Dama: ["Dama - Metal", "Dama - Pasta", "Dama - Combinado"],
    Caballero: ["Caballero - Metal", "Caballero - Pasta", "Caballero - Combinado"],
    Unisex: ["Unisex - Metal", "Unisex - Pasta", "Unisex - Combinado"],
    Junior: ["Junior - Metal", "Junior - Pasta", "Junior - Combinado"],
  };

  const rangosDisponibles = nuevo.material ? RANGOS_POR_MATERIAL[nuevo.material] || [] : [];
  const marcasDisponibles = nuevo.tipoReemplazo ? LENTES_CONTACTO_DATA[nuevo.tipoReemplazo] || [] : [];

  function siguienteSKU() {
    const prefijo = cat.slice(0, 3).toUpperCase();
    const n = lista.length + 1;
    return `${prefijo}-${n.toString().padStart(4, "0")}`;
  }

  function limpiarNuevo() {
    setNuevo({
      nombre: "", precio: "", existencias: "", tipo: "", material: "", tratamiento: "", rango: "",
      tipoLinea: "", categoriaArmazon: "", tipoReemplazo: "", marcaContacto: "", cosmetico: false,
      marcaSolar: "", modeloSolar: "", colorSolar: "", imagen: "",
    });
  }

  function subirImagenArticulo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNuevo((n) => ({ ...n, imagen: reader.result }));
    reader.readAsDataURL(file);
  }

  function agregar() {
    let nombreFinal = nuevo.nombre;
    let extra = {};
    if (esArmazon) {
      if (!nuevo.tipoLinea || !nuevo.categoriaArmazon) return;
      nombreFinal = `${nuevo.tipoLinea} · ${nuevo.categoriaArmazon}`;
    } else if (esGraduado) {
      if (!nuevo.material || !nuevo.tipo || !nuevo.tratamiento || !nuevo.rango) return;
      nombreFinal = `${nuevo.material} · ${nuevo.tipo} · ${nuevo.tratamiento} · ${nuevo.rango}`;
      extra = { rangoDescripcion: RANGOS_RX[nuevo.rango] };
    } else if (esContacto) {
      if (!nuevo.tipoReemplazo || !nuevo.marcaContacto) return;
      const info = marcasDisponibles.find((m) => m.marca === nuevo.marcaContacto);
      nombreFinal = nuevo.marcaContacto;
      extra = { cosmetico: !!info?.cosmetico };
    } else if (esSolar) {
      if (!nuevo.marcaSolar || !nuevo.modeloSolar || !nuevo.colorSolar) return;
      nombreFinal = `${nuevo.marcaSolar} · ${nuevo.modeloSolar} · ${nuevo.colorSolar}`;
    } else if (!nuevo.nombre) {
      return;
    }
    const articulo = { ...nuevo, ...extra, nombre: nombreFinal, sku: siguienteSKU(), id: uid() };
    setInventario({ ...inventario, [cat]: [...lista, articulo] });
    limpiarNuevo();
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
            onClick={() => { setCat(c.key); limpiarNuevo(); }}
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
        {esArmazon && (
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
        )}

        {esGraduado && (
          <>
            <div>
              <label className="text-xs text-slate-500">Material</label>
              <select
                value={nuevo.material}
                onChange={(e) => setNuevo({ ...nuevo, material: e.target.value, rango: "" })}
                className="block border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                <option>CR39</option>
                <option>Policarbonato</option>
                <option>Hi Index</option>
              </select>
            </div>
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
              <label className="text-xs text-slate-500">Tratamiento</label>
              <select value={nuevo.tratamiento} onChange={(e) => setNuevo({ ...nuevo, tratamiento: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option>Antireflejante</option>
                <option>Antiblue</option>
                <option>Fotocromático</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Rangos de Rx</label>
              <select
                value={nuevo.rango}
                onChange={(e) => setNuevo({ ...nuevo, rango: e.target.value })}
                disabled={!nuevo.material}
                className="block border rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:opacity-60"
                title={!nuevo.material ? "Elige primero el material" : ""}
              >
                <option value="">{nuevo.material ? "—" : "Elige material primero"}</option>
                {rangosDisponibles.map((r) => (
                  <option key={r} value={r}>{r} — {RANGOS_RX[r]}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {esContacto && (
          <>
            <div>
              <label className="text-xs text-slate-500">Tipo de reemplazo</label>
              <select
                value={nuevo.tipoReemplazo}
                onChange={(e) => setNuevo({ ...nuevo, tipoReemplazo: e.target.value, marcaContacto: "" })}
                className="block border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                <option>Mensual</option>
                <option>Anual</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Marca</label>
              <select
                value={nuevo.marcaContacto}
                onChange={(e) => setNuevo({ ...nuevo, marcaContacto: e.target.value })}
                disabled={!nuevo.tipoReemplazo}
                className="block border rounded-lg px-2 py-1.5 text-sm w-64 disabled:bg-slate-100 disabled:opacity-60"
              >
                <option value="">{nuevo.tipoReemplazo ? "—" : "Elige tipo de reemplazo primero"}</option>
                {marcasDisponibles.map((m) => (
                  <option key={m.marca} value={m.marca}>
                    {m.marca}{m.cosmetico ? " (Cosmético)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {esSolar && (
          <>
            <div>
              <label className="text-xs text-slate-500">Marca</label>
              <input value={nuevo.marcaSolar} onChange={(e) => setNuevo({ ...nuevo, marcaSolar: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Modelo</label>
              <input value={nuevo.modeloSolar} onChange={(e) => setNuevo({ ...nuevo, modeloSolar: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Color</label>
              <input value={nuevo.colorSolar} onChange={(e) => setNuevo({ ...nuevo, colorSolar: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
            </div>
          </>
        )}

        {esAccesorio && (
          <div>
            <label className="text-xs text-slate-500">Producto</label>
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
        <div>
          <label className="text-xs text-slate-500">Imagen (tienda en línea)</label>
          <div className="flex items-center gap-2">
            {nuevo.imagen ? (
              <img src={nuevo.imagen} alt="" className="w-10 h-10 rounded object-cover border" />
            ) : (
              <div className="w-10 h-10 rounded border border-dashed bg-slate-50" />
            )}
            <input type="file" accept="image/*" onChange={subirImagenArticulo} className="text-xs w-32" />
          </div>
        </div>
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
              <th className="text-left px-3 py-2 print:hidden">Imagen</th>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Descripción</th>
              <th className="text-right px-3 py-2">Precio</th>
              <th className="text-right px-3 py-2">Existencias</th>
              <th className="px-3 py-2 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 print:hidden">
                  <label className="cursor-pointer block w-10 h-10">
                    {a.imagen ? (
                      <img src={a.imagen} alt="" className="w-10 h-10 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded border border-dashed bg-slate-50 flex items-center justify-center text-slate-300 text-[9px] text-center">vacío</div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          setInventario({ ...inventario, [cat]: lista.map((x) => (x.id === a.id ? { ...x, imagen: reader.result } : x)) });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </td>
                <td className="px-3 py-2 text-slate-500">{a.sku}</td>
                <td className="px-3 py-2">{a.nombre}</td>
                <td className="px-3 py-2 text-slate-500 max-w-[260px]">{a.rangoDescripcion || "—"}</td>
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
                <td colSpan={7} className="text-center text-slate-400 py-6">
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
const CAMPOS_RECETA_PACIENTE = ["Esf", "Cil", "Eje", "DI", "Add", "Obs"];

function lineaOjo(ojo, etiqueta) {
  const o = ojo || {};
  const di = o.di ? `${o.di} mm` : "-";
  return `${etiqueta}: Esf ${o.esf || "-"} · Cil ${o.cil || "-"} · Eje ${o.eje || "-"} · DI ${di} · Add ${o.add || "-"} · Obs ${o.obs || "-"}`;
}

function PacientesView({ pacientes, setPacientes, agenda, setAgenda, ventas, setVentas, config }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null); // id de paciente con expediente abierto
  const [mensajeUnificar, setMensajeUnificar] = useState("");
  const filtrados = busqueda
    ? pacientes.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : pacientes;

  function eliminarPaciente(id) {
    const restantes = pacientes.filter((p) => p.id !== id).map((p, i) => ({ ...p, folio: i + 1 }));
    setPacientes(restantes);
    setAgenda(agenda.filter((c) => c.pacienteId !== id));
    setAbierto(null);
  }

  function unificarDuplicados() {
    const grupos = new Map();
    pacientes.forEach((p) => {
      const clave = (p.nombre || "").trim().toLowerCase();
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(p);
    });

    const duplicados = [...grupos.values()].filter((g) => g.length > 1).length;
    if (duplicados === 0) {
      setMensajeUnificar("No se encontraron pacientes duplicados.");
      return;
    }
    if (!window.confirm(`Se encontraron ${duplicados} nombre(s) con expedientes repetidos. Se van a unificar en uno solo por nombre, combinando sus datos y su historial de compras. ¿Continuar?`)) {
      return;
    }

    const mapaIdViejoANuevo = {};
    const unificados = [];
    grupos.forEach((grupo) => {
      const base = { ...grupo[0] };
      let compras = [...(base.compras || [])];
      mapaIdViejoANuevo[base.id] = base.id;
      for (let i = 1; i < grupo.length; i++) {
        const p = grupo[i];
        ["domicilio", "colonia", "cp", "mail", "telefono", "direccion", "ciudad", "municipio", "edad", "email"].forEach((campo) => {
          if (!base[campo] && p[campo]) base[campo] = p[campo];
        });
        compras = [...compras, ...(p.compras || [])];
        mapaIdViejoANuevo[p.id] = base.id;
      }
      base.compras = compras;
      unificados.push(base);
    });

    unificados.sort((a, b) => (a.folio || 0) - (b.folio || 0));
    const renumerados = unificados.map((p, i) => ({ ...p, folio: i + 1 }));

    setPacientes(renumerados);
    setAgenda(agenda.map((c) => (mapaIdViejoANuevo[c.pacienteId] ? { ...c, pacienteId: mapaIdViejoANuevo[c.pacienteId] } : c)));
    if (ventas && setVentas) {
      setVentas(ventas.map((v) => (mapaIdViejoANuevo[v.pacienteId] ? { ...v, pacienteId: mapaIdViejoANuevo[v.pacienteId] } : v)));
    }
    setMensajeUnificar(`Se unificaron ${duplicados} nombre(s) duplicado(s). Ahora hay ${renumerados.length} pacientes.`);
  }

  const pacienteAbierto = abierto ? pacientes.find((p) => p.id === abierto) : null;

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente por nombre..."
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={unificarDuplicados} className="px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium">
          Unificar pacientes duplicados
        </button>
        <button
          onClick={() => imprimirElemento("listado-pacientes-imprimible")}
          className="px-3 py-2 rounded-lg bg-slate-200 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Imprimir listado de pacientes
        </button>
      </div>
      {mensajeUnificar && <p className="text-xs text-emerald-700 mb-2">{mensajeUnificar}</p>}

      <div id="listado-pacientes-imprimible" className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Folio</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-right px-3 py-2">Saldo</th>
              <th className="text-right px-3 py-2 print:hidden"># Compras</th>
              <th className="px-3 py-2 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-3 py-2">{p.folio}</td>
                <td className="px-3 py-2 font-medium">
                  <button onClick={() => setAbierto(p.id)} className="text-sky-700 hover:underline print:no-underline print:text-slate-800">
                    {p.nombre}
                  </button>
                </td>
                <td className="px-3 py-2">{p.telefono}</td>
                <td className="px-3 py-2 text-right">${Number(p.saldo || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right print:hidden">{(p.compras || []).length}</td>
                <td className="px-3 py-2 text-right print:hidden">
                  <button onClick={() => eliminarPaciente(p.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Sin pacientes registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!pacienteAbierto} onClose={() => setAbierto(null)} title="Expediente del paciente" wide>
        {pacienteAbierto && (
          <ExpedientePacienteCompleto
            paciente={pacienteAbierto}
            pacientes={pacientes}
            setPacientes={setPacientes}
            onEliminar={() => eliminarPaciente(pacienteAbierto.id)}
            onCerrar={() => setAbierto(null)}
            config={config}
          />
        )}
      </Modal>
    </div>
  );
}

function fechaVisita(v) {
  if (!v.fecha) return "Sin fecha";
  const d = new Date(v.fecha);
  return isNaN(d) ? v.fecha : d.toLocaleDateString("es-MX");
}

function ordenarVisitasDesc(compras) {
  return [...(compras || [])].sort((a, b) => {
    const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
    const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
    return fb - fa;
  });
}

function ResumenVisita({ v }) {
  return (
    <div className="border rounded-lg p-3 text-sm">
      <p className="text-xs text-slate-400 mb-1">
        {fechaVisita(v)} {v.origen ? `· origen: ${v.origen}` : ""}
      </p>
      {v.items && (
        <div className="mb-1">
          <p className="font-medium">Venta (POS) — Folio #{v.folio}</p>
          {v.items.map((it, i) => (
            <p key={i} className="text-xs text-slate-600">{it.nombre} — ${it.precio}</p>
          ))}
        </div>
      )}
      {(v.od || v.os) && (
        <div className="mb-1">
          <p className="font-medium">Receta</p>
          {v.od && (
            <p className="text-xs text-slate-600">
              O.D.: {CAMPOS_RECETA_PACIENTE.map((c) => `${c} ${v.od[c.toLowerCase()] || "-"}`).join(" · ")}
            </p>
          )}
          {v.os && (
            <p className="text-xs text-slate-600">
              O.S.: {CAMPOS_RECETA_PACIENTE.map((c) => `${c} ${v.os[c.toLowerCase()] || "-"}`).join(" · ")}
            </p>
          )}
        </div>
      )}
      {(v.materialReceta || v.descripcion || v.cantidad || v.precioMaterial || v.totalProducto) && (
        <div className="text-xs text-slate-600 mb-1">
          {v.materialReceta && <p>Material: {v.materialReceta}</p>}
          {v.descripcion && <p>Descripción: {v.descripcion}</p>}
          {v.cantidad && <p>Cantidad: {v.cantidad}</p>}
          {v.precioMaterial && <p>Precio material: ${v.precioMaterial}</p>}
          {v.totalProducto && <p>Total producto: ${v.totalProducto}</p>}
        </div>
      )}
      {(v.total !== undefined && v.total !== "" && !v.items) && (
        <p className="text-xs text-slate-600">
          Total: ${v.total} · Anticipo: ${v.anticipo || 0} · Saldo: ${v.saldo || 0}
          {v.fechaPrometido && ` · Prometido: ${v.fechaPrometido}`}
        </p>
      )}
    </div>
  );
}

function ExpedientePacienteCompleto({ paciente, pacientes, setPacientes, onEliminar, onCerrar, config }) {
  const camposPersonales = ["nombre", "domicilio", "colonia", "cp", "mail", "telefono"];
  const [datos, setDatos] = useState(() => {
    const base = { ...paciente };
    camposPersonales.forEach((c) => { if (base[c] === undefined) base[c] = ""; });
    if (!Array.isArray(base.compras)) base.compras = [];
    return base;
  });
  const [agregandoVisita, setAgregandoVisita] = useState(false);
  const [nuevaVisita, setNuevaVisita] = useState({
    fecha: fechaISO(new Date()), total: "", anticipo: "", saldo: "", fechaPrometido: "",
    od: { esf: "", cil: "", eje: "", di: "", add: "", obs: "" },
    os: { esf: "", cil: "", eje: "", di: "", add: "", obs: "" },
    materialReceta: "", cantidad: "", descripcion: "", precioMaterial: "", totalProducto: "",
  });
  const [imprimiendo, setImprimiendo] = useState(false);
  const [incluirPersonales, setIncluirPersonales] = useState(true);
  const [incluirCompra, setIncluirCompra] = useState(true);
  const [incluirReceta, setIncluirReceta] = useState(true);
  const [visitasSel, setVisitasSel] = useState({});

  const visitasOrdenadas = ordenarVisitasDesc(datos.compras);

  function campo(nombre, label, tipo = "text") {
    return (
      <Field
        label={label}
        type={tipo}
        value={datos[nombre]}
        onChange={(e) => setDatos({ ...datos, [nombre]: e.target.value })}
      />
    );
  }

  function guardar() {
    setPacientes(pacientes.map((p) => (p.id === paciente.id ? { ...p, ...datos } : p)));
  }

  function agregarVisitaManual() {
    const visita = { ...nuevaVisita, id: uid(), fecha: new Date(nuevaVisita.fecha).toISOString(), origen: "manual" };
    const actualizado = { ...datos, compras: [...(datos.compras || []), visita] };
    setDatos(actualizado);
    setPacientes(pacientes.map((p) => (p.id === paciente.id ? { ...p, ...actualizado } : p)));
    setAgregandoVisita(false);
    setNuevaVisita({
      fecha: fechaISO(new Date()), total: "", anticipo: "", saldo: "", fechaPrometido: "",
      od: { esf: "", cil: "", eje: "", di: "", add: "", obs: "" },
      os: { esf: "", cil: "", eje: "", di: "", add: "", obs: "" },
      materialReceta: "", cantidad: "", descripcion: "", precioMaterial: "", totalProducto: "",
    });
  }

  function abrirSelectorImpresion() {
    const sel = {};
    visitasOrdenadas.forEach((v) => { sel[v.id || v.folio] = true; });
    setVisitasSel(sel);
    setImprimiendo(true);
  }

  function imprimirConSeleccion() {
    guardar();
    setImprimiendo(false);
    setTimeout(() => imprimirElemento(`paciente-imprimible-${paciente.id}`), 60);
  }

  const visitasAImprimir = visitasOrdenadas.filter((v) => visitasSel[v.id || v.folio]);

  return (
    <div className="space-y-4" style={{ maxHeight: "65vh", overflowY: "auto" }}>
      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Datos personales</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-sm text-slate-500 flex items-end pb-2">Folio: <b className="ml-1">{paciente.folio}</b></div>
          {campo("nombre", "Nombre")}
          {campo("domicilio", "Domicilio")}
          {campo("colonia", "Colonia")}
          {campo("cp", "C.P.")}
          {campo("mail", "Mail")}
          {campo("telefono", "Teléfono")}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-700">
            Historial de visitas / compras — <span className="text-sky-700">Número de compras: {visitasOrdenadas.length}</span>
          </h3>
          <button onClick={() => setAgregandoVisita(true)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
            <Plus size={14} /> Agregar visita manualmente
          </button>
        </div>
        <div className="space-y-2">
          {visitasOrdenadas.map((v) => (
            <ResumenVisita key={v.id || v.folio} v={v} />
          ))}
          {visitasOrdenadas.length === 0 && <p className="text-xs text-slate-400">Sin visitas o compras registradas todavía.</p>}
        </div>
      </div>

      {/* Plantilla imprimible individual (oculta en pantalla) */}
      <div className="plantilla-oculta" style={{ position: "absolute", left: -9999, top: 0 }}>
        <div id={`paciente-imprimible-${paciente.id}`}>
          <div className="flex items-center gap-3 mb-3">
            {config?.logo && <img src={config.logo} style={{ height: 60 }} alt="logo" />}
            <div>
              <p className="font-bold">Spektrum Ópticas</p>
              <p className="text-xs">{config?.direccion}</p>
              <p className="text-xs">Tel: {config?.telefono}</p>
            </div>
          </div>
          <p className="font-bold mb-2">EXPEDIENTE — {datos.nombre} (Folio {paciente.folio})</p>
          {incluirPersonales && (
            <>
              <p className="text-sm">Domicilio: {datos.domicilio}, {datos.colonia}, C.P. {datos.cp}</p>
              <p className="text-sm">Mail: {datos.mail} — Teléfono: {datos.telefono}</p>
            </>
          )}
          <p className="text-sm mt-1">Número de compras: {visitasOrdenadas.length}</p>
          {visitasAImprimir.map((v) => (
            <div key={v.id || v.folio} style={{ marginTop: 10, borderTop: "1px solid #ccc", paddingTop: 6 }}>
              <p className="text-sm font-semibold">{fechaVisita(v)}</p>
              {incluirCompra && (
                <>
                  {v.items && (
                    <>
                      <p className="text-xs">Venta — Folio #{v.folio}</p>
                      {v.items.map((it, i) => (
                        <p key={i} className="text-xs">{it.nombre} — ${it.precio}</p>
                      ))}
                    </>
                  )}
                  {v.materialReceta && <p className="text-xs">Material: {v.materialReceta}</p>}
                  {v.descripcion && <p className="text-xs">Descripción: {v.descripcion}</p>}
                  {v.cantidad && <p className="text-xs">Cantidad: {v.cantidad}</p>}
                  {(v.total !== undefined && v.total !== "") && (
                    <p className="text-xs">Total: ${v.total} — Anticipo: ${v.anticipo || 0} — Saldo: ${v.saldo || 0}</p>
                  )}
                  {v.fechaPrometido && <p className="text-xs">Fecha prometido: {v.fechaPrometido}</p>}
                </>
              )}
              {incluirReceta && (v.od || v.os) && (
                <>
                  {v.od && (
                    <p className="text-xs">O.D.: {CAMPOS_RECETA_PACIENTE.map((c) => `${c} ${v.od[c.toLowerCase()] || "-"}`).join(" · ")}</p>
                  )}
                  {v.os && (
                    <p className="text-xs">O.S.: {CAMPOS_RECETA_PACIENTE.map((c) => `${c} ${v.os[c.toLowerCase()] || "-"}`).join(" · ")}</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button onClick={guardar} className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm flex items-center gap-1">
          <Save size={16} /> Guardar
        </button>
        <button onClick={abrirSelectorImpresion} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm flex items-center gap-1">
          <Printer size={16} /> Imprimir
        </button>
        <button
          onClick={() => {
            guardar();
            onCerrar();
          }}
          className="px-3 py-2 rounded-lg bg-slate-600 text-white text-sm flex items-center gap-1"
        >
          <LogOut size={16} /> Guardar y salir
        </button>
        <button onClick={onEliminar} className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm flex items-center gap-1 ml-auto">
          <Trash2 size={16} /> Eliminar paciente
        </button>
      </div>

      <Modal open={agregandoVisita} onClose={() => setAgregandoVisita(false)} title="Agregar visita manualmente">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" type="date" value={nuevaVisita.fecha} onChange={(e) => setNuevaVisita({ ...nuevaVisita, fecha: e.target.value })} />
          <Field label="Fecha prometido" type="date" value={nuevaVisita.fechaPrometido} onChange={(e) => setNuevaVisita({ ...nuevaVisita, fechaPrometido: e.target.value })} />
          <Field label="Total" type="number" value={nuevaVisita.total} onChange={(e) => setNuevaVisita({ ...nuevaVisita, total: e.target.value })} />
          <Field label="Anticipo" type="number" value={nuevaVisita.anticipo} onChange={(e) => setNuevaVisita({ ...nuevaVisita, anticipo: e.target.value })} />
          <Field label="Saldo" type="number" value={nuevaVisita.saldo} onChange={(e) => setNuevaVisita({ ...nuevaVisita, saldo: e.target.value })} />
          <Field label="Material receta" value={nuevaVisita.materialReceta} onChange={(e) => setNuevaVisita({ ...nuevaVisita, materialReceta: e.target.value })} />
          <Field label="Cantidad" type="number" value={nuevaVisita.cantidad} onChange={(e) => setNuevaVisita({ ...nuevaVisita, cantidad: e.target.value })} />
          <Field label="Descripción" value={nuevaVisita.descripcion} onChange={(e) => setNuevaVisita({ ...nuevaVisita, descripcion: e.target.value })} />
          <Field label="Precio material" type="number" value={nuevaVisita.precioMaterial} onChange={(e) => setNuevaVisita({ ...nuevaVisita, precioMaterial: e.target.value })} />
          <Field label="Total producto" type="number" value={nuevaVisita.totalProducto} onChange={(e) => setNuevaVisita({ ...nuevaVisita, totalProducto: e.target.value })} />
        </div>
        {["od", "os"].map((ojo) => (
          <div key={ojo} className="flex items-center gap-2 mb-2">
            <span className="w-10 font-semibold text-sm">{ojo === "od" ? "O.D." : "O.S."}</span>
            {CAMPOS_RECETA_PACIENTE.map((c) => (
              <input
                key={c}
                placeholder={c}
                value={nuevaVisita[ojo][c.toLowerCase()]}
                onChange={(e) => setNuevaVisita({ ...nuevaVisita, [ojo]: { ...nuevaVisita[ojo], [c.toLowerCase()]: e.target.value } })}
                className="w-16 border rounded px-1 py-1 text-xs text-center"
              />
            ))}
          </div>
        ))}
        <button onClick={agregarVisitaManual} className="w-full py-2 rounded-lg text-white text-sm font-medium mt-2" style={{ background: SKY_DARK }}>
          Guardar visita
        </button>
      </Modal>

      <Modal open={imprimiendo} onClose={() => setImprimiendo(false)} title="Elige qué imprimir">
        <div className="space-y-2 mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirPersonales} onChange={(e) => setIncluirPersonales(e.target.checked)} /> Datos personales
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirCompra} onChange={(e) => setIncluirCompra(e.target.checked)} /> Datos de compra
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirReceta} onChange={(e) => setIncluirReceta(e.target.checked)} /> Receta
          </label>
        </div>
        {visitasOrdenadas.length > 1 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase mb-1">Visitas a incluir</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {visitasOrdenadas.map((v) => (
                <label key={v.id || v.folio} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!visitasSel[v.id || v.folio]}
                    onChange={(e) => setVisitasSel({ ...visitasSel, [v.id || v.folio]: e.target.checked })}
                  />
                  {fechaVisita(v)}
                </label>
              ))}
            </div>
          </div>
        )}
        <button onClick={imprimirConSeleccion} className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ background: SKY_DARK }}>
          Imprimir ahora
        </button>
      </Modal>
    </div>
  );
}

/* ============================================================
   LABORATORIO
   ============================================================ */
function LaboratorioView({ laboratorio, setLaboratorio, pacientes, inventario, config }) {
  const [fechaImprimir, setFechaImprimir] = useState(fechaISO(new Date()));
  const [nueva, setNueva] = useState({
    pacienteId: "",
    od: null,
    os: null,
    descripcion: "",
    material: "",
    armazon: "",
    fechaEnvio: "",
    fechaPrometida: "",
    fechaRecepcion: "",
  });

  const armazonesInventario = inventario?.armazones || [];

  function seleccionarPaciente(pacienteId) {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const historial = ordenarVisitasDesc(paciente?.compras || []);
    const visitaReceta = historial.find((v) => v.od || v.os);
    setNueva({
      ...nueva,
      pacienteId,
      od: visitaReceta?.od || null,
      os: visitaReceta?.os || null,
      descripcion: visitaReceta?.descripcion || "",
      material: visitaReceta?.materialReceta || "",
      fechaPrometida: visitaReceta?.fechaPrometido || "",
    });
  }

  function agregar() {
    if (!nueva.pacienteId) return;
    const paciente = pacientes.find((p) => p.id === nueva.pacienteId);
    setLaboratorio([
      ...laboratorio,
      {
        ...nueva,
        id: uid(),
        nombreCliente: paciente?.nombre || "",
        fechaVenta: "",
        origen: "manual",
      },
    ]);
    setNueva({ pacienteId: "", od: null, os: null, descripcion: "", material: "", armazon: "", fechaEnvio: "", fechaPrometida: "", fechaRecepcion: "" });
  }

  function actualizarFecha(id, campo, valor) {
    setLaboratorio(laboratorio.map((o) => (o.id === id ? { ...o, [campo]: valor } : o)));
  }

  function cancelarOrden(id) {
    if (!window.confirm("¿Cancelar esta orden de laboratorio? Quedará marcada como cancelada.")) return;
    setLaboratorio(laboratorio.map((o) => (o.id === id ? { ...o, cancelada: true } : o)));
  }

  function reactivarOrden(id) {
    setLaboratorio(laboratorio.map((o) => (o.id === id ? { ...o, cancelada: false } : o)));
  }

  function eliminarOrden(id) {
    if (!window.confirm("¿Eliminar esta orden por completo? No se podrá recuperar.")) return;
    setLaboratorio(laboratorio.filter((o) => o.id !== id));
  }

  function recetaParaImprimir(o) {
    if (o.od || o.os) return { od: o.od, os: o.os, descripcion: o.descripcion };
    const paciente = pacientes.find((p) => p.id === o.pacienteId);
    const historial = ordenarVisitasDesc(paciente?.compras || []);
    const visitaReceta = historial.find((v) => v.od || v.os);
    return {
      od: visitaReceta?.od || null,
      os: visitaReceta?.os || null,
      descripcion: o.descripcion || visitaReceta?.descripcion || "",
    };
  }

  function marcarRecibido(o) {
    const hoy = fechaISO(new Date());
    setLaboratorio(laboratorio.map((x) => (x.id === o.id ? { ...x, fechaRecepcion: hoy } : x)));
    const paciente = pacientes.find((p) => p.id === o.pacienteId);
    const nombre = o.nombreCliente || paciente?.nombre || "cliente";
    const msj = mensajeListos(nombre, config?.direccion, config?.horario);
    if (paciente?.telefono) abrirWhatsApp(paciente.telefono, msj.whatsapp);
    if (paciente?.mail) abrirEmail(paciente.mail, msj.email.asunto, msj.email.cuerpo);
    if (!paciente?.telefono && !paciente?.mail) {
      alert("Se marcó como recibido, pero este paciente no tiene teléfono ni correo guardado para avisarle.");
    }
  }

  return (
    <div className="p-4">
      <div className="bg-white border rounded-xl p-3 mb-4 space-y-2">
        <p className="text-xs text-slate-500">
          Las órdenes de venta con armazón o lentes se agregan solas aquí abajo, con la receta del día de consulta (si
          la hubo) o la más reciente de su expediente. Usa este formulario solo para casos especiales.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            value={nueva.pacienteId}
            onChange={(e) => seleccionarPaciente(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Paciente...</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5 w-64">
            {nueva.od || nueva.os ? (
              <>
                <p>{lineaOjo(nueva.od, "O.D.")}</p>
                <p>{lineaOjo(nueva.os, "O.S.")}</p>
              </>
            ) : (
              "Receta: se autocompleta al elegir paciente"
            )}
          </div>
          <div>
            <label className="text-xs text-slate-500">Material</label>
            <select value={nueva.material} onChange={(e) => setNueva({ ...nueva, material: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm w-32">
              <option value="">—</option>
              <option>CR39</option>
              <option>Policarbonato</option>
              <option>Hi Index</option>
              {nueva.material && !["CR39", "Policarbonato", "Hi Index"].includes(nueva.material) && (
                <option value={nueva.material}>{nueva.material}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Armazón</label>
            <div className="flex gap-1">
              <input placeholder="Escribe o elige →" value={nueva.armazon} onChange={(e) => setNueva({ ...nueva, armazon: e.target.value })} className="border rounded-lg px-2 py-1.5 text-sm w-32" />
              <select
                value=""
                onChange={(e) => e.target.value && setNueva({ ...nueva, armazon: e.target.value })}
                className="border rounded-lg text-sm px-1"
                title="Elegir del inventario"
              >
                <option value="">▾</option>
                {armazonesInventario.map((a) => (
                  <option key={a.id} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Envío a laboratorio</label>
            <input type="date" value={nueva.fechaEnvio} onChange={(e) => setNueva({ ...nueva, fechaEnvio: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Prometida al cliente</label>
            <input type="date" value={nueva.fechaPrometida} onChange={(e) => setNueva({ ...nueva, fechaPrometida: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <button onClick={agregar} disabled={!nueva.pacienteId} className="px-3 py-1.5 rounded-lg text-white text-sm disabled:opacity-40" style={{ background: SKY_DARK }}>
            Agregar orden manualmente
          </button>
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 mb-2">
        <label className="text-xs text-slate-500">Órdenes del día:</label>
        <input type="date" value={fechaImprimir} onChange={(e) => setFechaImprimir(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        <button
          onClick={() => imprimirElemento("todas-ordenes-lab")}
          disabled={
            laboratorio.filter(
              (o) =>
                !o.cancelada &&
                !o.fechaRecepcion &&
                ((o.fechaVenta && o.fechaVenta.slice(0, 10) === fechaImprimir) || (!o.fechaVenta && o.fechaEnvio === fechaImprimir))
            ).length === 0
          }
          className="px-3 py-2 rounded-lg text-white text-sm flex items-center gap-1 disabled:opacity-40"
          style={{ background: SKY_DARK }}
        >
          <Printer size={16} /> Imprimir órdenes del día (
          {
            laboratorio.filter(
              (o) =>
                !o.cancelada &&
                !o.fechaRecepcion &&
                ((o.fechaVenta && o.fechaVenta.slice(0, 10) === fechaImprimir) || (!o.fechaVenta && o.fechaEnvio === fechaImprimir))
            ).length
          }
          )
        </button>
      </div>
      <p className="text-xs text-slate-400 text-right mb-2">
        Solo se cuentan como activas las órdenes que aún no han sido recibidas del laboratorio — una vez recibidas,
        se apagan de este conteo porque ya están en la óptica listas para entregar.
      </p>

      <div className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Paciente</th>
              <th className="text-left px-3 py-2">Receta</th>
              <th className="text-left px-3 py-2">Material</th>
              <th className="text-left px-3 py-2">Armazón</th>
              <th className="text-left px-3 py-2">Fecha venta</th>
              <th className="text-left px-3 py-2">Envío a lab.</th>
              <th className="text-left px-3 py-2">Prometida</th>
              <th className="text-left px-3 py-2">Recibido del laboratorio</th>
              <th className="text-left px-3 py-2">Estatus</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {laboratorio.map((o) => (
              <tr key={o.id} className={`border-t align-top ${o.cancelada ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">{o.nombreCliente || pacientes.find((p) => p.id === o.pacienteId)?.nombre || "—"}</td>
                <td className="px-3 py-2 max-w-[220px] truncate" title={`${lineaOjo(recetaParaImprimir(o).od, "O.D.")} | ${lineaOjo(recetaParaImprimir(o).os, "O.S.")}`}>
                  {recetaParaImprimir(o).od || recetaParaImprimir(o).os ? `${lineaOjo(recetaParaImprimir(o).od, "O.D.")} | ${lineaOjo(recetaParaImprimir(o).os, "O.S.")}` : "—"}
                </td>
                <td className="px-3 py-2">{o.material || "—"}</td>
                <td className="px-3 py-2">{o.armazon || "—"}</td>
                <td className="px-3 py-2">{o.fechaVenta ? new Date(o.fechaVenta).toLocaleDateString("es-MX") : "—"}</td>
                <td className="px-3 py-2">
                  <input type="date" value={o.fechaEnvio || ""} onChange={(e) => actualizarFecha(o.id, "fechaEnvio", e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
                </td>
                <td className="px-3 py-2">
                  <input type="date" value={o.fechaPrometida || ""} onChange={(e) => actualizarFecha(o.id, "fechaPrometida", e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
                </td>
                <td className="px-3 py-2">
                  {o.fechaRecepcion ? (
                    <span className="text-xs text-emerald-700">{o.fechaRecepcion}</span>
                  ) : (
                    <button onClick={() => marcarRecibido(o)} className="text-xs px-2 py-1 rounded bg-emerald-500 text-white">
                      Marcar como recibido y avisar
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  {o.cancelada ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Cancelada</span>
                  ) : o.fechaRecepcion ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">Recibida — lista para entregar</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Activa</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {o.cancelada ? (
                    <button onClick={() => reactivarOrden(o.id)} className="text-xs text-sky-600 underline">Reactivar</button>
                  ) : (
                    <button onClick={() => cancelarOrden(o.id)} className="text-xs text-red-500 underline">Cancelar</button>
                  )}
                  <button onClick={() => eliminarOrden(o.id)} className="text-xs text-red-700 underline ml-2">Eliminar</button>
                  <button onClick={() => imprimirElemento(`orden-lab-${o.id}`)} className="text-xs text-slate-600 underline ml-2">Imprimir orden</button>
                </td>
              </tr>
            ))}
            {laboratorio.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-slate-400 py-6">Sin órdenes de laboratorio todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Plantillas imprimibles de orden de laboratorio (ocultas en pantalla) */}
      <div className="plantilla-oculta" style={{ position: "absolute", left: -9999, top: 0 }}>
        <div id="todas-ordenes-lab">
          {laboratorio
            .filter(
              (o) =>
                !o.cancelada &&
                !o.fechaRecepcion &&
                ((o.fechaVenta && o.fechaVenta.slice(0, 10) === fechaImprimir) || (!o.fechaVenta && o.fechaEnvio === fechaImprimir))
            )
            .map((o) => {
            const paciente = pacientes.find((p) => p.id === o.pacienteId);
            return (
              <div key={`todas-${o.id}`} style={{ pageBreakAfter: "always" }}>
                <div className="flex items-center gap-3 mb-4" style={{ borderBottom: "2px solid #5EB6E8", paddingBottom: 10 }}>
                  {config?.logo && <img src={config.logo} style={{ height: 70 }} alt="logo" />}
                  <div>
                    <p className="font-bold text-lg">Spektrum Ópticas</p>
                    <p className="text-xs">{config?.direccion}</p>
                    <p className="text-xs">Tel: {config?.telefono}</p>
                  </div>
                </div>
                <p className="font-bold text-center mb-3" style={{ fontSize: 16 }}>ORDEN DE LABORATORIO</p>
                <table style={{ width: "100%", fontSize: 13, marginBottom: 12 }}>
                  <tbody>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0" }}>Paciente:</td><td>{o.nombreCliente || paciente?.nombre || "—"}</td></tr>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0" }}>Folio de venta:</td><td>{o.folioVenta || "—"}</td></tr>
                  </tbody>
                </table>
                <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
                  <p className="font-semibold" style={{ marginBottom: 4 }}>Receta</p>
                  <p style={{ fontSize: 13 }}>{lineaOjo(recetaParaImprimir(o).od, "O.D.")}</p>
                  <p style={{ fontSize: 13 }}>{lineaOjo(recetaParaImprimir(o).os, "O.S.")}</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Material: {o.material || "-"}</p>
                  <p style={{ fontSize: 13 }}>Descripción: {recetaParaImprimir(o).descripcion || "-"}</p>
                </div>
                <table style={{ width: "100%", fontSize: 13, marginBottom: 12, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Armazón:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.armazon || "—"}</td></tr>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha de envío a laboratorio:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaEnvio || "—"}</td></tr>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha prometida:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaPrometida || "—"}</td></tr>
                    <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha de recibido del laboratorio:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaRecepcion || "Pendiente"}</td></tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {laboratorio.map((o) => {
          const paciente = pacientes.find((p) => p.id === o.pacienteId);
          return (
            <div key={o.id} id={`orden-lab-${o.id}`}>
              <div className="flex items-center gap-3 mb-4" style={{ borderBottom: "2px solid #5EB6E8", paddingBottom: 10 }}>
                {config?.logo && <img src={config.logo} style={{ height: 70 }} alt="logo" />}
                <div>
                  <p className="font-bold text-lg">Spektrum Ópticas</p>
                  <p className="text-xs">{config?.direccion}</p>
                  <p className="text-xs">Tel: {config?.telefono}</p>
                </div>
              </div>
              <p className="font-bold text-center mb-3" style={{ fontSize: 16 }}>ORDEN DE LABORATORIO</p>
              <table style={{ width: "100%", fontSize: 13, marginBottom: 12 }}>
                <tbody>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0" }}>Paciente:</td><td>{o.nombreCliente || paciente?.nombre || "—"}</td></tr>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0" }}>Folio de venta:</td><td>{o.folioVenta || "—"}</td></tr>
                </tbody>
              </table>
              <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
                <p className="font-semibold" style={{ marginBottom: 4 }}>Receta</p>
                <p style={{ fontSize: 13 }}>{lineaOjo(recetaParaImprimir(o).od, "O.D.")}</p>
                <p style={{ fontSize: 13 }}>{lineaOjo(recetaParaImprimir(o).os, "O.S.")}</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Material: {o.material || "-"}</p>
                <p style={{ fontSize: 13 }}>Descripción: {recetaParaImprimir(o).descripcion || "-"}</p>
              </div>
              <table style={{ width: "100%", fontSize: 13, marginBottom: 12, borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Armazón:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.armazon || "—"}</td></tr>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha de envío a laboratorio:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaEnvio || "—"}</td></tr>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha prometida:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaPrometida || "—"}</td></tr>
                  <tr><td style={{ fontWeight: "bold", padding: "4px 8px 4px 0", borderTop: "1px solid #ddd" }}>Fecha de recibido del laboratorio:</td><td style={{ borderTop: "1px solid #ddd" }}>{o.fechaRecepcion || "Pendiente"}</td></tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   REPORTES
   ============================================================ */
function ReportesView({ ventas, setVentas, inventario, setInventario, pacientes, laboratorio, pagosProveedores, setPagosProveedores, proveedores }) {
  const [modo, setModo] = useState("corte");
  const canceladas = ventas.filter((v) => v.estatus === "cancelada" || v.estatus === "devolucion");

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setModo("corte")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "corte" ? "text-white" : "bg-white border"}`} style={modo === "corte" ? { background: SKY_DARK } : {}}>
          El corte diario
        </button>
        <button onClick={() => setModo("cancel")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "cancel" ? "text-white" : "bg-white border"}`} style={modo === "cancel" ? { background: SKY_DARK } : {}}>
          Cancelaciones y/o devoluciones
        </button>
        <button onClick={() => setModo("mes")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "mes" ? "text-white" : "bg-white border"}`} style={modo === "mes" ? { background: SKY_DARK } : {}}>
          Corte del mes
        </button>
      </div>

      {modo === "corte" ? (
        <CorteDiario
          ventas={ventas}
          setVentas={setVentas}
          pacientes={pacientes}
          pagosProveedores={pagosProveedores}
          setPagosProveedores={setPagosProveedores}
          proveedores={proveedores}
        />
      ) : modo === "mes" ? (
        <CorteMensual ventas={ventas} pagosProveedores={pagosProveedores} proveedores={proveedores} />
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

function TotalBox({ titulo, monto, color, subtitulo, esConteo }) {
  return (
    <div className="bg-white border rounded-xl p-4 shrink-0" style={{ minWidth: 170 }}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{titulo}</p>
      <p className="text-2xl font-bold mt-1 whitespace-nowrap" style={{ color }}>
        {esConteo ? monto : `$${monto.toFixed(2)}`}
      </p>
      {subtitulo && <p className="text-xs text-slate-400 mt-1">{subtitulo}</p>}
    </div>
  );
}

function CorteDiario({ ventas, setVentas, pacientes, pagosProveedores, setPagosProveedores, proveedores }) {
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

  const totalTicketsDia = ventasDelDia.length;
  const ticketPromedioDia = totalTicketsDia > 0 ? totalVendido / totalTicketsDia : 0;

  const pagosProvDelDia = pagosProveedores.filter((p) => esDelDia(p.fecha));
  const totalProveedores = pagosProvDelDia.reduce((s, p) => s + Number(p.monto || 0), 0);
  const debeHaberCaja = totalCobradoHoy - totalProveedores;

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
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="text-xl font-bold text-slate-800">Corte Diario</h2>
        <button
          onClick={() => imprimirElemento("corte-imprimible")}
          className="px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Imprimir corte
        </button>
      </div>
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

      <div id="corte-imprimible">
        <p className="hidden print:block font-bold mb-3">Corte Diario — {fecha}</p>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1 print:hidden">
          <TotalBox titulo="Vendido del día" monto={totalVendido} color="#2563eb" subtitulo={`${ventasDelDia.length} nota(s)`} />
          <TotalBox titulo="Total de tickets del día" monto={totalTicketsDia} color="#0f766e" subtitulo={`Ticket promedio: $${ticketPromedioDia.toFixed(2)}`} esConteo />
          <TotalBox titulo="Anticipos cobrados" monto={totalAnticipos} color="#0891b2" subtitulo={`${anticipos.length} pago(s)`} />
          <TotalBox titulo="Saldos cobrados al entregar" monto={totalLiquidaciones} color="#059669" subtitulo={`${liquidaciones.length} pago(s)`} />
          <TotalBox titulo="Total cobrado hoy" monto={totalCobradoHoy} color="#047857" subtitulo="Anticipos + liquidaciones + contado" />
          <TotalBox titulo="Saldo pendiente" monto={totalSaldoPendiente} color="#dc2626" subtitulo={`${notasConSaldo.length} nota(s) por cobrar`} />
          <TotalBox titulo="Pago a proveedores" monto={totalProveedores} color="#7c3aed" subtitulo={`${pagosProvDelDia.length} pago(s)`} />
          <TotalBox titulo="Debe haber en caja" monto={debeHaberCaja} color={debeHaberCaja >= 0 ? "#0d9488" : "#dc2626"} subtitulo="Cobrado hoy − pago a proveedores" />
        </div>

        <div className="hidden print:grid" style={{ gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 2, fontSize: 12, marginBottom: 16 }}>
          <div>
            <p><b>Vendido del día:</b> ${totalVendido.toFixed(2)}</p>
            <p><b>Total de tickets del día:</b> {totalTicketsDia}</p>
            <p><b>Ticket promedio:</b> ${ticketPromedioDia.toFixed(2)}</p>
            <p><b>Anticipos cobrados:</b> ${totalAnticipos.toFixed(2)}</p>
          </div>
          <div>
            <p><b>Saldos cobrados al entregar:</b> ${totalLiquidaciones.toFixed(2)}</p>
            <p><b>Total cobrado hoy:</b> ${totalCobradoHoy.toFixed(2)}</p>
            <p><b>Saldo pendiente:</b> ${totalSaldoPendiente.toFixed(2)}</p>
            <p><b>Pago a proveedores:</b> ${totalProveedores.toFixed(2)}</p>
            <p><b>Debe haber en caja:</b> ${debeHaberCaja.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose — Vendido del día</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400"><th className="text-left font-normal py-1">No. de ticket</th><th className="text-right font-normal py-1">Importe vendido</th></tr>
            </thead>
            <tbody>
              {ventasDelDia.map((v) => (
                <tr key={v.folio} className="border-t"><td className="py-1">#{v.folio} — {v.nombreCliente}</td><td className="text-right py-1">${v.total.toFixed(2)}</td></tr>
              ))}
              {ventasDelDia.length === 0 && <tr><td className="text-slate-400 py-2">Sin ventas este día.</td></tr>}
            </tbody>
            {ventasDelDia.length > 0 && (
              <tfoot>
                <tr className="border-t font-semibold"><td className="py-1">Total de tickets: {totalTicketsDia}</td><td className="text-right py-1">${totalVendido.toFixed(2)}</td></tr>
                <tr><td className="py-1 text-slate-500">Ticket promedio</td><td className="text-right py-1 text-slate-500">${ticketPromedioDia.toFixed(2)}</td></tr>
              </tfoot>
            )}
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
              <select
                value={nuevoProveedor.proveedor}
                onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, proveedor: e.target.value })}
                className="border rounded px-2 py-1 text-xs flex-1"
              >
                <option value="">Elige un proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              <input placeholder="Concepto" value={nuevoProveedor.concepto} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, concepto: e.target.value })} className="border rounded px-2 py-1 text-xs flex-1" />
              <input placeholder="Monto" type="number" value={nuevoProveedor.monto} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, monto: e.target.value })} className="border rounded px-2 py-1 text-xs w-20" />
              <button onClick={registrarPagoProveedor} className="px-2 py-1 rounded text-white text-xs" style={{ background: SKY_DARK }}>Guardar</button>
            </div>
          )}
          {proveedores.length === 0 && mostrarProveedor && (
            <p className="text-[10px] text-amber-600 mb-2">
              Aún no tienes proveedores dados de alta. Ve a Administración → Proveedores para agregarlos.
            </p>
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

function mesISO(d) {
  return d.toISOString().slice(0, 7); // AAAA-MM
}

function diasEnMes(mesStr) {
  const [y, m] = mesStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function datosDelMes(mes, ventas, dashboard, pagosProveedores) {
  const ventasDelMes = ventas.filter((v) => v.estatus === "venta" && v.fecha && v.fecha.slice(0, 7) === mes);
  const vendidoReal = ventasDelMes.reduce((s, v) => s + v.total, 0);
  const todosPagos = ventas.flatMap((v) => (v.pagos || []));
  const cobradoReal = todosPagos
    .filter((p) => p.fecha && p.fecha.slice(0, 7) === mes)
    .reduce((s, p) => s + p.monto, 0);
  const gastosReal = (pagosProveedores || [])
    .filter((p) => p.fecha && p.fecha.slice(0, 7) === mes)
    .reduce((s, p) => s + Number(p.monto || 0), 0);
  const hayDatosReales = ventasDelMes.length > 0;
  const manual = (dashboard.historialManual || []).find((h) => h.mes === mes);
  const meta = Number((dashboard.metasPorMes || {})[mes]) || Number(manual?.meta) || 0;
  if (hayDatosReales) {
    return { vendido: vendidoReal, cobrado: cobradoReal, gastos: gastosReal, caja: cobradoReal - gastosReal, meta, origen: "real", tickets: ventasDelMes.length };
  }
  if (manual) {
    const cobradoManual = Number(manual.cobrado) || 0;
    return { vendido: Number(manual.vendido) || 0, cobrado: cobradoManual, gastos: gastosReal, caja: cobradoManual - gastosReal, meta, origen: "manual", tickets: 0 };
  }
  return { vendido: 0, cobrado: 0, gastos: gastosReal, caja: -gastosReal, meta, origen: "sin_datos", tickets: 0 };
}

function CorteMensual({ ventas, pagosProveedores }) {
  const [mes, setMes] = useState(mesISO(new Date()));

  const esDelMes = (isoFecha) => isoFecha.slice(0, 7) === mes;

  const ventasDelMes = ventas.filter((v) => v.estatus === "venta" && esDelMes(v.fecha));
  const totalVendido = ventasDelMes.reduce((s, v) => s + v.total, 0);
  const totalTicketsMes = ventasDelMes.length;
  const ticketPromedioMes = totalTicketsMes > 0 ? totalVendido / totalTicketsMes : 0;

  const todosPagos = ventas.flatMap((v) => (v.pagos || []).map((p) => ({ ...p, folio: v.folio, cliente: v.nombreCliente })));
  const pagosDelMes = todosPagos.filter((p) => esDelMes(p.fecha));
  const anticipos = pagosDelMes.filter((p) => p.tipo === "anticipo");
  const liquidaciones = pagosDelMes.filter((p) => p.tipo === "liquidacion");
  const ventasCompletas = pagosDelMes.filter((p) => p.tipo === "venta_completa");
  const totalAnticipos = anticipos.reduce((s, p) => s + p.monto, 0);
  const totalLiquidaciones = liquidaciones.reduce((s, p) => s + p.monto, 0);
  const totalCobradoMes = totalAnticipos + totalLiquidaciones + ventasCompletas.reduce((s, p) => s + p.monto, 0);

  const notasConSaldo = ventas.filter((v) => (v.estatus === "venta" || v.estatus === "devolucion") && v.saldo > 0);
  const totalSaldoPendiente = notasConSaldo.reduce((s, v) => s + v.saldo, 0);

  const pagosProvDelMes = pagosProveedores.filter((p) => esDelMes(p.fecha));
  const totalProveedores = pagosProvDelMes.reduce((s, p) => s + Number(p.monto || 0), 0);
  const debeHaberCaja = totalCobradoMes - totalProveedores;

  function cambiarMes(delta) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(mesISO(d));
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="text-xl font-bold text-slate-800">Corte del mes</h2>
        <button onClick={() => imprimirElemento("corte-mes-imprimible")} className="px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1">
          <Printer size={16} /> Imprimir corte del mes
        </button>
      </div>
      <div className="flex items-center gap-2 mb-5 bg-white border rounded-xl px-3 py-2 w-fit">
        <button onClick={() => cambiarMes(-1)} className="p-1.5 rounded-lg hover:bg-sky-100">
          <ChevronLeft size={18} />
        </button>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="border-none text-sm font-medium focus:outline-none" />
        <button onClick={() => cambiarMes(1)} className="p-1.5 rounded-lg hover:bg-sky-100">
          <ChevronRight size={18} />
        </button>
        {mes !== mesISO(new Date()) && (
          <button onClick={() => setMes(mesISO(new Date()))} className="text-xs text-sky-600 underline ml-1">
            Mes actual
          </button>
        )}
      </div>

      <div id="corte-mes-imprimible">
        <p className="hidden print:block font-bold mb-3">Corte del mes — {mes}</p>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1 print:hidden">
          <TotalBox titulo="Vendido del mes" monto={totalVendido} color="#2563eb" subtitulo={`${ventasDelMes.length} nota(s)`} />
          <TotalBox titulo="Total de tickets del mes" monto={totalTicketsMes} color="#0f766e" subtitulo={`Ticket promedio: $${ticketPromedioMes.toFixed(2)}`} esConteo />
          <TotalBox titulo="Anticipos cobrados" monto={totalAnticipos} color="#0891b2" subtitulo={`${anticipos.length} pago(s)`} />
          <TotalBox titulo="Saldos cobrados al entregar" monto={totalLiquidaciones} color="#059669" subtitulo={`${liquidaciones.length} pago(s)`} />
          <TotalBox titulo="Total cobrado en el mes" monto={totalCobradoMes} color="#047857" subtitulo="Anticipos + liquidaciones + contado" />
          <TotalBox titulo="Saldo pendiente" monto={totalSaldoPendiente} color="#dc2626" subtitulo={`${notasConSaldo.length} nota(s) por cobrar`} />
          <TotalBox titulo="Pago a proveedores" monto={totalProveedores} color="#7c3aed" subtitulo={`${pagosProvDelMes.length} pago(s)`} />
          <TotalBox titulo="Debe haber en caja" monto={debeHaberCaja} color={debeHaberCaja >= 0 ? "#0d9488" : "#dc2626"} subtitulo="Cobrado del mes − pago a proveedores" />
        </div>

        <div className="hidden print:grid" style={{ gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 2, fontSize: 12, marginBottom: 16 }}>
          <div>
            <p><b>Vendido del mes:</b> ${totalVendido.toFixed(2)}</p>
            <p><b>Total de tickets del mes:</b> {totalTicketsMes}</p>
            <p><b>Ticket promedio:</b> ${ticketPromedioMes.toFixed(2)}</p>
            <p><b>Anticipos cobrados:</b> ${totalAnticipos.toFixed(2)}</p>
          </div>
          <div>
            <p><b>Saldos cobrados al entregar:</b> ${totalLiquidaciones.toFixed(2)}</p>
            <p><b>Total cobrado en el mes:</b> ${totalCobradoMes.toFixed(2)}</p>
            <p><b>Saldo pendiente:</b> ${totalSaldoPendiente.toFixed(2)}</p>
            <p><b>Pago a proveedores:</b> ${totalProveedores.toFixed(2)}</p>
            <p><b>Debe haber en caja:</b> ${debeHaberCaja.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Vendido del mes</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400"><th className="text-left font-normal py-1">No. de ticket</th><th className="text-right font-normal py-1">Importe vendido</th></tr>
              </thead>
              <tbody>
                {ventasDelMes.map((v) => (
                  <tr key={v.folio} className="border-t"><td className="py-1">#{v.folio} — {v.nombreCliente}</td><td className="text-right py-1">${v.total.toFixed(2)}</td></tr>
                ))}
                {ventasDelMes.length === 0 && <tr><td className="text-slate-400 py-2">Sin ventas este mes.</td></tr>}
              </tbody>
              {ventasDelMes.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold"><td className="py-1">Total de tickets: {totalTicketsMes}</td><td className="text-right py-1">${totalVendido.toFixed(2)}</td></tr>
                  <tr><td className="py-1 text-slate-500">Ticket promedio</td><td className="text-right py-1 text-slate-500">${ticketPromedioMes.toFixed(2)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Anticipos cobrados</h4>
            <table className="w-full text-xs">
              <tbody>
                {anticipos.map((p, i) => (
                  <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} ({p.formaPago})</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
                ))}
                {anticipos.length === 0 && <tr><td className="text-slate-400 py-2">Sin anticipos este mes.</td></tr>}
              </tbody>
              {anticipos.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold"><td className="py-1">Total de tickets: {anticipos.length}</td><td className="text-right py-1">${totalAnticipos.toFixed(2)}</td></tr>
                  <tr><td className="py-1 text-slate-500">Ticket promedio</td><td className="text-right py-1 text-slate-500">${(anticipos.length ? totalAnticipos / anticipos.length : 0).toFixed(2)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Saldos cobrados al entregar</h4>
            <table className="w-full text-xs">
              <tbody>
                {liquidaciones.map((p, i) => (
                  <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} ({p.formaPago})</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
                ))}
                {liquidaciones.length === 0 && <tr><td className="text-slate-400 py-2">Sin liquidaciones este mes.</td></tr>}
              </tbody>
              {liquidaciones.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold"><td className="py-1">Total de tickets: {liquidaciones.length}</td><td className="text-right py-1">${totalLiquidaciones.toFixed(2)}</td></tr>
                  <tr><td className="py-1 text-slate-500">Ticket promedio</td><td className="text-right py-1 text-slate-500">${(liquidaciones.length ? totalLiquidaciones / liquidaciones.length : 0).toFixed(2)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Total cobrado en el mes</h4>
            <table className="w-full text-xs">
              <tbody>
                {[...anticipos, ...liquidaciones, ...ventasCompletas].map((p, i) => (
                  <tr key={i} className="border-t"><td className="py-1">#{p.folio} {p.cliente} — {p.tipo.replace("_", " ")}</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
                ))}
                {pagosDelMes.length === 0 && <tr><td className="text-slate-400 py-2">Sin cobros este mes.</td></tr>}
              </tbody>
              {pagosDelMes.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold"><td className="py-1">Total de tickets: {pagosDelMes.length}</td><td className="text-right py-1">${totalCobradoMes.toFixed(2)}</td></tr>
                  <tr><td className="py-1 text-slate-500">Ticket promedio</td><td className="text-right py-1 text-slate-500">${(pagosDelMes.length ? totalCobradoMes / pagosDelMes.length : 0).toFixed(2)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Saldo pendiente</h4>
            <table className="w-full text-xs">
              <tbody>
                {notasConSaldo.map((v) => (
                  <tr key={v.folio} className="border-t"><td className="py-1">#{v.folio} {v.nombreCliente}</td><td className="text-right py-1">${v.saldo.toFixed(2)}</td></tr>
                ))}
                {notasConSaldo.length === 0 && <tr><td className="text-slate-400 py-2">Sin saldos pendientes.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-white border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Desglose — Pago a proveedores</h4>
            <table className="w-full text-xs">
              <tbody>
                {pagosProvDelMes.map((p) => (
                  <tr key={p.id} className="border-t"><td className="py-1">{p.proveedor} — {p.concepto}</td><td className="text-right py-1">${p.monto.toFixed(2)}</td></tr>
                ))}
                {pagosProvDelMes.length === 0 && <tr><td className="text-slate-400 py-2">Sin pagos a proveedores este mes.</td></tr>}
              </tbody>
              {pagosProvDelMes.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold"><td className="py-1">Total de pagos: {pagosProvDelMes.length}</td><td className="text-right py-1">${totalProveedores.toFixed(2)}</td></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
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
   ADMINISTRACIÓN (Usuarios + Proveedores)
   ============================================================ */
function ProveedoresView({ proveedores, setProveedores }) {
  const [nuevo, setNuevo] = useState({ nombre: "", contacto: "", telefono: "", notas: "" });

  function agregar() {
    if (!nuevo.nombre.trim()) return;
    setProveedores([...proveedores, { ...nuevo, id: uid() }]);
    setNuevo({ nombre: "", contacto: "", telefono: "", notas: "" });
  }
  function eliminar(id) {
    setProveedores(proveedores.filter((p) => p.id !== id));
  }

  return (
    <div className="p-4">
      <div className="bg-white border rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-end">
        <Field label="Nombre del proveedor" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Field label="Contacto" value={nuevo.contacto} onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })} />
        <Field label="Teléfono" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
        <Field label="Notas" value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} />
        <button onClick={agregar} className="px-3 py-2 rounded-lg text-white text-sm h-fit" style={{ background: SKY_DARK }}>
          Agregar proveedor
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Contacto</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-left px-3 py-2">Notas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2">{p.contacto}</td>
                <td className="px-3 py-2">{p.telefono}</td>
                <td className="px-3 py-2 text-slate-500">{p.notas}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => eliminar(p.id)} className="text-red-400"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {proveedores.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin proveedores dados de alta todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdministracionView({ usuarios, setUsuarios, proveedores, setProveedores }) {
  const [tab, setTab] = useState("usuarios");
  return (
    <div>
      <div className="flex gap-2 p-4 pb-0">
        <button onClick={() => setTab("usuarios")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "usuarios" ? "text-white" : "bg-white border"}`} style={tab === "usuarios" ? { background: SKY_DARK } : {}}>
          Usuarios
        </button>
        <button onClick={() => setTab("proveedores")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "proveedores" ? "text-white" : "bg-white border"}`} style={tab === "proveedores" ? { background: SKY_DARK } : {}}>
          Proveedores
        </button>
      </div>
      {tab === "usuarios" ? (
        <UsuariosView usuarios={usuarios} setUsuarios={setUsuarios} />
      ) : (
        <ProveedoresView proveedores={proveedores} setProveedores={setProveedores} />
      )}
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
      let lista = [...pacientes];
      filas.forEach((f) => {
        const nombre = f["nombre"] || f["name"] || "Sin nombre";
        const claveNombre = nombre.trim().toLowerCase();
        const visita = {
          id: uid(),
          fecha: f["fecha"] ? new Date(f["fecha"]).toISOString() || f["fecha"] : "",
          total: f["total"] || "",
          anticipo: f["anticipo"] || "",
          saldo: f["saldo"] || "",
          fechaPrometido: f["fecha prometido"] || f["fechaprometido"] || "",
          od: {
            esf: f["od_esf"] || "", cil: f["od_cil"] || "", eje: f["od_eje"] || "",
            di: f["od_di"] || "", add: f["od_add"] || "", obs: f["od_obs"] || "",
          },
          os: {
            esf: f["os_esf"] || "", cil: f["os_cil"] || "", eje: f["os_eje"] || "",
            di: f["os_di"] || "", add: f["os_add"] || "", obs: f["os_obs"] || "",
          },
          materialReceta: f["material_receta"] || "",
          cantidad: f["cantidad"] || "",
          descripcion: f["descripcion"] || "",
          precioMaterial: f["precio material"] || f["precio_material"] || "",
          totalProducto: f["total producto"] || f["total_producto"] || "",
          origen: "importado",
        };
        const idx = lista.findIndex((p) => p.nombre.trim().toLowerCase() === claveNombre);
        if (idx === -1) {
          lista.push({
            id: uid(),
            folio: lista.length + 1,
            nombre,
            domicilio: f["domicilio"] || "",
            colonia: f["colonia"] || "",
            cp: f["c.p."] || f["cp"] || "",
            mail: f["mail"] || f["email"] || "",
            telefono: f["telefono"] || f["phone"] || "",
            compras: [visita],
          });
        } else {
          const p = lista[idx];
          lista[idx] = {
            ...p,
            domicilio: p.domicilio || f["domicilio"] || "",
            colonia: p.colonia || f["colonia"] || "",
            cp: p.cp || f["c.p."] || f["cp"] || "",
            mail: p.mail || f["mail"] || f["email"] || "",
            telefono: p.telefono || f["telefono"] || f["phone"] || "",
            compras: [...(p.compras || []), visita],
          };
        }
      });
      setPacientes(lista);
      setResultado({ tipo: "Pacientes", cantidad: filas.length });
    } else {
      const key = { Armazones: "armazones", "Lentes graduados": "lentesGraduados", "Lentes de contacto": "lentesContacto", "Lentes solares": "lentesSolares" }[categoria];
      const listaInv = inventario[key] || [];
      const nuevos = filas.map((f, i) => ({
        id: uid(),
        nombre: f.nombre || f.name || "Sin nombre",
        precio: f.precio || f.price || "0",
        existencias: f.existencias || f.stock || "0",
        sku: `${key.slice(0, 3).toUpperCase()}-${(listaInv.length + i + 1).toString().padStart(4, "0")}`,
      }));
      setInventario({ ...inventario, [key]: [...listaInv, ...nuevos] });
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

  function subirImagenPrincipal(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLocal({ ...local, imagenPrincipal: reader.result });
    reader.readAsDataURL(file);
  }

  function quitarImagenPrincipal() {
    setLocal({ ...local, imagenPrincipal: "" });
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
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase block mb-1">Imagen principal de la tienda en línea</label>
          <p className="text-xs text-slate-400 mb-1">Se muestra de fondo en el inicio de la tienda. Mientras no la subas, ese espacio queda vacío.</p>
          {local.imagenPrincipal ? (
            <div className="mb-2">
              <img src={local.imagenPrincipal} alt="imagen principal" style={{ height: 120 }} className="rounded-lg mb-1" />
              <button onClick={quitarImagenPrincipal} className="text-xs text-red-500 underline block">Quitar imagen</button>
            </div>
          ) : (
            <div className="h-24 rounded-lg bg-slate-100 border border-dashed flex items-center justify-center text-xs text-slate-400 mb-2">
              Sin imagen todavía
            </div>
          )}
          <input type="file" accept="image/*" onChange={subirImagenPrincipal} className="text-sm" />
        </div>
        <Field label="Dirección" value={local.direccion} onChange={(e) => setLocal({ ...local, direccion: e.target.value })} />
        <Field label="Teléfono" value={local.telefono} onChange={(e) => setLocal({ ...local, telefono: e.target.value })} />
        <Field label="Correo de contacto" value={local.mail} onChange={(e) => setLocal({ ...local, mail: e.target.value })} />
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar configuración
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 mb-1">Redes sociales de la tienda en línea</h3>
        <Field label="Facebook (URL)" value={local.redesSociales?.facebook || ""} onChange={(e) => setLocal({ ...local, redesSociales: { ...local.redesSociales, facebook: e.target.value } })} />
        <Field label="X / Twitter (URL)" value={local.redesSociales?.x || ""} onChange={(e) => setLocal({ ...local, redesSociales: { ...local.redesSociales, x: e.target.value } })} />
        <Field label="Instagram (URL)" value={local.redesSociales?.instagram || ""} onChange={(e) => setLocal({ ...local, redesSociales: { ...local.redesSociales, instagram: e.target.value } })} />
        <Field label="TikTok (URL)" value={local.redesSociales?.tiktok || ""} onChange={(e) => setLocal({ ...local, redesSociales: { ...local.redesSociales, tiktok: e.target.value } })} />
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar redes sociales
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 mb-1">Contenido de páginas de la tienda (pie de página)</h3>
        <p className="text-xs text-slate-500">
          Mientras no llenes un campo, el visitante verá "Contenido próximamente" al abrir ese enlace.
        </p>
        {[
          ["manifiesto", "Nuestro manifiesto"],
          ["politicaIntegridad", "Política de integridad"],
          ["avisoPrivacidad", "Aviso de privacidad (ya viene con un texto sugerido)"],
          ["rastreoPedido", "Rastrear mi pedido"],
          ["trabajaConNosotros", "Trabaja con nosotros"],
          ["preguntasFrecuentes", "Preguntas frecuentes"],
          ["devolucionesGarantias", "Devoluciones y garantías"],
          ["terminosCondiciones", "Términos y condiciones"],
          ["lentesComputadora", "Lentes pa' la compu"],
          ["facturacionElectronica", "Facturación electrónica"],
        ].map(([clave, label]) => (
          <div key={clave}>
            <label className="text-xs font-medium text-slate-500 uppercase block mb-1">{label}</label>
            <textarea
              value={local.contenidoPaginas?.[clave] ?? (clave === "avisoPrivacidad" ? AVISO_PRIVACIDAD_DEFAULT : "")}
              onChange={(e) => setLocal({ ...local, contenidoPaginas: { ...local.contenidoPaginas, [clave]: e.target.value } })}
              rows={3}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
        ))}
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar contenido
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
   TIENDA EN LÍNEA (acceso único, estilo e-commerce)
   ============================================================ */
function useSesionCliente() {
  const [sesionCliente, setSesionClienteState] = useState(() => {
    try {
      const raw = localStorage.getItem("spektrum_sesion_cliente");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const setSesionCliente = (s) => {
    setSesionClienteState(s);
    try {
      if (s) localStorage.setItem("spektrum_sesion_cliente", JSON.stringify(s));
      else localStorage.removeItem("spektrum_sesion_cliente");
    } catch {}
  };
  return [sesionCliente, setSesionCliente];
}

function BotonNegro({ children, ...props }) {
  return (
    <button
      {...props}
      className={`w-full py-3 rounded-full bg-black text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-40 ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function BotonContorno({ children, ...props }) {
  return (
    <button
      {...props}
      className={`w-full py-3 rounded-full border border-black text-black text-sm font-medium hover:bg-slate-50 transition-colors ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

/* ---------- Drawer lateral genérico ---------- */
function DrawerLateral({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm h-full overflow-y-auto p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-black">
          <X size={22} />
        </button>
        {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Drawer de acceso: empleado o cliente ---------- */
function AccesoDrawer({ open, onClose, pasoInicial, usuarios, setUsuarios, onLoginEmpleado, pacientes, setPacientes, onLoginCliente }) {
  const [paso, setPaso] = useState("elegir"); // elegir | empleado | cliente
  const [empUsuario, setEmpUsuario] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empError, setEmpError] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteMail, setClienteMail] = useState("");
  const [clienteError, setClienteError] = useState("");

  useEffect(() => {
    if (open) setPaso(pasoInicial || "elegir");
  }, [open, pasoInicial]);

  function reset() {
    setPaso("elegir");
    setEmpUsuario("");
    setEmpPassword("");
    setEmpError("");
    setClienteNombre("");
    setClienteTelefono("");
    setClienteMail("");
    setClienteError("");
  }

  function cerrar() {
    reset();
    onClose();
  }

  function entrarEmpleado() {
    setEmpError("");
    const esPrimerAcceso = usuarios.length === 0;
    if (!empUsuario || !empPassword) {
      setEmpError("Completa usuario y contraseña.");
      return;
    }
    if (esPrimerAcceso) {
      const admin = { id: uid(), nombre: empUsuario, password: empPassword, rol: "ADMIN" };
      setUsuarios([admin]);
      onLoginEmpleado({ nombre: admin.nombre, rol: admin.rol });
      cerrar();
      return;
    }
    const encontrado = usuarios.find(
      (u) => u.nombre.trim().toLowerCase() === empUsuario.trim().toLowerCase() && u.password === empPassword
    );
    if (!encontrado) {
      setEmpError("Usuario o contraseña incorrectos.");
      return;
    }
    onLoginEmpleado({ nombre: encontrado.nombre, rol: encontrado.rol });
    cerrar();
  }

  function entrarCliente() {
    setClienteError("");
    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      setClienteError("Nombre y teléfono son obligatorios.");
      return;
    }
    let paciente = pacientes.find((p) => p.telefono && p.telefono.trim() === clienteTelefono.trim());
    if (!paciente) {
      paciente = {
        id: uid(),
        folio: pacientes.length + 1,
        nombre: clienteNombre.trim(),
        telefono: clienteTelefono.trim(),
        mail: clienteMail.trim(),
        compras: [],
      };
      setPacientes([...pacientes, paciente]);
    } else if (!paciente.mail && clienteMail) {
      setPacientes(pacientes.map((p) => (p.id === paciente.id ? { ...p, mail: clienteMail.trim() } : p)));
    }
    onLoginCliente({ nombre: paciente.nombre, telefono: paciente.telefono, mail: paciente.mail || clienteMail, pacienteId: paciente.id });
    cerrar();
  }

  return (
    <DrawerLateral open={open} onClose={cerrar} title={paso === "elegir" ? "Ingresa a tu cuenta" : undefined}>
      {paso === "elegir" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">¿Cómo quieres ingresar?</p>
          <BotonNegro onClick={() => setPaso("empleado")}>Soy empleado</BotonNegro>
          <BotonContorno onClick={() => setPaso("cliente")}>Soy cliente</BotonContorno>
        </div>
      )}

      {paso === "empleado" && (
        <div>
          <button onClick={() => setPaso("elegir")} className="text-xs text-slate-400 mb-3">← Volver</button>
          <h2 className="text-xl font-semibold mb-1">Acceso de personal</h2>
          <p className="text-sm text-slate-500 mb-4">
            {usuarios.length === 0 ? "Primer acceso — crea la cuenta de administrador." : "Usa tu usuario y contraseña asignados."}
          </p>
          <Field label="Usuario" value={empUsuario} onChange={(e) => setEmpUsuario(e.target.value)} />
          <Field label="Contraseña" type="password" value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} />
          {empError && <p className="text-xs text-red-600 mb-2">{empError}</p>}
          <BotonNegro onClick={entrarEmpleado} className="mt-2">
            {usuarios.length === 0 ? "Crear cuenta y entrar" : "Iniciar sesión"}
          </BotonNegro>
        </div>
      )}

      {paso === "cliente" && (
        <div>
          <button onClick={() => setPaso("elegir")} className="text-xs text-slate-400 mb-3">← Volver</button>
          <h2 className="text-xl font-semibold mb-1">Tu cuenta</h2>
          <p className="text-sm text-slate-500 mb-4">
            Con tu nombre y teléfono guardamos tus pedidos, tu receta y tu historial para la próxima vez.
          </p>
          <Field label="Nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
          <Field label="Teléfono (WhatsApp)" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
          <Field label="Correo (opcional)" value={clienteMail} onChange={(e) => setClienteMail(e.target.value)} />
          {clienteError && <p className="text-xs text-red-600 mb-2">{clienteError}</p>}
          <BotonNegro onClick={entrarCliente} className="mt-2">Entrar</BotonNegro>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">o</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <BotonContorno onClick={() => setClienteError("El registro con Google todavía no está conectado — por ahora usa tu nombre y teléfono.")}>
            Continuar con Google
          </BotonContorno>
          <p className="text-xs text-slate-400 mt-3">Si ya tienes cuenta, solo captura el mismo teléfono para reconocerte.</p>
        </div>
      )}
    </DrawerLateral>
  );
}

/* ---------- Header de la tienda ---------- */
function TiendaHeader({ config, sesionCliente, sesionStaff, carritoCount, onAbrirCarrito, onAbrirAcceso, onIrCategoria, onIrInicio, onVolverPanel, categoriaActiva }) {
  const categorias = [
    { key: "armazones", label: "Armazones" },
    { key: "lentesGraduados", label: "Lentes graduados" },
    { key: "lentesContacto", label: "Lentes de contacto" },
    { key: "lentesSolares", label: "Lentes solares" },
    { key: "accesorios", label: "Accesorios" },
  ];
  return (
    <div className="bg-white border-b sticky top-0 z-30">
      <div className="text-center text-xs bg-black text-white py-1.5">Bienvenido a {NOMBRE_OPTICA} — agenda tu examen de la vista gratis</div>
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <button onClick={onIrInicio} className="flex items-center gap-2">
          {config?.logo ? <img src={config.logo} alt="logo" style={{ height: 36 }} /> : <span className="font-bold text-lg tracking-wide">{NOMBRE_OPTICA.toUpperCase()}</span>}
        </button>
        <div className="hidden md:flex gap-6 text-sm font-medium">
          {categorias.map((c) => (
            <button
              key={c.key}
              onClick={() => onIrCategoria(c.key)}
              className={`hover:text-black ${categoriaActiva === c.key ? "text-black underline" : "text-slate-500"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {sesionStaff && (
            <button onClick={onVolverPanel} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hidden sm:block">
              Volver al panel
            </button>
          )}
          <button onClick={onAbrirAcceso} className="flex items-center gap-1 text-sm">
            <UserCog size={20} />
            <span className="hidden sm:inline">{sesionCliente ? sesionCliente.nombre.split(" ")[0] : "Cuenta"}</span>
          </button>
          <button onClick={onAbrirCarrito} className="relative">
            <ShoppingCart size={20} />
            {carritoCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {carritoCount}
              </span>
            )}
          </button>
        </div>
      </div>
      <div className="flex md:hidden gap-4 overflow-x-auto px-4 pb-3 text-sm font-medium">
        {categorias.map((c) => (
          <button key={c.key} onClick={() => onIrCategoria(c.key)} className={`whitespace-nowrap ${categoriaActiva === c.key ? "text-black underline" : "text-slate-500"}`}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Inicio de la tienda ---------- */
function TiendaInicio({ config, onIrCategoria, onAgendar }) {
  return (
    <div>
      <div className="relative">
        {config?.imagenPrincipal ? (
          <img src={config.imagenPrincipal} alt="Spektrum Ópticas" className="w-full h-auto block" />
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: 380, background: "#f4f4f4" }}>
            <p className="text-xs text-slate-300">Sube tu imagen principal desde Configuración</p>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-end">
          <div className="pr-6 sm:pr-14 max-w-xs sm:max-w-sm text-left">
            {config?.logo ? (
              <img
                src={config.logo}
                alt="Spektrum Ópticas"
                style={{ height: 119, mixBlendMode: "multiply" }}
                className="mb-4"
              />
            ) : (
              <h1 className="text-4xl sm:text-5xl font-semibold mb-4">Spektrum Ópticas</h1>
            )}
            <div className="flex flex-col gap-3 max-w-[220px]">
              <button onClick={onAgendar} className="px-6 py-3 rounded-full bg-white border border-black text-sm font-medium">Agendar examen</button>
              <button onClick={() => onIrCategoria("armazones")} className="px-6 py-3 rounded-full bg-black text-white text-sm font-medium">¡Yo quiero!</button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: "armazones", label: "Armazones" },
          { key: "lentesGraduados", label: "Graduados" },
          { key: "lentesContacto", label: "Contacto" },
          { key: "lentesSolares", label: "Solares" },
          { key: "accesorios", label: "Accesorios" },
        ].map((c) => (
          <button key={c.key} onClick={() => onIrCategoria(c.key)} className="border rounded-2xl py-8 px-3 text-center hover:shadow-md transition-shadow">
            <p className="font-medium">{c.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Categoría: filtros + grid ---------- */
/* ---------- Visor de páginas de contenido (CMS ligero) ---------- */
function ContenidoPaginaDrawer({ open, onClose, titulo, contenido }) {
  return (
    <DrawerLateral open={open} onClose={onClose} title={titulo}>
      {contenido ? (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{contenido}</p>
      ) : (
        <p className="text-sm text-slate-400">Contenido próximamente.</p>
      )}
    </DrawerLateral>
  );
}

/* ---------- Mapa de ubicación ---------- */
function MapaUbicacion({ direccion }) {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ height: 260 }}>
      {direccion ? (
        <iframe
          title="Ubicación"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          src={`https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50">
          Agrega tu dirección en Configuración para mostrar el mapa
        </div>
      )}
    </div>
  );
}

/* ---------- Pie de página ---------- */
function TiendaFooter({ config, setConfig, onIrInicio, onIrCategoria, onAbrirCuenta, onAbrirExamen, onAbrirReceta }) {
  const [paginaAbierta, setPaginaAbierta] = useState(null); // {titulo, contenido}
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [correoNewsletter, setCorreoNewsletter] = useState("");
  const [mensajeNewsletter, setMensajeNewsletter] = useState("");

  const contenido = config?.contenidoPaginas || {};
  const redes = config?.redesSociales || {};

  function abrirPagina(clave, titulo, textoPorDefecto) {
    setPaginaAbierta({ titulo, contenido: contenido[clave] || textoPorDefecto || "" });
  }

  function suscribir() {
    if (!correoNewsletter.trim()) return;
    const suscriptores = config?.suscriptores || [];
    if (suscriptores.some((s) => s.email.toLowerCase() === correoNewsletter.trim().toLowerCase())) {
      setMensajeNewsletter("Ya estabas suscrito.");
      return;
    }
    setConfig({ ...config, suscriptores: [...suscriptores, { email: correoNewsletter.trim(), fecha: new Date().toISOString() }] });
    setCorreoNewsletter("");
    setMensajeNewsletter("¡Listo! Ya estás suscrito.");
  }

  const enlace = "text-left hover:underline text-slate-300 hover:text-white text-sm";

  return (
    <div className="bg-black text-white mt-10">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
        <div className="flex flex-col gap-2">
          <h4 className="font-semibold mb-1">Productos</h4>
          <button onClick={onIrInicio} className={enlace}>Nuestros lentes y micas</button>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-semibold mb-1">Templos</h4>
          <button onClick={() => setMapaAbierto(true)} className={enlace}>Ubicaciones</button>
          <button onClick={onAbrirExamen} className={enlace}>Examen de la vista</button>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-semibold mb-1">Nosotros</h4>
          <button onClick={() => abrirPagina("manifiesto", "Nuestro manifiesto")} className={enlace}>Nuestro Manifiesto</button>
          <button onClick={() => abrirPagina("politicaIntegridad", "Política de integridad")} className={enlace}>Política de integridad</button>
          <button onClick={() => abrirPagina("avisoPrivacidad", "Aviso de Privacidad", AVISO_PRIVACIDAD_DEFAULT)} className={enlace}>Aviso de Privacidad</button>
          <button onClick={() => abrirPagina("rastreoPedido", "Rastrear mi pedido")} className={enlace}>Rastrear mi Pedido</button>
          <button onClick={() => abrirPagina("trabajaConNosotros", "Trabaja con nosotros")} className={enlace}>Trabaja con nosotros</button>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-semibold mb-1">Más enlaces</h4>
          <button onClick={onAbrirCuenta} className={enlace}>Mi cuenta {NOMBRE_OPTICA}</button>
          <button onClick={() => abrirPagina("preguntasFrecuentes", "Preguntas frecuentes")} className={enlace}>Preguntas frecuentes</button>
          <button onClick={onAbrirReceta} className={enlace}>Cómo subir tu receta</button>
          <button onClick={() => abrirPagina("devolucionesGarantias", "Devoluciones y garantías")} className={enlace}>Devoluciones y garantías</button>
          <button onClick={() => abrirPagina("terminosCondiciones", "Términos y condiciones")} className={enlace}>Términos y condiciones</button>
          <button onClick={() => abrirPagina("lentesComputadora", "Lentes pa' la compu")} className={enlace}>Lentes pa' la compu</button>
          <button onClick={() => abrirPagina("facturacionElectronica", "Facturación electrónica")} className={enlace}>Facturación electrónica</button>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-semibold mb-1">¿Tienes alguna duda?</h4>
          {config?.telefono && (
            <a href={`https://wa.me/52${config.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={enlace}>
              WhatsApp
            </a>
          )}
          <h4 className="font-semibold mb-1 mt-2">Síguenos</h4>
          <div className="flex gap-3 text-slate-300">
            {redes.facebook && <a href={redes.facebook} target="_blank" rel="noreferrer" className="hover:text-white">Facebook</a>}
            {redes.x && <a href={redes.x} target="_blank" rel="noreferrer" className="hover:text-white">X</a>}
            {redes.instagram && <a href={redes.instagram} target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>}
            {redes.tiktok && <a href={redes.tiktok} target="_blank" rel="noreferrer" className="hover:text-white">TikTok</a>}
            {!redes.facebook && !redes.x && !redes.instagram && !redes.tiktok && (
              <span className="text-xs text-slate-500">Agrega tus redes desde Configuración</span>
            )}
          </div>
          <h4 className="font-semibold mb-1 mt-2">Contáctanos</h4>
          <p className="text-sm text-slate-300">{config?.mail || "optispektrum@hotmail.com"}</p>
          <p className="text-sm text-slate-300">{config?.telefono}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="border-t border-slate-700 pt-6">
          <h4 className="font-semibold mb-2 text-sm">Los chismes de {NOMBRE_OPTICA}</h4>
          <div className="flex gap-2 max-w-sm">
            <input
              value={correoNewsletter}
              onChange={(e) => setCorreoNewsletter(e.target.value)}
              placeholder="tu@correo.com"
              className="flex-1 rounded-full px-4 py-2 text-sm text-black"
            />
            <button onClick={suscribir} className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium">Suscribir</button>
          </div>
          {mensajeNewsletter && <p className="text-xs text-emerald-400 mt-2">{mensajeNewsletter}</p>}
          <p className="text-xs text-slate-500 mt-2">
            Al registrarte estás aceptando los{" "}
            <button onClick={() => abrirPagina("terminosCondiciones", "Términos y condiciones")} className="underline">términos y condiciones</button> y el{" "}
            <button onClick={() => abrirPagina("avisoPrivacidad", "Aviso de Privacidad", AVISO_PRIVACIDAD_DEFAULT)} className="underline">aviso de privacidad</button> de {NOMBRE_OPTICA}.
          </p>
        </div>
        <div className="border-t border-slate-700 mt-6 pt-6 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
          <p>{config?.direccion}</p>
          <p>Derechos Reservados {NOMBRE_OPTICA} © {new Date().getFullYear()}</p>
        </div>
      </div>

      <ContenidoPaginaDrawer
        open={!!paginaAbierta}
        onClose={() => setPaginaAbierta(null)}
        titulo={paginaAbierta?.titulo}
        contenido={paginaAbierta?.contenido}
      />
      <DrawerLateral open={mapaAbierto} onClose={() => setMapaAbierto(false)} title="Nuestra ubicación">
        <MapaUbicacion direccion={config?.direccion} />
        <p className="text-sm text-slate-600 mt-3">{config?.direccion}</p>
      </DrawerLateral>
    </div>
  );
}

function TiendaCategoria({ categoriaActiva, inventario, onVerProducto, onAgregarCarrito }) {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [filtroTratamiento, setFiltroTratamiento] = useState("");
  const [filtroReemplazo, setFiltroReemplazo] = useState("");
  const [filtroCosmetico, setFiltroCosmetico] = useState("");

  const lista = (inventario[categoriaActiva] || []).filter((a) => {
    if (categoriaActiva === "lentesGraduados") {
      return (
        (!filtroTipo || a.tipo === filtroTipo) &&
        (!filtroMaterial || a.material === filtroMaterial) &&
        (!filtroTratamiento || a.tratamiento === filtroTratamiento)
      );
    }
    if (categoriaActiva === "lentesContacto") {
      return (
        (!filtroReemplazo || a.tipoReemplazo === filtroReemplazo) &&
        (!filtroCosmetico || (filtroCosmetico === "si" ? a.cosmetico : !a.cosmetico))
      );
    }
    return true;
  });

  const nombresCategoria = {
    armazones: "Armazones",
    lentesGraduados: "Lentes graduados",
    lentesContacto: "Lentes de contacto",
    lentesSolares: "Lentes solares",
    accesorios: "Accesorios",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      <p className="text-xs text-slate-400 mb-2">Inicio / {nombresCategoria[categoriaActiva]}</p>
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg,#cfeaf5,#eaf6fb)", padding: "40px 24px" }}>
        <h1 className="text-2xl sm:text-3xl font-semibold">{nombresCategoria[categoriaActiva]}</h1>
      </div>

      {categoriaActiva === "lentesGraduados" && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Tipo (todos)</option>
            <option>Monofocal</option><option>Bifocal</option><option>Progresivo</option>
          </select>
          <select value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Material (todos)</option>
            <option>CR39</option><option>Policarbonato</option><option>Hi Index</option>
          </select>
          <select value={filtroTratamiento} onChange={(e) => setFiltroTratamiento(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Tratamiento (todos)</option>
            <option>Antireflejante</option><option>Antiblue</option><option>Fotocromático</option>
          </select>
        </div>
      )}
      {categoriaActiva === "lentesContacto" && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={filtroReemplazo} onChange={(e) => setFiltroReemplazo(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Tipo de reemplazo (todos)</option>
            <option>Mensual</option><option>Anual</option>
          </select>
          <select value={filtroCosmetico} onChange={(e) => setFiltroCosmetico(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Uso cosmético (todos)</option>
            <option value="si">Cosmético</option>
            <option value="no">No cosmético</option>
          </select>
        </div>
      )}

      <p className="text-sm text-slate-400 mb-4">{lista.length} artículo(s)</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {lista.map((a) => (
          <div key={a.sku} className="border rounded-2xl p-3 hover:shadow-md transition-shadow">
            <button onClick={() => onVerProducto({ ...a, categoria: categoriaActiva })} className="w-full text-left">
              <div className="rounded-xl mb-2 overflow-hidden" style={{ background: "#f4f4f4", height: 110 }}>
                {a.imagen && <img src={a.imagen} alt={a.nombre} className="w-full h-full object-cover" />}
              </div>
              <p className="text-sm font-medium truncate">{a.nombre}</p>
              <p className="text-sm text-slate-500">${a.precio} MXN</p>
            </button>
            <button
              onClick={() => onAgregarCarrito({ ...a, categoria: categoriaActiva })}
              className="w-full mt-2 py-1.5 rounded-full border border-black text-xs font-medium hover:bg-black hover:text-white transition-colors"
            >
              Agregar
            </button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-slate-400 col-span-full text-center py-10">Sin artículos disponibles con esos filtros.</p>}
      </div>
    </div>
  );
}

/* ---------- Detalle de producto (drawer) ---------- */
function TiendaProducto({ producto, open, onClose, onAgregarCarrito }) {
  if (!producto) return null;
  const specs = [];
  if (producto.tipo) specs.push(["Tipo", producto.tipo]);
  if (producto.material) specs.push(["Material", producto.material]);
  if (producto.tratamiento) specs.push(["Tratamiento", producto.tratamiento]);
  if (producto.rango) specs.push(["Rango de graduación", producto.rango]);
  if (producto.tipoReemplazo) specs.push(["Tipo de reemplazo", producto.tipoReemplazo]);
  if (producto.cosmetico !== undefined) specs.push(["Uso cosmético", producto.cosmetico ? "Sí" : "No"]);
  const requiereReceta = producto.categoria === "lentesGraduados" || producto.categoria === "lentesContacto";

  return (
    <DrawerLateral open={open} onClose={onClose}>
      <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: "#f4f4f4", height: 220 }}>
        {producto.imagen && <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover" />}
      </div>
      <h2 className="text-2xl font-semibold mb-1">{producto.nombre}</h2>
      <p className="text-lg mb-4">${producto.precio} MXN {requiereReceta && <span className="text-sm text-slate-400">| Requiere receta</span>}</p>
      {specs.length > 0 && (
        <table className="w-full text-sm mb-6">
          <tbody>
            {specs.map(([k, v]) => (
              <tr key={k} className="border-t">
                <td className="py-2 text-slate-500">{k}</td>
                <td className="py-2 text-right">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <BotonNegro onClick={() => { onAgregarCarrito(producto); onClose(); }}>Lo quiero comprar</BotonNegro>
    </DrawerLateral>
  );
}

/* ---------- Carrito (drawer) ---------- */
function TiendaCarrito({ open, onClose, carrito, setCarrito, onIrCheckout }) {
  const total = carrito.reduce((s, c) => s + Number(c.precio || 0), 0);
  return (
    <DrawerLateral open={open} onClose={onClose} title="Tu carrito">
      {carrito.length === 0 ? (
        <p className="text-sm text-slate-400">Tu carrito está vacío.</p>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {carrito.map((c) => (
              <div key={c.uidLinea} className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-sm font-medium">{c.nombre}</p>
                  <p className="text-xs text-slate-500">${c.precio} MXN</p>
                </div>
                <button onClick={() => setCarrito(carrito.filter((x) => x.uidLinea !== c.uidLinea))} className="text-slate-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold mb-4">
            <span>Total</span>
            <span>${total.toFixed(2)} MXN</span>
          </div>
          <BotonNegro onClick={onIrCheckout}>Continuar</BotonNegro>
        </>
      )}
    </DrawerLateral>
  );
}

/* ---------- Checkout (drawer) ---------- */
function TiendaCheckout({ open, onClose, carrito, sesionCliente, onAbrirAcceso, onConfirmar }) {
  const [receta, setReceta] = useState(null);
  const requiereReceta = carrito.some((c) => c.categoria === "lentesGraduados" || c.categoria === "lentesContacto");
  const total = carrito.reduce((s, c) => s + Number(c.precio || 0), 0);

  function subirReceta(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceta({ nombreArchivo: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }

  const faltaReceta = requiereReceta && !receta;

  return (
    <DrawerLateral open={open} onClose={onClose} title="Confirmar pedido">
      {!sesionCliente ? (
        <div>
          <p className="text-sm text-slate-500 mb-4">Necesitas iniciar sesión o registrarte para terminar tu pedido.</p>
          <BotonNegro onClick={onAbrirAcceso}>Ingresar / Registrarme</BotonNegro>
        </div>
      ) : (
        <div>
          <p className="text-sm mb-1">Cliente: <b>{sesionCliente.nombre}</b></p>
          <p className="text-sm text-slate-500 mb-4">{sesionCliente.telefono}</p>
          <div className="space-y-2 mb-4">
            {carrito.map((c) => (
              <div key={c.uidLinea} className="flex justify-between text-sm border-b pb-2">
                <span>{c.nombre}</span>
                <span>${c.precio}</span>
              </div>
            ))}
          </div>
          <p className="flex justify-between font-semibold mb-4">
            <span>Total</span><span>${total.toFixed(2)} MXN</span>
          </p>
          {requiereReceta && (
            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1">Sube tu receta (foto o PDF)</label>
              <input type="file" accept="image/*,.pdf" onChange={subirReceta} className="text-xs" />
              {receta && <p className="text-xs text-emerald-600 mt-1">Receta cargada: {receta.nombreArchivo}</p>}
            </div>
          )}
          {faltaReceta && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Necesitas subir tu receta para pedir lentes graduados o de contacto en línea.
            </div>
          )}
          <BotonNegro onClick={() => onConfirmar(receta)} disabled={carrito.length === 0 || faltaReceta}>
            Confirmar pedido
          </BotonNegro>
        </div>
      )}
    </DrawerLateral>
  );
}

/* ---------- Agendar cita ---------- */
function TiendaAgendar({ open, onClose, agenda, setAgenda, pacientes, setPacientes, sesionCliente, onAbrirAcceso, onListo }) {
  const [fecha, setFecha] = useState(fechaISO(new Date()));
  const [consultorio, setConsultorio] = useState("Consultorio 1");
  const [hora, setHora] = useState("");

  const ocupadas = agenda.filter((c) => c.fecha === fecha && c.consultorio === consultorio).map((c) => c.hora);
  const disponibles = HORAS.filter((h) => !ocupadas.includes(h));

  function agendar() {
    if (!hora || !sesionCliente) return;
    setAgenda([
      ...agenda,
      { id: uid(), fecha, hora, consultorio, pacienteId: sesionCliente.pacienteId, nombre: sesionCliente.nombre, estatus: "proxima", origen: "portal" },
    ]);
    const urlSitio = typeof window !== "undefined" ? window.location.origin : "";
    const msj = mensajeCitaConfirmada(sesionCliente.nombre, fecha, hora, consultorio, urlSitio);
    if (sesionCliente.telefono) abrirWhatsApp(sesionCliente.telefono, msj.whatsapp);
    if (sesionCliente.mail) abrirEmail(sesionCliente.mail, msj.email.asunto, msj.email.cuerpo);
    onListo(`Tu cita quedó agendada para el ${fecha} a las ${hora} (${consultorio}). Te enviamos la confirmación.`);
    onClose();
  }

  return (
    <DrawerLateral open={open} onClose={onClose} title="Agendar examen">
      {!sesionCliente ? (
        <div>
          <p className="text-sm text-slate-500 mb-4">Necesitas iniciar sesión o registrarte para agendar tu cita.</p>
          <BotonNegro onClick={onAbrirAcceso}>Ingresar / Registrarme</BotonNegro>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 mb-3">
            <select value={consultorio} onChange={(e) => { setConsultorio(e.target.value); setHora(""); }} className="border rounded-lg px-2 py-2 text-sm">
              <option>Consultorio 1</option>
              <option>Consultorio 2</option>
            </select>
            <input type="date" value={fecha} min={fechaISO(new Date())} onChange={(e) => { setFecha(e.target.value); setHora(""); }} className="border rounded-lg px-2 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-1 mb-4 max-h-40 overflow-y-auto">
            {disponibles.map((h) => (
              <button
                key={h}
                onClick={() => setHora(h)}
                className={`text-xs py-1.5 rounded ${hora === h ? "bg-black text-white" : "bg-slate-100"}`}
              >
                {h}
              </button>
            ))}
            {disponibles.length === 0 && <p className="text-xs text-slate-400 col-span-4">Sin horarios libres ese día.</p>}
          </div>
          <BotonNegro onClick={agendar} disabled={!hora}>Confirmar cita</BotonNegro>
        </div>
      )}
    </DrawerLateral>
  );
}

/* ---------- Orquestador principal de la tienda ---------- */
function Tienda({ pacientes, setPacientes, agenda, setAgenda, ventas, setVentas, inventario, config, setConfig, usuarios, setUsuarios, onLoginEmpleado, sesionStaff, onVolverPanel }) {
  const [vista, setVista] = useState("inicio"); // inicio | categoria
  const [categoriaActiva, setCategoriaActiva] = useState("armazones");
  const [carrito, setCarrito] = useState([]);
  const [productoVer, setProductoVer] = useState(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [accesoAbierto, setAccesoAbierto] = useState(false);
  const [accesoPasoInicial, setAccesoPasoInicial] = useState("elegir");
  const [agendarAbierto, setAgendarAbierto] = useState(false);
  const [recetaInfoAbierto, setRecetaInfoAbierto] = useState(false);
  const [sesionCliente, setSesionCliente] = useSesionCliente();
  const [mensajeFinal, setMensajeFinal] = useState("");

  function agregarCarrito(a) {
    setCarrito([...carrito, { ...a, uidLinea: uid() }]);
  }

  function irCategoria(cat) {
    setCategoriaActiva(cat);
    setVista("categoria");
    window.scrollTo(0, 0);
  }

  function abrirAcceso(pasoInicial) {
    setAccesoPasoInicial(pasoInicial || "elegir");
    setAccesoAbierto(true);
  }

  function abrirExamen() {
    if (!sesionCliente) {
      abrirAcceso("cliente");
      return;
    }
    setAgendarAbierto(true);
  }

  function abrirCuenta() {
    abrirAcceso("cliente");
  }

  function confirmarPedido(receta) {
    let paciente = pacientes.find((p) => p.id === sesionCliente.pacienteId);
    const folio = (ventas[ventas.length - 1]?.folio || 0) + 1;
    const total = carrito.reduce((s, c) => s + Number(c.precio || 0), 0);
    const nota = {
      folio,
      fecha: new Date().toISOString(),
      pacienteId: sesionCliente.pacienteId,
      nombreCliente: paciente?.nombre || sesionCliente.nombre,
      items: carrito,
      total,
      abono: 0,
      saldo: total,
      estatus: "presupuesto",
      formaPago: "pendiente",
      vendedor: "Tienda en línea",
      origen: "portal",
      recetaArchivo: receta,
    };
    setVentas([...ventas, nota]);
    setCarrito([]);
    setCheckoutAbierto(false);
    setMensajeFinal(`¡Listo! Tu pedido quedó registrado con folio #${folio}. Te avisamos por WhatsApp o correo en cuanto esté confirmado.`);
  }

  return (
    <div className="min-h-screen bg-white">
      <TiendaHeader
        config={config}
        sesionCliente={sesionCliente}
        sesionStaff={sesionStaff}
        carritoCount={carrito.length}
        onAbrirCarrito={() => setCarritoAbierto(true)}
        onAbrirAcceso={() => abrirAcceso("elegir")}
        onIrCategoria={irCategoria}
        onIrInicio={() => setVista("inicio")}
        onVolverPanel={onVolverPanel}
        categoriaActiva={vista === "categoria" ? categoriaActiva : null}
      />

      {mensajeFinal && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-sm text-center py-2 px-4">
          {mensajeFinal}
          <button onClick={() => setMensajeFinal("")} className="ml-3 underline">Cerrar</button>
        </div>
      )}

      {vista === "inicio" ? (
        <TiendaInicio config={config} onIrCategoria={irCategoria} onAgendar={abrirExamen} />
      ) : (
        <TiendaCategoria
          categoriaActiva={categoriaActiva}
          inventario={inventario}
          onVerProducto={setProductoVer}
          onAgregarCarrito={agregarCarrito}
        />
      )}

      <TiendaFooter
        config={config}
        setConfig={setConfig}
        onIrInicio={() => setVista("inicio")}
        onIrCategoria={irCategoria}
        onAbrirCuenta={abrirCuenta}
        onAbrirExamen={abrirExamen}
        onAbrirReceta={() => setRecetaInfoAbierto(true)}
      />

      <TiendaProducto producto={productoVer} open={!!productoVer} onClose={() => setProductoVer(null)} onAgregarCarrito={agregarCarrito} />
      <TiendaCarrito
        open={carritoAbierto}
        onClose={() => setCarritoAbierto(false)}
        carrito={carrito}
        setCarrito={setCarrito}
        onIrCheckout={() => {
          setCarritoAbierto(false);
          setCheckoutAbierto(true);
        }}
      />
      <TiendaCheckout
        open={checkoutAbierto}
        onClose={() => setCheckoutAbierto(false)}
        carrito={carrito}
        sesionCliente={sesionCliente}
        onAbrirAcceso={() => abrirAcceso("cliente")}
        onConfirmar={confirmarPedido}
      />
      <TiendaAgendar
        open={agendarAbierto}
        onClose={() => setAgendarAbierto(false)}
        agenda={agenda}
        setAgenda={setAgenda}
        pacientes={pacientes}
        setPacientes={setPacientes}
        sesionCliente={sesionCliente}
        onAbrirAcceso={() => abrirAcceso("cliente")}
        onListo={(msg) => setMensajeFinal(msg)}
      />
      <AccesoDrawer
        open={accesoAbierto}
        onClose={() => setAccesoAbierto(false)}
        pasoInicial={accesoPasoInicial}
        usuarios={usuarios}
        setUsuarios={setUsuarios}
        onLoginEmpleado={onLoginEmpleado}
        pacientes={pacientes}
        setPacientes={setPacientes}
        onLoginCliente={setSesionCliente}
      />
      <DrawerLateral open={recetaInfoAbierto} onClose={() => setRecetaInfoAbierto(false)} title="Cómo subir tu receta">
        <p className="text-sm text-slate-600 mb-4">
          Agrega tus lentes graduados o de contacto al carrito y da clic en "Continuar". En el paso de confirmar
          pedido vas a poder subir la foto o el PDF de tu receta antes de terminar tu compra.
        </p>
        <BotonNegro onClick={() => { setRecetaInfoAbierto(false); irCategoria("lentesGraduados"); }}>Ir a lentes graduados</BotonNegro>
      </DrawerLateral>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
/* ============================================================
   DASHBOARD DE CONTROL E INTELIGENCIA
   ============================================================ */
function aplicarModificadorMeta(comisionBase, pctMeta) {
  let factor;
  if (pctMeta <= 79) factor = 0.5;
  else if (pctMeta <= 90) factor = 0.75;
  else if (pctMeta <= 99) factor = 0.9;
  else {
    const capado = Math.min(pctMeta, 105);
    factor = 1 + Math.max(0, capado - 100) * 0.01;
  }
  return comisionBase * factor;
}

function barraTexto(pct) {
  const bloques = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return `[${"█".repeat(bloques)}${"░".repeat(10 - bloques)}] ${pct.toFixed(0)}%`;
}

function calcOptometrista(o, pctMeta, montoAuto) {
  const citasAtendidas = Number(o.citasAtendidas) || 0;
  const citasConCompra = Number(o.citasConCompra) || 0;
  const comprasCanceladas = Number(o.comprasCanceladas) || 0;
  const retrabajos = Number(o.retrabajos) || 0;
  const monto = montoAuto !== undefined ? montoAuto : Number(o.montoExamenesVenta) || 0;
  const efectividad = citasAtendidas > 0 ? ((citasConCompra - comprasCanceladas - retrabajos) / citasAtendidas) * 100 : 0;
  const retrabajoPct = citasAtendidas > 0 ? (retrabajos / citasAtendidas) * 100 : 0;
  const comisionBase = monto * 0.03;
  let comisionAjustada = aplicarModificadorMeta(comisionBase, pctMeta);
  const penalizado = retrabajoPct > 10;
  if (penalizado) comisionAjustada *= 0.9;
  return { efectividad, comisionBase, comisionAjustada, retrabajoPct, penalizado };
}

function calcVendedor(v, pctMeta, montoAuto, ventasHechasAuto) {
  const pacientesAsignados = Number(v.pacientesAsignados) || 0;
  const ventasHechas = ventasHechasAuto !== undefined ? ventasHechasAuto : Number(v.ventasHechas) || 0;
  const monto = montoAuto !== undefined ? montoAuto : Number(v.montoVentas) || 0;
  const efectividad = pacientesAsignados > 0 ? (ventasHechas / pacientesAsignados) * 100 : 0;
  const comisionBase = monto * 0.025;
  const comisionAjustada = aplicarModificadorMeta(comisionBase, pctMeta);
  return { efectividad, comisionBase, comisionAjustada, ventasHechas };
}

function DashboardView({ dashboard, setDashboard, ventas, pagosProveedores }) {
  const { optometristas, vendedores } = dashboard;
  const metasPorMes = dashboard.metasPorMes || {};
  const historialManual = dashboard.historialManual || [];
  const [nuevoOptoNombre, setNuevoOptoNombre] = useState("");
  const [nuevoVendNombre, setNuevoVendNombre] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [vendedorAsignado, setVendedorAsignado] = useState("");
  const [mesAnalisis, setMesAnalisis] = useState(mesISO(new Date()));
  const [vistaDashboard, setVistaDashboard] = useState("mensual"); // mensual | anual
  const [anioAnalisis, setAnioAnalisis] = useState(new Date().getFullYear());
  const [cargaManual, setCargaManual] = useState({ mes: mesISO(new Date()), vendido: "", cobrado: "", meta: "" });

  const datosMes = datosDelMes(mesAnalisis, ventas, dashboard, pagosProveedores);
  const meta = datosMes.meta;
  const alcanzado = datosMes.vendido; // siempre automático: vendido real del mes
  const pctMeta = meta > 0 ? (alcanzado / meta) * 100 : 0;

  const esMesActual = mesAnalisis === mesISO(new Date());
  const diasTotalesMes = diasEnMes(mesAnalisis);
  const diaActual = esMesActual ? new Date().getDate() : diasTotalesMes;
  const proyectadoVendido = diaActual > 0 ? (datosMes.vendido / diaActual) * diasTotalesMes : 0;
  const proyectadoCobrado = diaActual > 0 ? (datosMes.cobrado / diaActual) * diasTotalesMes : 0;
  const pctProyectado = meta > 0 ? (proyectadoVendido / meta) * 100 : 0;

  const ventasDelMes = ventas.filter((v) => v.estatus === "venta" && v.fecha && v.fecha.slice(0, 7) === mesAnalisis);

  function montoPorOptometrista(nombre) {
    const clave = (nombre || "").trim().toLowerCase();
    if (!clave) return { monto: 0, cantidad: 0 };
    const propias = ventasDelMes.filter((v) => (v.optometrista || "").trim().toLowerCase() === clave);
    return { monto: propias.reduce((s, v) => s + v.total, 0), cantidad: propias.length };
  }

  function ventasPorVendedor(nombre) {
    const clave = (nombre || "").trim().toLowerCase();
    if (!clave) return { monto: 0, cantidad: 0 };
    const propias = ventasDelMes.filter((v) => (v.vendedor || "").trim().toLowerCase() === clave);
    return { monto: propias.reduce((s, v) => s + v.total, 0), cantidad: propias.length };
  }

  function actualizarMetaMes(valor) {
    setDashboard({ ...dashboard, metasPorMes: { ...metasPorMes, [mesAnalisis]: valor } });
  }

  function guardarCargaManual() {
    if (!cargaManual.mes) return;
    const existe = historialManual.some((h) => h.mes === cargaManual.mes);
    const nuevoHistorial = existe
      ? historialManual.map((h) => (h.mes === cargaManual.mes ? { ...h, ...cargaManual, id: h.id } : h))
      : [...historialManual, { ...cargaManual, id: uid() }];
    const nuevasMetas = cargaManual.meta ? { ...metasPorMes, [cargaManual.mes]: cargaManual.meta } : metasPorMes;
    setDashboard({ ...dashboard, historialManual: nuevoHistorial, metasPorMes: nuevasMetas });
    setCargaManual({ mes: cargaManual.mes, vendido: "", cobrado: "", meta: "" });
  }

  function eliminarCargaManual(mes) {
    setDashboard({ ...dashboard, historialManual: historialManual.filter((h) => h.mes !== mes) });
  }

  function agregarOptometrista() {
    if (!nuevoOptoNombre.trim()) return;
    setDashboard({
      ...dashboard,
      optometristas: [
        ...optometristas,
        {
          id: uid(), nombre: nuevoOptoNombre, citasAtendidas: "", citasConCompra: "", citasSinCompra: "",
          comprasCanceladas: "", retrabajos: "", montoExamenesVenta: "",
        },
      ],
    });
    setNuevoOptoNombre("");
  }

  function actualizarOptometrista(id, campo, valor) {
    setDashboard({
      ...dashboard,
      optometristas: optometristas.map((o) => (o.id === id ? { ...o, [campo]: valor } : o)),
    });
  }

  function eliminarOptometrista(id) {
    setDashboard({ ...dashboard, optometristas: optometristas.filter((o) => o.id !== id) });
  }

  function agregarVendedor() {
    if (!nuevoVendNombre.trim()) return;
    setDashboard({
      ...dashboard,
      vendedores: [
        ...vendedores,
        { id: uid(), nombre: nuevoVendNombre, pacientesAsignados: "", posiblesVentas: "", ventasHechas: "", montoVentas: "" },
      ],
    });
    setNuevoVendNombre("");
  }

  function actualizarVendedor(id, campo, valor) {
    setDashboard({
      ...dashboard,
      vendedores: vendedores.map((v) => (v.id === id ? { ...v, [campo]: valor } : v)),
    });
  }

  function eliminarVendedor(id) {
    setDashboard({ ...dashboard, vendedores: vendedores.filter((v) => v.id !== id) });
  }

  function confirmarAsignacion() {
    if (!vendedorAsignado) return;
    setDashboard({
      ...dashboard,
      vendedores: vendedores.map((v) =>
        v.id === vendedorAsignado ? { ...v, pacientesAsignados: (Number(v.pacientesAsignados) || 0) + 1 } : v
      ),
    });
    setAsignando(false);
    setVendedorAsignado("");
  }

  const inputCelda = "w-20 border rounded px-1 py-1 text-xs text-center";

  return (
    <div className="p-4 space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setVistaDashboard("mensual")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${vistaDashboard === "mensual" ? "text-white" : "bg-white border"}`} style={vistaDashboard === "mensual" ? { background: SKY_DARK } : {}}>
          Dashboard mensual
        </button>
        <button onClick={() => setVistaDashboard("anual")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${vistaDashboard === "anual" ? "text-white" : "bg-white border"}`} style={vistaDashboard === "anual" ? { background: SKY_DARK } : {}}>
          Dashboard anual
        </button>
      </div>

      {vistaDashboard === "anual" ? (
        <DashboardAnual
          anio={anioAnalisis}
          setAnio={setAnioAnalisis}
          ventas={ventas}
          dashboard={dashboard}
          pagosProveedores={pagosProveedores}
          cargaManual={cargaManual}
          setCargaManual={setCargaManual}
          guardarCargaManual={guardarCargaManual}
          eliminarCargaManual={eliminarCargaManual}
        />
      ) : (
      <>
      <div className="bg-white border rounded-xl p-4 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-slate-500 uppercase">Mes de análisis</label>
        <input type="month" value={mesAnalisis} onChange={(e) => setMesAnalisis(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        {datosMes.origen === "manual" && <span className="text-xs text-amber-600">Usando datos cargados manualmente (sin ventas reales en el sistema para este mes)</span>}
        <button
          onClick={() => imprimirElemento("dashboard-mensual-imprimible")}
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Imprimir dashboard mensual
        </button>
      </div>

      <div id="dashboard-mensual-imprimible" className="dashboard-print-compact space-y-6">
      <p className="hidden print:block font-bold mb-1">Dashboard mensual — {mesAnalisis}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Meta mensual de la óptica</h3>
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <div>
              <label className="text-xs text-slate-500">Meta ($ MXN)</label>
              <input type="number" value={metasPorMes[mesAnalisis] || ""} onChange={(e) => actualizarMetaMes(e.target.value)} className="block border rounded-lg px-2 py-1.5 text-sm w-32" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Alcanzado (automático)</label>
              <p className="font-semibold text-lg" style={{ color: SKY_DARK }}>${alcanzado.toFixed(2)}</p>
            </div>
            <div className="text-2xl font-bold" style={{ color: SKY_DARK }}>{pctMeta.toFixed(1)}%</div>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div className="h-4 rounded-full transition-all" style={{ width: `${Math.min(100, pctMeta)}%`, background: SKY_DARK }} />
          </div>
          <p className="font-mono text-xs text-slate-500">{barraTexto(pctMeta)}</p>
          <p className="text-xs text-slate-400 mt-2">
            ≤79%: 50% de comisión · 80-90%: 75% · 91-99%: 90% · 100-105%: 100% + hasta 5% de bono adicional
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Proyectado del mes</h3>
          {esMesActual ? (
            <p className="text-xs text-slate-400 mb-2">Con base en el ritmo de venta de los primeros {diaActual} de {diasTotalesMes} días del mes.</p>
          ) : (
            <p className="text-xs text-slate-400 mb-2">Mes ya cerrado — se muestra el resultado final, no una proyección.</p>
          )}
          <div className="flex flex-wrap gap-4 mb-2">
            <div>
              <p className="text-xs text-slate-500">Vendido proyectado</p>
              <p className="font-semibold text-lg" style={{ color: SKY_DARK }}>${proyectadoVendido.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cobrado proyectado</p>
              <p className="font-semibold text-lg" style={{ color: "#059669" }}>${proyectadoCobrado.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">% de la meta proyectado</p>
              <p className="font-semibold text-lg">{pctProyectado.toFixed(1)}%</p>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(100, pctProyectado)}%`, background: pctProyectado >= 100 ? "#059669" : "#f59e0b" }} />
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">Optometristas</h3>
          <div className="flex gap-2">
            <input value={nuevoOptoNombre} onChange={(e) => setNuevoOptoNombre(e.target.value)} placeholder="Nombre del optometrista" className="border rounded-lg px-2 py-1.5 text-sm" />
            <button onClick={agregarOptometrista} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>+ Agregar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: BEIGE }}>
              <tr>
                <th className="text-left px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Citas atendidas</th>
                <th className="px-2 py-2">Citas con compra</th>
                <th className="px-2 py-2">Citas sin compra</th>
                <th className="px-2 py-2">Compras canceladas</th>
                <th className="px-2 py-2">Retrabajos</th>
                <th className="px-2 py-2">Monto exámenes con venta (automático)</th>
                <th className="px-2 py-2">% Efectividad</th>
                <th className="px-2 py-2">Comisión base</th>
                <th className="px-2 py-2">Comisión ajustada</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {optometristas.map((o) => {
                const { monto: montoAuto, cantidad: ventasAuto } = montoPorOptometrista(o.nombre);
                const r = calcOptometrista(o, pctMeta, montoAuto);
                return (
                  <tr key={o.id} className="border-t">
                    <td className="px-2 py-2 font-medium">{o.nombre}</td>
                    <td className="px-2 py-2"><input type="number" value={o.citasAtendidas} onChange={(e) => actualizarOptometrista(o.id, "citasAtendidas", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2"><input type="number" value={o.citasConCompra} onChange={(e) => actualizarOptometrista(o.id, "citasConCompra", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2"><input type="number" value={o.citasSinCompra} onChange={(e) => actualizarOptometrista(o.id, "citasSinCompra", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2"><input type="number" value={o.comprasCanceladas} onChange={(e) => actualizarOptometrista(o.id, "comprasCanceladas", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2">
                      <input type="number" value={o.retrabajos} onChange={(e) => actualizarOptometrista(o.id, "retrabajos", e.target.value)} className={inputCelda} />
                      {r.penalizado && <p className="text-[10px] text-red-500 mt-0.5">Supera 10% — penalizado</p>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <p className="font-semibold" style={{ color: SKY_DARK }}>${montoAuto.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">{ventasAuto} venta(s) reales</p>
                    </td>
                    <td className="px-2 py-2 text-center font-semibold">{r.efectividad.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center">${r.comisionBase.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center font-semibold" style={{ color: SKY_DARK }}>${r.comisionAjustada.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => eliminarOptometrista(o.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {optometristas.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-400 py-4">Sin optometristas registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          El monto de exámenes con venta se calcula solo, sumando las ventas reales del POS del mes elegido cuyo
          campo "Optometrista que atendió" coincida exactamente con este nombre.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-700">Vendedores</h3>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setAsignando(true)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm">
              [Asignar a Vendedor Autorizado]
            </button>
            <input value={nuevoVendNombre} onChange={(e) => setNuevoVendNombre(e.target.value)} placeholder="Nombre del vendedor" className="border rounded-lg px-2 py-1.5 text-sm" />
            <button onClick={agregarVendedor} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>+ Agregar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: BEIGE }}>
              <tr>
                <th className="text-left px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Pacientes asignados</th>
                <th className="px-2 py-2">Posibles ventas</th>
                <th className="px-2 py-2">Ventas hechas (automático)</th>
                <th className="px-2 py-2">Monto ventas (automático)</th>
                <th className="px-2 py-2">% Efectividad</th>
                <th className="px-2 py-2">Comisión ajustada</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const { monto: montoAuto, cantidad: ventasHechasAuto } = ventasPorVendedor(v.nombre);
                const r = calcVendedor(v, pctMeta, montoAuto, ventasHechasAuto);
                return (
                  <tr key={v.id} className="border-t">
                    <td className="px-2 py-2 font-medium">{v.nombre}</td>
                    <td className="px-2 py-2"><input type="number" value={v.pacientesAsignados} onChange={(e) => actualizarVendedor(v.id, "pacientesAsignados", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2"><input type="number" value={v.posiblesVentas} onChange={(e) => actualizarVendedor(v.id, "posiblesVentas", e.target.value)} className={inputCelda} /></td>
                    <td className="px-2 py-2 text-center font-semibold">{ventasHechasAuto}</td>
                    <td className="px-2 py-2 text-center font-semibold" style={{ color: SKY_DARK }}>${montoAuto.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center font-semibold">{r.efectividad.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center font-semibold" style={{ color: SKY_DARK }}>${r.comisionAjustada.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => eliminarVendedor(v.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {vendedores.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-4">Sin vendedores registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <Modal open={asignando} onClose={() => setAsignando(false)} title="Asignar paciente a vendedor autorizado">
        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Vendedor</span>
          <select value={vendedorAsignado} onChange={(e) => setVendedorAsignado(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
            <option value="">Elige un vendedor...</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </label>
        <button onClick={confirmarAsignacion} disabled={!vendedorAsignado} className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ background: SKY_DARK }}>
          Confirmar asignación
        </button>
      </Modal>
      </>
      )}
    </div>
  );
}

function DashboardAnual({ anio, setAnio, ventas, dashboard, pagosProveedores, cargaManual, setCargaManual, guardarCargaManual, eliminarCargaManual }) {
  const historialManual = dashboard.historialManual || [];
  const nombresMes = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const meses = Array.from({ length: 12 }, (_, i) => {
    const mesStr = `${anio}-${String(i + 1).padStart(2, "0")}`;
    return { mes: mesStr, nombre: nombresMes[i], ...datosDelMes(mesStr, ventas, dashboard, pagosProveedores) };
  });

  const totalAnioMeta = meses.reduce((s, m) => s + m.meta, 0);
  const totalAnioVendido = meses.reduce((s, m) => s + m.vendido, 0);
  const totalAnioCobrado = meses.reduce((s, m) => s + m.cobrado, 0);
  const totalAnioGastos = meses.reduce((s, m) => s + (m.gastos || 0), 0);
  const debeHaberCajaAnual = totalAnioCobrado - totalAnioGastos;
  const pctAnio = totalAnioMeta > 0 ? (totalAnioVendido / totalAnioMeta) * 100 : 0;
  const mesesConDatos = meses.filter((m) => m.origen !== "sin_datos");
  const promedioMensual = mesesConDatos.length > 0 ? totalAnioVendido / mesesConDatos.length : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-slate-500 uppercase">Año</label>
        <button onClick={() => setAnio(anio - 1)} className="p-1.5 rounded-lg hover:bg-sky-100"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-lg">{anio}</span>
        <button onClick={() => setAnio(anio + 1)} className="p-1.5 rounded-lg hover:bg-sky-100"><ChevronRight size={16} /></button>
        <button
          onClick={() => imprimirElemento("dashboard-anual-imprimible")}
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1"
        >
          <Printer size={16} /> Imprimir dashboard anual
        </button>
      </div>

      <div id="dashboard-anual-imprimible" className="dashboard-print-compact space-y-4">
      <p className="hidden print:block font-bold mb-1">Dashboard anual — {anio}</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <TotalBox titulo="Meta anual" monto={totalAnioMeta} color="#2563eb" />
        <TotalBox titulo="Vendido anual" monto={totalAnioVendido} color="#0f766e" subtitulo={`${pctAnio.toFixed(1)}% de la meta`} />
        <TotalBox titulo="Cobrado anual" monto={totalAnioCobrado} color="#059669" />
        <TotalBox titulo="Pago a proveedores anual" monto={totalAnioGastos} color="#7c3aed" />
        <TotalBox titulo="Debe haber en caja" monto={debeHaberCajaAnual} color={debeHaberCajaAnual >= 0 ? "#0d9488" : "#dc2626"} subtitulo="Cobrado anual − pago a proveedores" />
        <TotalBox titulo="Promedio mensual" monto={promedioMensual} color="#7c3aed" subtitulo={`${mesesConDatos.length} mes(es) con datos`} />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead style={{ background: BEIGE }}>
            <tr>
              <th className="text-left px-3 py-2">Mes</th>
              <th className="text-right px-3 py-2">Meta</th>
              <th className="text-right px-3 py-2">Vendido</th>
              <th className="text-right px-3 py-2">Cobrado</th>
              <th className="text-right px-3 py-2">% Meta</th>
              <th className="px-3 py-2">Avance</th>
              <th className="px-3 py-2">Origen</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => {
              const pct = m.meta > 0 ? (m.vendido / m.meta) * 100 : 0;
              return (
                <tr key={m.mes} className="border-t">
                  <td className="px-3 py-2 font-medium">{m.nombre}</td>
                  <td className="px-3 py-2 text-right">${m.meta.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">${m.vendido.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">${m.cobrado.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 w-32">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "#059669" : SKY_DARK }} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {m.origen === "real" && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Real (POS)</span>}
                    {m.origen === "manual" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                        Manual
                        <button onClick={() => eliminarCargaManual(m.mes)} className="text-amber-700 hover:text-red-600"><X size={10} /></button>
                      </span>
                    )}
                    {m.origen === "sin_datos" && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Sin datos</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-slate-700 mb-2">Cargar datos de un mes pasado (antes de usar el sistema)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Solo se usa para meses donde no hay ventas reales capturadas en el POS. Si el mes ya tiene ventas reales, esos
          datos tienen prioridad y esta carga se ignora en los cálculos.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-slate-500">Mes</label>
            <input type="month" value={cargaManual.mes} onChange={(e) => setCargaManual({ ...cargaManual, mes: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Vendido ($ MXN)</label>
            <input type="number" value={cargaManual.vendido} onChange={(e) => setCargaManual({ ...cargaManual, vendido: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm w-32" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Cobrado ($ MXN)</label>
            <input type="number" value={cargaManual.cobrado} onChange={(e) => setCargaManual({ ...cargaManual, cobrado: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm w-32" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Meta de ese mes ($ MXN)</label>
            <input type="number" value={cargaManual.meta} onChange={(e) => setCargaManual({ ...cargaManual, meta: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm w-32" />
          </div>
          <button onClick={guardarCargaManual} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>
            Guardar mes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [pacientes, setPacientes, loadedP, statusP, errorP, retryP, cargarP] = useStoredState(STORAGE_KEYS.pacientes, []);
  const [inventario, setInventario, loadedI, statusI, errorI, retryI, cargarI] = useStoredState(STORAGE_KEYS.inventario, emptyInventario());
  const [agenda, setAgenda, loadedA, statusA, errorA, retryA, cargarA] = useStoredState(STORAGE_KEYS.agenda, []);
  const [ventas, setVentas, loadedV, statusV, errorV, retryV, cargarV] = useStoredState(STORAGE_KEYS.ventas, []);
  const [usuarios, setUsuarios, loadedU, statusU, errorU, retryU, cargarU] = useStoredState(STORAGE_KEYS.usuarios, []);
  const [config, setConfig, loadedC, statusC, errorC, retryC, cargarC] = useStoredState(STORAGE_KEYS.config, emptyConfig());
  const [laboratorio, setLaboratorio, loadedL, statusL, errorL, retryL, cargarL] = useStoredState(STORAGE_KEYS.laboratorio, []);
  const [pagosProveedores, setPagosProveedores, loadedPP, statusPP, errorPP, retryPP, cargarPP] = useStoredState(STORAGE_KEYS.pagosProveedores, []);
  const [dashboard, setDashboard, loadedD, statusD, errorD, retryD, cargarD] = useStoredState(STORAGE_KEYS.dashboard, {
    optometristas: [],
    vendedores: [],
    metaMensual: { meta: "", alcanzado: "" },
    metasPorMes: {},
    historialManual: [],
  });
  const [proveedores, setProveedores, loadedPr, statusPr, errorPr, retryPr, cargarPr] = useStoredState(STORAGE_KEYS.proveedores, []);

  function recargarTodo() {
    cargarP(); cargarI(); cargarA(); cargarV(); cargarU(); cargarC(); cargarL(); cargarPP(); cargarD(); cargarPr();
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
    { nombre: "Dashboard", status: statusD, error: errorD, retry: retryD },
    { nombre: "Proveedores", status: statusPr, error: errorPr, retry: retryPr },
  ];
  const seccionesConError = secciones.filter((s) => s.status === "error");
  const guardandoAlgo = secciones.some((s) => s.status === "saving");

  const [seccion, setSeccion] = useState("agenda");
  const [presetPacienteId, setPresetPacienteId] = useState(null);
  const [previsualizarTienda, setPrevisualizarTienda] = useState(false);
  const [sesion, setSesion] = useSesion();

  const todoListo = loadedP && loadedI && loadedA && loadedV && loadedU && loadedC && loadedL && loadedPP && loadedD && loadedPr;

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
          exportarRespaldo({ pacientes, inventario, agenda, ventas, usuarios, config, laboratorio, pagosProveedores, dashboard, proveedores })
        }
        className="px-2 py-1 rounded bg-white border border-red-300 text-red-700 text-xs"
      >
        Descargar respaldo ahora (no pierdas tu trabajo)
      </button>
    </div>
  );

  if (!sesion || previsualizarTienda) {
    return (
      <div>
        {sesion && bannerGuardado}
        <Tienda
          pacientes={pacientes}
          setPacientes={setPacientes}
          agenda={agenda}
          setAgenda={setAgenda}
          ventas={ventas}
          setVentas={setVentas}
          inventario={inventario}
          config={config}
          setConfig={setConfig}
          usuarios={usuarios}
          setUsuarios={setUsuarios}
          onLoginEmpleado={setSesion}
          sesionStaff={sesion}
          onVolverPanel={() => setPrevisualizarTienda(false)}
        />
      </div>
    );
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
            onClick={() => setPrevisualizarTienda(true)}
            className="text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: SKY_DARK }}
          >
            Ver tienda en línea
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
            laboratorio={laboratorio}
            setLaboratorio={setLaboratorio}
          />
        )}
        {seccion === "inventario" && <InventarioView inventario={inventario} setInventario={setInventario} />}
        {seccion === "pacientes" && (
          <PacientesView pacientes={pacientes} setPacientes={setPacientes} agenda={agenda} setAgenda={setAgenda} ventas={ventas} setVentas={setVentas} config={config} />
        )}
        {seccion === "laboratorio" && (
          <LaboratorioView laboratorio={laboratorio} setLaboratorio={setLaboratorio} pacientes={pacientes} inventario={inventario} config={config} />
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
            proveedores={proveedores}
          />
        )}
        {seccion === "administracion" && (
          <AdministracionView usuarios={usuarios} setUsuarios={setUsuarios} proveedores={proveedores} setProveedores={setProveedores} />
        )}
        {seccion === "importar" && (
          <ImportarView pacientes={pacientes} setPacientes={setPacientes} inventario={inventario} setInventario={setInventario} />
        )}
        {seccion === "dashboard" && <DashboardView dashboard={dashboard} setDashboard={setDashboard} ventas={ventas} pagosProveedores={pagosProveedores} />}
        {seccion === "config" && (
          <ConfigView
            config={config}
            setConfig={setConfig}
            respaldoCompleto={{ pacientes, inventario, agenda, ventas, usuarios, config, laboratorio, pagosProveedores, dashboard, proveedores }}
            restaurarRespaldo={(datos) => {
              if (datos.pacientes) setPacientes(datos.pacientes);
              if (datos.inventario) setInventario(datos.inventario);
              if (datos.agenda) setAgenda(datos.agenda);
              if (datos.ventas) setVentas(datos.ventas);
              if (datos.usuarios) setUsuarios(datos.usuarios);
              if (datos.config) setConfig(datos.config);
              if (datos.laboratorio) setLaboratorio(datos.laboratorio);
              if (datos.pagosProveedores) setPagosProveedores(datos.pagosProveedores);
              if (datos.dashboard) setDashboard(datos.dashboard);
              if (datos.proveedores) setProveedores(datos.proveedores);
            }}
          />
        )}
      </div>
    </div>
  );
}
