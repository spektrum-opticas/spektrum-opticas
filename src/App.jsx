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

const SKY = "#000000";
const SKY_DARK = "#000000";
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
  googleClientId: "",
  paypalClientId: "",
  paypalModoProduccion: false,
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

async function generarPDFNota(nota, config) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;

  if (config?.logo) {
    try {
      const formato = config.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(config.logo, formato, 15, y - 8, 32, 16);
    } catch {}
  }
  doc.setFontSize(14);
  doc.text(NOMBRE_OPTICA, 52, y);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(config?.direccion || "", 52, y + 6);
  doc.text(`Tel: ${config?.telefono || ""}`, 52, y + 11);
  doc.setTextColor(0);

  y += 26;
  doc.setDrawColor(200);
  doc.line(15, y, 195, y);
  y += 10;

  doc.setFontSize(13);
  doc.text(nota.estatus === "presupuesto" ? "PRESUPUESTO" : "NOTA DE VENTA", 15, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Folio: #${nota.folio}`, 15, y); y += 6;
  doc.text(`Cliente: ${nota.nombreCliente}`, 15, y); y += 6;
  doc.text(`Fecha: ${new Date(nota.fecha).toLocaleString("es-MX")}`, 15, y); y += 10;

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Artículo", 15, y);
  doc.text("Precio", 190, y, { align: "right" });
  doc.setTextColor(0);
  y += 5;
  doc.line(15, y, 195, y);
  y += 6;

  nota.items.forEach((it) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(it.nombre), 15, y);
    doc.text(`$${Number(it.precio).toFixed(2)}`, 190, y, { align: "right" });
    y += 7;
  });

  y += 4;
  doc.line(15, y, 195, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`Total: $${nota.total.toFixed(2)} MXN`, 190, y, { align: "right" });
  y += 7;
  doc.setFontSize(10);
  doc.text(`Abono: $${nota.abono.toFixed(2)} — Saldo: $${nota.saldo.toFixed(2)}`, 190, y, { align: "right" });

  doc.save(`${nota.estatus}-folio-${nota.folio}.pdf`);
}

function textoNotaWhatsApp(nota) {
  const encabezado = nota.estatus === "presupuesto" ? "Presupuesto" : "Nota de venta";
  const lineas = nota.items.map((it) => `• ${it.nombre} — $${it.precio}`).join("\n");
  return (
    `${encabezado} — ${NOMBRE_OPTICA}\n` +
    `Folio #${nota.folio}\n` +
    `Cliente: ${nota.nombreCliente}\n\n` +
    `${lineas}\n\n` +
    `Total: $${nota.total.toFixed(2)} MXN\n` +
    `Abono: $${nota.abono.toFixed(2)} — Saldo: $${nota.saldo.toFixed(2)}\n\n` +
    `¡Gracias por tu preferencia en ${NOMBRE_OPTICA}!`
  );
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

function mensajeBienvenida(nombre) {
  return {
    email: {
      asunto: `¡Bienvenido/a a ${NOMBRE_OPTICA}, ${nombre}! 🤓`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `¡Tu cuenta en ${NOMBRE_OPTICA} quedó creada con éxito! Con ella puedes agendar tu examen de la vista, ` +
        `comprar armazones, lentes graduados, de contacto y solares, y llevar el seguimiento de tus pedidos.\n\n` +
        `Nos da mucho gusto tenerte con nosotros.\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Hola, ${nombre}! 👋 Tu cuenta en ${NOMBRE_OPTICA} quedó creada con éxito. ` +
      `Ya puedes agendar tu examen de la vista o comprar tus lentes desde nuestra tienda en línea. ¡Bienvenido/a! 🤓`,
  };
}

function mensajePedidoRecibido(nombre, folio) {
  return {
    email: {
      asunto: `Recibimos tu pedido #${folio} — ${NOMBRE_OPTICA}`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `Recibimos tu pedido con folio #${folio}. Nuestro equipo lo va a revisar y confirmar en breve; ` +
        `te avisaremos por este mismo medio en cuanto quede confirmado.\n\n` +
        `Gracias por tu preferencia.\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Hola, ${nombre}! 👋 Recibimos tu pedido #${folio} en ${NOMBRE_OPTICA}. ` +
      `Lo vamos a revisar y te avisamos en cuanto quede confirmado. ¡Gracias por tu preferencia! 🤓`,
  };
}

function mensajeEntregaFinal(nombre) {
  return {
    email: {
      asunto: `¡Gracias por tu compra, ${nombre}! 🙌`,
      cuerpo:
        `Hola, ${nombre}:\n\n` +
        `Queremos agradecerte por tu compra y por la confianza en ${NOMBRE_OPTICA} para el cuidado de tu salud visual. ` +
        `Esperamos que disfrutes muchísimo tus nuevos lentes.\n\n` +
        `Si tienes alguna duda o necesitas un ajuste, aquí estamos.\n\n` +
        `Con cariño,\nEl equipo de ${NOMBRE_OPTICA}`,
    },
    whatsapp:
      `¡Gracias por tu compra, ${nombre}! 🙌 Fue un gusto atenderte en ${NOMBRE_OPTICA}. ` +
      `Esperamos que disfrutes muchísimo tus nuevos lentes. Si necesitas algún ajuste, aquí estamos. 🤓✨`,
  };
}

function generarCodigoVerificacion() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function enviarCodigoPorCorreo(email, codigo, nombre) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/enviar-codigo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ email, codigo, nombre }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function abrirWhatsApp(telefono, mensaje) {
  const numero = String(telefono || "").replace(/\D/g, "");
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
              ? "bg-white text-slate-700 shadow"
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
        <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xl">
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

function enterActiva(fn) {
  return (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fn();
    }
  };
}

function Field({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <input
        {...props}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
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
  llego: "#4B5563",
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
            className="p-2 rounded-lg hover:bg-slate-100"
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
            className="p-2 rounded-lg hover:bg-slate-100"
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
                              className="text-[10px] px-1 rounded bg-slate-200 hover:bg-slate-300"
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
        className="text-slate-700 font-medium hover:underline truncate flex-1 text-left"
      >
        {cita.nombre}
      </button>
      {cita.origen === "portal" && (
        <span className="text-[9px] px-1 rounded bg-slate-800 text-white shrink-0" title="Agendada desde la tienda en línea">
          Web
        </span>
      )}
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
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
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
function POSView({ pacientes, setPacientes, inventario, ventas, setVentas, presetPacienteId, clearPreset, config, laboratorio, setLaboratorio, sesion }) {
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [busquedaArt, setBusquedaArt] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [vendedor, setVendedor] = useState(sesion?.nombre || "");
  const [optometrista, setOptometrista] = useState(sesion?.nombre || "");
  const [descuentoTipo, setDescuentoTipo] = useState("porcentaje");
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [formaPago, setFormaPago] = useState("efectivo");
  const [abono, setAbono] = useState(0);
  const [preview, setPreview] = useState(null);
  const [telefonoManual, setTelefonoManual] = useState("");
  const [busquedaNota, setBusquedaNota] = useState("");
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
  const presupuestosMostrador = ventas.filter((v) => v.origen !== "portal" && v.estatus === "presupuesto");

  function cargarPedidoPortal(pedido) {
    const p = pacientes.find((x) => x.id === pedido.pacienteId);
    if (p) setClienteSel(p);
    setCarrito(pedido.items.map((it) => ({ ...it, uidLinea: uid() })));
    setVentas(ventas.map((v) => (v.folio === pedido.folio ? { ...v, estatus: "convertido" } : v)));
    window.scrollTo(0, 0);
  }

  function cancelarPresupuesto(folio) {
    if (!window.confirm(`¿Cancelar el presupuesto #${folio}? Ya no aparecerá en la lista de pendientes.`)) return;
    setVentas(ventas.map((v) => (v.folio === folio ? { ...v, estatus: "cancelada" } : v)));
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
      // Mensaje de agradecimiento automático (WhatsApp y/o correo, lo que esté disponible) + PDF de la nota
      const nombreParaMensaje = clienteSel?.nombre || nota.nombreCliente;
      const msj = mensajeAgradecimiento(nombreParaMensaje);
      generarPDFNota(nota, config);
      if (clienteSel?.telefono)
        abrirWhatsApp(clienteSel.telefono, msj.whatsapp + "\n\n📎 Te comparto tu nota en PDF (adjunta el archivo aquí).");
      if (clienteSel?.mail) abrirEmail(clienteSel.mail, msj.email.asunto, msj.email.cuerpo + "\n\n(Adjunta el PDF de tu nota que se acaba de descargar.)");
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
                <button onClick={() => cancelarPresupuesto(v.folio)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600">
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {presupuestosMostrador.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-2">
            🧾 Presupuestos guardados ({presupuestosMostrador.length})
          </h3>
          <div className="space-y-2">
            {presupuestosMostrador.map((v) => (
              <div key={v.folio} className="bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <p className="font-medium">Folio #{v.folio} — {v.nombreCliente} — ${v.total.toFixed(2)} MXN</p>
                  <p className="text-xs text-slate-500">
                    {v.items.map((it) => it.nombre).join(", ")} · {new Date(v.fecha).toLocaleString("es-MX")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPreview(v)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
                    Ver / imprimir / WhatsApp
                  </button>
                  <button
                    onClick={() => cargarPedidoPortal(v)}
                    className="text-xs px-3 py-1.5 rounded-lg text-white"
                    style={{ background: SKY_DARK }}
                  >
                    Cargar en el POS para cobrar
                  </button>
                  <button onClick={() => cancelarPresupuesto(v.folio)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600">
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-3 mb-4">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
          <Search size={16} /> Buscar nota de venta o presupuesto (para reenviar)
        </h3>
        <input
          value={busquedaNota}
          onChange={(e) => setBusquedaNota(e.target.value)}
          placeholder="Folio o nombre del cliente..."
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
        />
        {busquedaNota.trim() && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {ventas
              .filter((v) => {
                const q = busquedaNota.trim().toLowerCase();
                return String(v.folio).includes(q) || (v.nombreCliente || "").toLowerCase().includes(q);
              })
              .slice()
              .reverse()
              .map((v) => (
                <div key={v.folio} className="flex items-center justify-between text-sm border-b py-1.5">
                  <div>
                    <span className="font-medium">#{v.folio} — {v.nombreCliente}</span>{" "}
                    <span className="text-xs text-slate-400">
                      ${v.total.toFixed(2)} · {v.estatus} · {new Date(v.fecha).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                  <button onClick={() => setPreview(v)} className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600">
                    Ver / reenviar
                  </button>
                </div>
              ))}
            {ventas.filter((v) => {
              const q = busquedaNota.trim().toLowerCase();
              return String(v.folio).includes(q) || (v.nombreCliente || "").toLowerCase().includes(q);
            }).length === 0 && <p className="text-xs text-slate-400">Sin resultados.</p>}
          </div>
        )}
      </div>

    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-3">
        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
            <Users size={16} /> Cliente
          </h3>
          {clienteSel ? (
            <div className="text-sm bg-slate-50 rounded p-2 flex justify-between items-center">
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
                    className="block w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded"
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
                className="text-left text-xs border rounded-lg px-2 py-1.5 hover:bg-slate-50 flex justify-between"
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
            {(() => {
              const p = preview.pacienteId ? pacientes.find((x) => x.id === preview.pacienteId) : null;
              const telefono = p?.telefono || telefonoManual;
              return (
                <div className="mt-3 bg-slate-50 rounded-lg p-2">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">
                    Enviar {preview.estatus === "presupuesto" ? "presupuesto" : "nota de venta"} por WhatsApp
                  </p>
                  <p className="text-xs text-slate-400 mb-2">
                    Se va a descargar el PDF a tu computadora y se abrirá WhatsApp con el mensaje listo — adjunta ahí el
                    PDF descargado antes de enviarlo (WhatsApp no permite adjuntarlo solo desde un enlace).
                  </p>
                  {!p?.telefono && (
                    <input
                      value={telefonoManual}
                      onChange={(e) => setTelefonoManual(e.target.value)}
                      placeholder="Teléfono del cliente"
                      className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => generarPDFNota(preview, config)}
                      className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm"
                    >
                      Descargar PDF
                    </button>
                    <button
                      onClick={async () => {
                        await generarPDFNota(preview, config);
                        if (telefono)
                          abrirWhatsApp(
                            telefono,
                            textoNotaWhatsApp(preview) + "\n\n📎 Te comparto tu nota en PDF (adjunta el archivo aquí)."
                          );
                      }}
                      disabled={!telefono}
                      className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm disabled:opacity-40"
                    >
                      Descargar PDF y abrir WhatsApp
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap gap-2 mt-3">
              {preview.estatus === "venta" && preview.pacienteId && (() => {
                const p = pacientes.find((x) => x.id === preview.pacienteId);
                const msj = mensajeAgradecimiento(preview.nombreCliente);
                return (
                  <>
                    {p?.telefono && (
                      <button
                        onClick={async () => {
                          await generarPDFNota(preview, config);
                          abrirWhatsApp(p.telefono, msj.whatsapp + "\n\n📎 Te comparto tu nota en PDF (adjunta el archivo aquí).");
                        }}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm"
                      >
                        Reenviar agradecimiento por WhatsApp
                      </button>
                    )}
                    {p?.mail && (
                      <button
                        onClick={async () => {
                          await generarPDFNota(preview, config);
                          abrirEmail(p.mail, msj.email.asunto, msj.email.cuerpo + "\n\n(Adjunta el PDF de tu nota que se acaba de descargar.)");
                        }}
                        className="flex-1 py-2 rounded-lg bg-slate-600 text-white text-sm"
                      >
                        Reenviar agradecimiento por correo
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

const PRODUCTOS_CONTACTO_SEED = [
  {
    nombreProducto: "SofLens 59",
    marca: "Bausch & Lomb",
    caracteristicas:
      "Cualidades: Lente mensual de alta resistencia a la acumulación de depósitos y proteínas. Ofrece una visión clara con una inversión muy baja, ideal para usuarios principiantes",
    rangos: "Miopía: -0.50 D a -9.00 D\nHipermetropía: +0.50 D a +6.00 D",
    presentacion: "6 lentes",
    tipoLente: "Esférico",
    reemplazo: "Mensual",
    precio: 420,
  },
  {
    nombreProducto: "Acuvue Oasys con Hydraclear Plus",
    marca: "Johnson & Johnson",
    caracteristicas:
      "Cualidades: Lente quincenal ultra cómodo que imita las lágrimas naturales para combatir la resequedad ocular en oficinas o climas secos. Cuenta con uno de los filtros de protección UV más altos del mercado.",
    rangos:
      "Miopía: -0.50 D a -12.00 D (pasos de 0.50 D después de -6.00 D)\nHipermetropía: +0.50 D a +8.00 D (pasos de 0.50 D después de +6.00 D)",
    presentacion: "6 lentes",
    tipoLente: "Esférico",
    reemplazo: "Quincenal",
    precio: 675,
  },
  {
    nombreProducto: "Biofinity",
    marca: "Cooper Vision",
    caracteristicas:
      "Cualidades: Fabricado con hidrogel de silicona natural sin aditivos ni humectantes artificiales. Su altísima transmisión de oxígeno mantiene los ojos blancos y saludables durante jornadas de uso muy prolongadas.",
    rangos:
      "Miopía: -0.25 D a -12.00 D\nHipermetropía: +0.25 D a +8.00 D\n(Nota: Existe la gama XR bajo pedido especial que cubre desde -20.00 D hasta +15.00 D)",
    presentacion: "6 lentes",
    tipoLente: "Esférico",
    reemplazo: "Mensual",
    precio: 570,
  },
  {
    nombreProducto: "Biofinity Toric",
    marca: "Cooper Vision",
    caracteristicas:
      "Cualidades: El lente líder para corregir el astigmatismo. Su diseño optimizado garantiza que el lente se mantenga perfectamente estable en el ojo al parpadear, evitando la visión borrosa o los mareos.",
    rangos:
      "Esfera (Miopía/Hipermetropía): -10.00 D a +6.00 D\nCilindro (Astigmatismo): -0.75 D, -1.25 D, -1.75 D, -2.25 D\nEje: 10° a 180° (en pasos de 10°)",
    presentacion: "6 lentes",
    tipoLente: "Tórico (Astigmatismo)",
    reemplazo: "Mensual",
    precio: 1075,
  },
  {
    nombreProducto: "Air Optix Colors",
    marca: "Alcon",
    caracteristicas:
      "Cualidades: Lentes de color mensuales que aportan una mirada natural y profunda. Al estar hechos de hidrogel de silicona, dejan pasar hasta 5 veces más oxígeno que los pupilentes de color económicos tradicionales.",
    rangos:
      "Estéticos / Cosméticos: 0.00 (Neutros)\nMiopía: -0.25 D a -6.00 D (y hasta -8.00 D en pasos de 0.50 D)\nHipermetropía: +0.25 D a +6.00 D",
    presentacion: "2 lentes",
    tipoLente: "Cosmético / Color",
    reemplazo: "Mensual",
    precio: 775,
  },
  {
    nombreProducto: "Ultra Monthly",
    marca: "Bausch & Lomb",
    caracteristicas:
      "Cualidades: Diseñado específicamente para usuarios de pantallas digitales (computadoras y celulares). Su tecnología retiene el 95% de la humedad del lente hasta por 16 horas continuas de uso.",
    rangos: "Miopía: -0.25 D a -12.00 D\nHipermetropía: +0.25 D a +6.00 D",
    presentacion: "6 lentes",
    tipoLente: "Esférico",
    reemplazo: "Mensual",
    precio: 750,
  },
  {
    nombreProducto: "SofLens 66 Toric",
    marca: "Bausch & Lomb",
    caracteristicas:
      "Cualidades: Lente mensual para astigmatismo con un diseño hidrofílico clásico muy probado. Su excelente estabilidad geométrica proporciona una agudeza visual nítida en pacientes con astigmatismos elevados.",
    rangos:
      "Esfera (Miopía): 0.00 D a -9.00 D\nCilindro (Astigmatismo): -0.75 D, -1.25 D, -1.75 D, -2.25 D, -2.75 D\nEje: 10° a 180° (en pasos de 10°)",
    presentacion: "6 lentes",
    tipoLente: "Tórico (Astigmatismo)",
    reemplazo: "Mensual",
    precio: 900,
  },
  {
    nombreProducto: "UV Soft Esférico",
    marca: "Hidrosoft",
    caracteristicas:
      "Cualidades: Lente de duración anual torneado a la medida en laboratorio. Ofrece un material no iónico de gran resistencia al desgaste diario y protección contra los rayos UV. Muy rentable a largo plazo.",
    rangos: "Miopía / Hipermetropía: -10.00 D a +10.00 D (rango estándar; se pueden pedir graduaciones más altas sobre diseño)",
    presentacion: "1 lente (Vial)",
    tipoLente: "Esférico",
    reemplazo: "Anual",
    precio: 1500,
  },
  {
    nombreProducto: "UV Soft Tórico",
    marca: "Hidrosoft",
    caracteristicas:
      "Cualidades: Lente anual personalizado para astigmatismos complejos, altos o combinados. Al fabricarse de forma individual, permite ajustar el eje grado por grado para un enfoque milimétrico e impecable.",
    rangos:
      "Esfera: -10.00 D a +10.00 D\nCilindro (Astigmatismo): -0.75 D a -5.00 D (o mayor según el caso)\nEje: 1° a 180° (ajustable de 1° en 1°)",
    presentacion: "1 lente (Vial)",
    tipoLente: "Tórico (Astigmatismo)",
    reemplazo: "Anual",
    precio: 3400,
  },
];

const MARCAS_ARMAZON_SEED = [
  "SENMA", "MICHELE", "CARAMELO", "LADY BLACK", "DPTTI", "ELLIS", "ELEGANCIA", "JD", "ONOLA", "NOAH",
  "B&F", "LADY LUCK", "MARINA", "G.M. SURNE", "VISUAL", "FORMOSA", "CHANEL", "ANUBIS", "GUCCI",
  "DUST FOR LA MODA", "LIGTHEYEWEAR", "OPTIMAX", "FUNKY FRED",
];

function InventarioView({ inventario, setInventario, config, setConfig }) {
  const [cat, setCat] = useState("armazones");
  const [editando, setEditando] = useState(null);
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
    nombreProductoContacto: "",
    caracteristicasContacto: "",
    rangosContacto: "",
    presentacionContacto: "",
    tipoLenteContacto: "",
    reemplazoContacto: "",
    modoManualContacto: false,
    cosmetico: false,
    marcaSolar: "",
    modeloSolar: "",
    colorSolar: "",
    imagen: "",
    descripcion: "",
    tallas: [],
    marcaArmazon: "",
    modeloArmazon: "",
    clipOnCompatible: "",
    acercaDe: "",
    galeriaExtra: [],
  });

  const catalogoContacto = [...PRODUCTOS_CONTACTO_SEED, ...(config?.catalogoLentesContacto || [])];
  const marcasContactoOrdenadas = [...new Set(catalogoContacto.map((p) => p.marca))].sort((a, b) => a.localeCompare(b));
  const productosDeMarcaContacto = nuevo.marcaContacto ? catalogoContacto.filter((p) => p.marca === nuevo.marcaContacto) : [];

  function agregarProductoContactoCatalogo(producto) {
    const actual = config?.catalogoLentesContacto || [];
    if (actual.some((p) => p.nombreProducto === producto.nombreProducto && p.marca === producto.marca)) return;
    setConfig({ ...config, catalogoLentesContacto: [...actual, producto] });
  }

  const catalogoMarcas = {
    ...Object.fromEntries(MARCAS_ARMAZON_SEED.map((m) => [m, []])),
    ...(config?.catalogoArmazones || {}),
  };
  const marcasOrdenadas = Object.keys(catalogoMarcas).sort((a, b) => a.localeCompare(b));
  const modelosDeMarca = (nuevo.marcaArmazon && catalogoMarcas[nuevo.marcaArmazon]) || [];

  function agregarMarcaCatalogo(nombreMarca) {
    const nombre = nombreMarca.trim().toUpperCase();
    if (!nombre) return;
    const actual = config?.catalogoArmazones || {};
    if (actual[nombre]) return;
    setConfig({ ...config, catalogoArmazones: { ...actual, [nombre]: catalogoMarcas[nombre] || [] } });
  }

  function agregarModeloCatalogo(marca, nombreModelo) {
    const modelo = nombreModelo.trim();
    if (!modelo || !marca) return;
    const actual = config?.catalogoArmazones || {};
    const modelosActuales = actual[marca] || catalogoMarcas[marca] || [];
    if (modelosActuales.includes(modelo)) return;
    setConfig({ ...config, catalogoArmazones: { ...actual, [marca]: [...modelosActuales, modelo] } });
  }

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
  const COLORES_PASTA = ["Negro", "Café", "Azul", "Transparente", "Rosa", "Traslúcido", "Verde", "Morado", "Lila", "Animal print"];
  const COLORES_METAL = ["Dorado", "Plata", "Café", "Negro", "Azul", "Morado", "Lila", "Rojo", "Combinado"];
  const coloresDisponibles = nuevo.categoriaArmazon?.includes("Pasta")
    ? COLORES_PASTA
    : nuevo.categoriaArmazon?.includes("Metal")
    ? COLORES_METAL
    : nuevo.categoriaArmazon?.includes("Combinado")
    ? [...new Set([...COLORES_PASTA, ...COLORES_METAL])]
    : [];

  const rangosDisponibles = nuevo.material ? RANGOS_POR_MATERIAL[nuevo.material] || [] : [];

  function siguienteSKU() {
    const prefijo = cat.slice(0, 3).toUpperCase();
    const n = lista.length + 1;
    return `${prefijo}-${n.toString().padStart(4, "0")}`;
  }

  function limpiarNuevo() {
    setNuevo({
      nombre: "", precio: "", existencias: "", tipo: "", material: "", tratamiento: "", rango: "",
      tipoLinea: "", categoriaArmazon: "", tipoReemplazo: "", marcaContacto: "",
      nombreProductoContacto: "", caracteristicasContacto: "", rangosContacto: "", presentacionContacto: "",
      tipoLenteContacto: "", reemplazoContacto: "", modoManualContacto: false, cosmetico: false,
      marcaSolar: "", modeloSolar: "", colorSolar: "", imagen: "", descripcion: "",
      tallas: [], marcaArmazon: "", modeloArmazon: "", clipOnCompatible: "", acercaDe: "", galeriaExtra: [],
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
      if (!nuevo.marcaContacto || !nuevo.nombreProductoContacto) return;
      nombreFinal = nuevo.nombreProductoContacto;
      extra = {
        caracteristicas: nuevo.caracteristicasContacto,
        rangos: nuevo.rangosContacto,
        presentacion: nuevo.presentacionContacto,
        tipoLente: nuevo.tipoLenteContacto,
        reemplazo: nuevo.reemplazoContacto,
      };
      if (nuevo.modoManualContacto) {
        agregarProductoContactoCatalogo({
          nombreProducto: nuevo.nombreProductoContacto,
          marca: nuevo.marcaContacto,
          caracteristicas: nuevo.caracteristicasContacto,
          rangos: nuevo.rangosContacto,
          presentacion: nuevo.presentacionContacto,
          tipoLente: nuevo.tipoLenteContacto,
          reemplazo: nuevo.reemplazoContacto,
          precio: Number(nuevo.precio) || 0,
        });
      }
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

  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [bulkMarcas, setBulkMarcas] = useState("");
  const [marcaParaModelos, setMarcaParaModelos] = useState("");
  const [bulkModelos, setBulkModelos] = useState("");

  function agregarMarcasEnLote() {
    const nombres = bulkMarcas
      .split(/[\n,]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (nombres.length === 0) return;
    const actual = config?.catalogoArmazones || {};
    const nuevoCatalogo = { ...actual };
    nombres.forEach((n) => {
      if (!nuevoCatalogo[n]) nuevoCatalogo[n] = catalogoMarcas[n] || [];
    });
    setConfig({ ...config, catalogoArmazones: nuevoCatalogo });
    setBulkMarcas("");
  }

  function agregarModelosEnLote() {
    if (!marcaParaModelos) return;
    const nombres = bulkModelos
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (nombres.length === 0) return;
    const actual = config?.catalogoArmazones || {};
    const existentes = actual[marcaParaModelos] || catalogoMarcas[marcaParaModelos] || [];
    const combinados = [...new Set([...existentes, ...nombres])];
    setConfig({ ...config, catalogoArmazones: { ...actual, [marcaParaModelos]: combinados } });
    setBulkModelos("");
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

      {esArmazon && (
        <div className="bg-white border rounded-xl p-3 mb-4">
          <button onClick={() => setCatalogoAbierto(!catalogoAbierto)} className="text-sm font-semibold text-slate-700">
            {catalogoAbierto ? "▾" : "▸"} Catálogo de marcas y modelos ({marcasOrdenadas.length} marcas)
          </button>
          {catalogoAbierto && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Agregar marcas (una por línea o separadas por coma)</label>
                <textarea
                  value={bulkMarcas}
                  onChange={(e) => setBulkMarcas(e.target.value)}
                  rows={3}
                  placeholder={"MARCA NUEVA 1\nMARCA NUEVA 2"}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
                />
                <button onClick={agregarMarcasEnLote} className="px-3 py-1.5 rounded-lg text-white text-xs" style={{ background: SKY_DARK }}>
                  Agregar marcas
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Agregar modelos a una marca (en lote)</label>
                <select
                  value={marcaParaModelos}
                  onChange={(e) => setMarcaParaModelos(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
                >
                  <option value="">Elige marca...</option>
                  {marcasOrdenadas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <textarea
                  value={bulkModelos}
                  onChange={(e) => setBulkModelos(e.target.value)}
                  rows={3}
                  disabled={!marcaParaModelos}
                  placeholder={"Modelo 1\nModelo 2"}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2 disabled:bg-slate-100"
                />
                <button
                  onClick={agregarModelosEnLote}
                  disabled={!marcaParaModelos}
                  className="px-3 py-1.5 rounded-lg text-white text-xs disabled:opacity-40"
                  style={{ background: SKY_DARK }}
                >
                  Agregar modelos
                </button>
                {marcaParaModelos && (
                  <p className="text-xs text-slate-400 mt-2">
                    Modelos actuales: {(catalogoMarcas[marcaParaModelos] || []).join(", ") || "ninguno todavía"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                onChange={(e) => setNuevo({ ...nuevo, categoriaArmazon: e.target.value, descripcion: "" })}
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
            <div>
              <label className="text-xs text-slate-500">Descripción (color)</label>
              <select
                value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
                disabled={!nuevo.categoriaArmazon}
                className="block border rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:opacity-60"
              >
                <option value="">{nuevo.categoriaArmazon ? "—" : "Elige categoría primero"}</option>
                {coloresDisponibles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block">Tallas disponibles</label>
              <div className="flex gap-2">
                {["M", "G", "EG"].map((t) => (
                  <label key={t} className="flex items-center gap-1 text-xs border rounded px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={nuevo.tallas.includes(t)}
                      onChange={(e) =>
                        setNuevo({
                          ...nuevo,
                          tallas: e.target.checked ? [...nuevo.tallas, t] : nuevo.tallas.filter((x) => x !== t),
                        })
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Marca</label>
              <div className="flex gap-1">
                <select
                  value={nuevo.marcaArmazon}
                  onChange={(e) => setNuevo({ ...nuevo, marcaArmazon: e.target.value, modeloArmazon: "" })}
                  className="block border rounded-lg px-2 py-1.5 text-sm w-36"
                >
                  <option value="">—</option>
                  {marcasOrdenadas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const nueva = window.prompt("Nombre de la nueva marca:");
                    if (nueva) {
                      agregarMarcaCatalogo(nueva);
                      setNuevo({ ...nuevo, marcaArmazon: nueva.trim().toUpperCase(), modeloArmazon: "" });
                    }
                  }}
                  className="border rounded-lg px-2 text-sm"
                  title="Agregar nueva marca"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Modelo</label>
              <div className="flex gap-1">
                <select
                  value={nuevo.modeloArmazon}
                  onChange={(e) => setNuevo({ ...nuevo, modeloArmazon: e.target.value })}
                  disabled={!nuevo.marcaArmazon}
                  className="block border rounded-lg px-2 py-1.5 text-sm w-36 disabled:bg-slate-100 disabled:opacity-60"
                >
                  <option value="">{nuevo.marcaArmazon ? "—" : "Elige marca primero"}</option>
                  {modelosDeMarca.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!nuevo.marcaArmazon}
                  onClick={() => {
                    const nuevoModelo = window.prompt(`Nombre del nuevo modelo para ${nuevo.marcaArmazon}:`);
                    if (nuevoModelo) {
                      agregarModeloCatalogo(nuevo.marcaArmazon, nuevoModelo);
                      setNuevo({ ...nuevo, modeloArmazon: nuevoModelo.trim() });
                    }
                  }}
                  className="border rounded-lg px-2 text-sm disabled:opacity-40"
                  title="Agregar nuevo modelo"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Clip-on compatible</label>
              <select value={nuevo.clipOnCompatible} onChange={(e) => setNuevo({ ...nuevo, clipOnCompatible: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option>Sí</option>
                <option>No</option>
              </select>
            </div>
            <div className="w-full">
              <label className="text-xs text-slate-500">Acerca de (descripción para la ficha)</label>
              <textarea
                value={nuevo.acercaDe}
                onChange={(e) => setNuevo({ ...nuevo, acercaDe: e.target.value })}
                rows={2}
                className="block border rounded-lg px-2 py-1.5 text-sm w-full"
              />
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
              <label className="text-xs text-slate-500">Marca</label>
              <div className="flex gap-1">
                <select
                  value={nuevo.marcaContacto}
                  onChange={(e) => setNuevo({ ...nuevo, marcaContacto: e.target.value, nombreProductoContacto: "" })}
                  className="block border rounded-lg px-2 py-1.5 text-sm w-48"
                >
                  <option value="">—</option>
                  {marcasContactoOrdenadas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const nueva = window.prompt("Nombre de la nueva marca:");
                    if (nueva) setNuevo({ ...nuevo, marcaContacto: nueva.trim(), nombreProductoContacto: "", modoManualContacto: true });
                  }}
                  className="border rounded-lg px-2 text-sm"
                  title="Agregar nueva marca"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Nombre del producto</label>
              <div className="flex gap-1">
                <select
                  value={nuevo.modoManualContacto ? "" : nuevo.nombreProductoContacto}
                  disabled={!nuevo.marcaContacto}
                  onChange={(e) => {
                    const producto = productosDeMarcaContacto.find((p) => p.nombreProducto === e.target.value);
                    if (producto) {
                      setNuevo({
                        ...nuevo,
                        nombreProductoContacto: producto.nombreProducto,
                        caracteristicasContacto: producto.caracteristicas,
                        rangosContacto: producto.rangos,
                        presentacionContacto: producto.presentacion,
                        tipoLenteContacto: producto.tipoLente,
                        reemplazoContacto: producto.reemplazo,
                        precio: producto.precio,
                        modoManualContacto: false,
                      });
                    }
                  }}
                  className="block border rounded-lg px-2 py-1.5 text-sm w-56 disabled:bg-slate-100 disabled:opacity-60"
                >
                  <option value="">{nuevo.marcaContacto ? "—" : "Elige marca primero"}</option>
                  {productosDeMarcaContacto.map((p) => (
                    <option key={p.nombreProducto} value={p.nombreProducto}>{p.nombreProducto}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!nuevo.marcaContacto}
                  onClick={() => {
                    const nuevoNombre = window.prompt("Nombre del nuevo producto:");
                    if (nuevoNombre) {
                      setNuevo({
                        ...nuevo,
                        nombreProductoContacto: nuevoNombre.trim(),
                        caracteristicasContacto: "",
                        rangosContacto: "",
                        presentacionContacto: "",
                        tipoLenteContacto: "",
                        reemplazoContacto: "",
                        precio: "",
                        modoManualContacto: true,
                      });
                    }
                  }}
                  className="border rounded-lg px-2 text-sm disabled:opacity-40"
                  title="Agregar producto nuevo manualmente"
                >
                  +
                </button>
              </div>
            </div>

            {nuevo.modoManualContacto && (
              <div className="bg-slate-50 rounded-lg p-2 w-full space-y-2">
                <p className="text-xs text-amber-700">Producto nuevo — completa sus características (se guardará en el catálogo para la próxima vez).</p>
                <textarea
                  value={nuevo.caracteristicasContacto}
                  onChange={(e) => setNuevo({ ...nuevo, caracteristicasContacto: e.target.value })}
                  placeholder="Características principales"
                  rows={2}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm"
                />
                <textarea
                  value={nuevo.rangosContacto}
                  onChange={(e) => setNuevo({ ...nuevo, rangosContacto: e.target.value })}
                  placeholder="Rangos de graduación"
                  rows={2}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={nuevo.presentacionContacto}
                    onChange={(e) => setNuevo({ ...nuevo, presentacionContacto: e.target.value })}
                    placeholder="Presentación (ej. 6 lentes)"
                    className="border rounded-lg px-2 py-1.5 text-sm w-40"
                  />
                  <select
                    value={nuevo.tipoLenteContacto}
                    onChange={(e) => setNuevo({ ...nuevo, tipoLenteContacto: e.target.value })}
                    className="border rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">Tipo de lente</option>
                    <option>Esférico</option>
                    <option>Tórico (Astigmatismo)</option>
                    <option>Cosmético / Color</option>
                  </select>
                  <select
                    value={nuevo.reemplazoContacto}
                    onChange={(e) => setNuevo({ ...nuevo, reemplazoContacto: e.target.value })}
                    className="border rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">Reemplazo</option>
                    <option>Quincenal</option>
                    <option>Mensual</option>
                    <option>Anual</option>
                  </select>
                </div>
              </div>
            )}

            {!nuevo.modoManualContacto && nuevo.nombreProductoContacto && (
              <div className="text-xs text-slate-500 w-full bg-slate-50 rounded-lg p-2">
                <p><b>Presentación:</b> {nuevo.presentacionContacto} · <b>Tipo:</b> {nuevo.tipoLenteContacto} · <b>Reemplazo:</b> {nuevo.reemplazoContacto}</p>
              </div>
            )}
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
        {esArmazon && (
          <div>
            <label className="text-xs text-slate-500 block">Fotos adicionales (carrusel)</label>
            <div className="flex items-center gap-1 flex-wrap max-w-[220px]">
              {nuevo.galeriaExtra.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="w-8 h-8 rounded object-cover border" />
                  <button
                    onClick={() => setNuevo({ ...nuevo, galeriaExtra: nuevo.galeriaExtra.filter((_, j) => j !== i) })}
                    className="absolute -top-1 -right-1 bg-white rounded-full border text-red-500"
                    style={{ width: 14, height: 14, fontSize: 9, lineHeight: "12px" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach((file) => {
                    const reader = new FileReader();
                    reader.onload = () => setNuevo((n) => ({ ...n, galeriaExtra: [...n.galeriaExtra, reader.result] }));
                    reader.readAsDataURL(file);
                  });
                }}
                className="text-xs w-32"
              />
            </div>
          </div>
        )}
        <button onClick={agregar} className="px-3 py-1.5 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Plus size={16} /> Agregar
        </button>
        <button onClick={() => imprimirElemento("inventario-imprimible")} className="ml-auto px-3 py-1.5 rounded-lg bg-slate-200 text-sm flex items-center gap-1">
          <Printer size={16} /> Imprimir inventario
        </button>
      </div>

      <div id="inventario-imprimible" className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <p className="hidden print:block font-bold px-3 pt-3">Inventario — {CATEGORIAS_INV.find((c) => c.key === cat)?.label}</p>
        {esContacto ? (
          <table className="w-full text-sm">
            <thead style={{ background: BEIGE }}>
              <tr>
                <th className="text-left px-3 py-2 print:hidden">Imagen</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Nombre (del Producto)</th>
                <th className="text-left px-3 py-2">Marca</th>
                <th className="text-left px-3 py-2">Características Principales</th>
                <th className="text-left px-3 py-2">Rangos de graduación</th>
                <th className="text-left px-3 py-2">Presentación</th>
                <th className="text-left px-3 py-2">Tipo de Lente</th>
                <th className="text-left px-3 py-2">Reemplazo</th>
                <th className="text-right px-3 py-2">Precio</th>
                <th className="text-right px-3 py-2">Existencias</th>
                <th className="px-3 py-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-t align-top">
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
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{a.sku}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{a.nombreProductoContacto || a.nombre}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.marcaContacto || "—"}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={a.caracteristicas || ""}>{a.caracteristicas || "—"}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate whitespace-pre-line" title={a.rangos || ""}>{a.rangos || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.presentacion || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.tipoLente || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.reemplazo || "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">${a.precio}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={a.existencias}
                      onChange={(e) =>
                        setInventario({ ...inventario, [cat]: lista.map((x) => (x.id === a.id ? { ...x, existencias: e.target.value } : x)) })
                      }
                      className="w-16 border rounded px-1 py-1 text-right text-sm print:hidden"
                    />
                    <span className="hidden print:inline">{a.existencias}</span>
                  </td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <button onClick={() => eliminar(a.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center text-slate-400 py-6">
                    Sin artículos en esta categoría todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
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
                <td className="px-3 py-2 text-slate-500 max-w-[260px] truncate" title={a.caracteristicas || ""}>{a.rangoDescripcion || a.caracteristicas || a.descripcion || "—"}</td>
                <td className="px-3 py-2 text-right">${a.precio}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    value={a.existencias}
                    onChange={(e) =>
                      setInventario({ ...inventario, [cat]: lista.map((x) => (x.id === a.id ? { ...x, existencias: e.target.value } : x)) })
                    }
                    className="w-16 border rounded px-1 py-1 text-right text-sm print:hidden"
                  />
                  <span className="hidden print:inline">{a.existencias}</span>
                </td>
                <td className="px-3 py-2 text-right print:hidden">
                  {esArmazon && (
                    <button onClick={() => setEditando(a)} className="text-slate-600 hover:text-slate-800 mr-2 text-xs underline">
                      Editar detalles
                    </button>
                  )}
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
        )}
      </div>

      {editando && (
        <EditarArticuloModal
          articulo={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(actualizado) => {
            setInventario({ ...inventario, [cat]: lista.map((x) => (x.id === actualizado.id ? actualizado : x)) });
            setEditando(null);
          }}
          config={config}
          setConfig={setConfig}
        />
      )}
    </div>
  );
}

function EditarArticuloModal({ articulo, onCerrar, onGuardar, config, setConfig }) {
  const [datos, setDatos] = useState({
    ...articulo,
    tallas: articulo.tallas || [],
    galeriaExtra: articulo.galeriaExtra || [],
  });
  const COLORES_PASTA = ["Negro", "Café", "Azul", "Transparente", "Rosa", "Traslúcido", "Verde", "Morado", "Lila", "Animal print"];
  const COLORES_METAL = ["Dorado", "Plata", "Café", "Negro", "Azul", "Morado", "Lila", "Rojo", "Combinado"];
  const coloresDisponibles = datos.categoriaArmazon?.includes("Pasta")
    ? COLORES_PASTA
    : datos.categoriaArmazon?.includes("Metal")
    ? COLORES_METAL
    : [...new Set([...COLORES_PASTA, ...COLORES_METAL])];
  const catalogoMarcas = {
    ...Object.fromEntries(MARCAS_ARMAZON_SEED.map((m) => [m, []])),
    ...(config?.catalogoArmazones || {}),
  };
  const marcasOrdenadas = Object.keys(catalogoMarcas).sort((a, b) => a.localeCompare(b));
  const modelosDeMarca = (datos.marcaArmazon && catalogoMarcas[datos.marcaArmazon]) || [];

  function agregarMarcaCatalogo(nombreMarca) {
    const nombre = nombreMarca.trim().toUpperCase();
    if (!nombre) return;
    const actual = config?.catalogoArmazones || {};
    if (actual[nombre]) return;
    setConfig({ ...config, catalogoArmazones: { ...actual, [nombre]: catalogoMarcas[nombre] || [] } });
  }

  function agregarModeloCatalogo(marca, nombreModelo) {
    const modelo = nombreModelo.trim();
    if (!modelo || !marca) return;
    const actual = config?.catalogoArmazones || {};
    const modelosActuales = actual[marca] || catalogoMarcas[marca] || [];
    if (modelosActuales.includes(modelo)) return;
    setConfig({ ...config, catalogoArmazones: { ...actual, [marca]: [...modelosActuales, modelo] } });
  }

  return (
    <Modal open={true} onClose={onCerrar} title={`Editar detalles — ${articulo.nombre}`} wide>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Descripción (color)</label>
          <select value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm">
            <option value="">—</option>
            {coloresDisponibles.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block">Tallas disponibles</label>
          <div className="flex gap-2">
            {["M", "G", "EG"].map((t) => (
              <label key={t} className="flex items-center gap-1 text-xs border rounded px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={datos.tallas.includes(t)}
                  onChange={(e) =>
                    setDatos({ ...datos, tallas: e.target.checked ? [...datos.tallas, t] : datos.tallas.filter((x) => x !== t) })
                  }
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Marca</label>
          <div className="flex gap-1">
            <select
              value={datos.marcaArmazon || ""}
              onChange={(e) => setDatos({ ...datos, marcaArmazon: e.target.value, modeloArmazon: "" })}
              className="block border rounded-lg px-2 py-1.5 text-sm w-40"
            >
              <option value="">—</option>
              {marcasOrdenadas.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const nueva = window.prompt("Nombre de la nueva marca:");
                if (nueva) {
                  agregarMarcaCatalogo(nueva);
                  setDatos({ ...datos, marcaArmazon: nueva.trim().toUpperCase(), modeloArmazon: "" });
                }
              }}
              className="border rounded-lg px-2 text-sm"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Modelo</label>
          <div className="flex gap-1">
            <select
              value={datos.modeloArmazon || ""}
              onChange={(e) => setDatos({ ...datos, modeloArmazon: e.target.value })}
              disabled={!datos.marcaArmazon}
              className="block border rounded-lg px-2 py-1.5 text-sm w-40 disabled:bg-slate-100 disabled:opacity-60"
            >
              <option value="">{datos.marcaArmazon ? "—" : "Elige marca primero"}</option>
              {modelosDeMarca.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!datos.marcaArmazon}
              onClick={() => {
                const nuevoModelo = window.prompt(`Nombre del nuevo modelo para ${datos.marcaArmazon}:`);
                if (nuevoModelo) {
                  agregarModeloCatalogo(datos.marcaArmazon, nuevoModelo);
                  setDatos({ ...datos, modeloArmazon: nuevoModelo.trim() });
                }
              }}
              className="border rounded-lg px-2 text-sm disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Clip-on compatible</span>
          <select value={datos.clipOnCompatible || ""} onChange={(e) => setDatos({ ...datos, clipOnCompatible: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
            <option value="">—</option>
            <option>Sí</option>
            <option>No</option>
          </select>
        </label>
        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Acerca de (descripción para la ficha)</span>
          <textarea
            value={datos.acercaDe || ""}
            onChange={(e) => setDatos({ ...datos, acercaDe: e.target.value })}
            rows={3}
            className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
          />
        </label>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fotos del carrusel</label>
          <div className="flex items-center gap-2 flex-wrap">
            {datos.imagen && (
              <div className="relative">
                <img src={datos.imagen} alt="" className="w-14 h-14 rounded object-cover border" />
                <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-black/60 text-white text-center">principal</span>
              </div>
            )}
            {datos.galeriaExtra.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="w-14 h-14 rounded object-cover border" />
                <button
                  onClick={() => setDatos({ ...datos, galeriaExtra: datos.galeriaExtra.filter((_, j) => j !== i) })}
                  className="absolute -top-1 -right-1 bg-white rounded-full border text-red-500"
                  style={{ width: 16, height: 16, fontSize: 10, lineHeight: "14px" }}
                >
                  ✕
                </button>
              </div>
            ))}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => {
                  const reader = new FileReader();
                  reader.onload = () => setDatos((d) => ({ ...d, galeriaExtra: [...d.galeriaExtra, reader.result] }));
                  reader.readAsDataURL(file);
                });
              }}
              className="text-xs"
            />
          </div>
        </div>
        <button onClick={() => onGuardar(datos)} className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ background: SKY_DARK }}>
          Guardar detalles
        </button>
      </div>
    </Modal>
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
              <th className="text-left px-3 py-2 print:hidden">Cita</th>
              <th className="text-left px-3 py-2 print:hidden">Cuenta</th>
              <th className="px-3 py-2 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-3 py-2">{p.folio}</td>
                <td className="px-3 py-2 font-medium">
                  <button onClick={() => setAbierto(p.id)} className="text-slate-700 hover:underline print:no-underline print:text-slate-800">
                    {p.nombre}
                  </button>
                </td>
                <td className="px-3 py-2">{p.telefono}</td>
                <td className="px-3 py-2 text-right">${Number(p.saldo || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right print:hidden">{(p.compras || []).length}</td>
                <td className="px-3 py-2 print:hidden">
                  {(() => {
                    const citaProxima = agenda.find((c) => c.pacienteId === p.id && c.estatus === "proxima");
                    return citaProxima ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {citaProxima.fecha} {citaProxima.hora}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 print:hidden">
                  {p.cuentaActiva ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Activa</span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!p.telefono) {
                          window.alert("Este paciente no tiene teléfono guardado para invitarlo.");
                          return;
                        }
                        abrirWhatsApp(
                          p.telefono,
                          "Estamos felices que seas uno de nuestros clientes distinguidos, y nos encantaría invitarte a crear una cuenta en nuestra página, para acceder a promociones, lanzamientos y más. En Spektrum Ópticas estamos comprometidos con tu salud visual"
                        );
                      }}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                      title="Invitar a crear cuenta por WhatsApp"
                    >
                      Inactiva
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-right print:hidden">
                  <button onClick={() => eliminarPaciente(p.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400 py-6">
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

function ResumenVisita({ v, paciente, config }) {
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
      {v.items && v.folio && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => generarPDFNota(v, config)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
            Descargar PDF
          </button>
          {paciente?.telefono && (
            <button
              onClick={async () => {
                await generarPDFNota(v, config);
                abrirWhatsApp(paciente.telefono, textoNotaWhatsApp(v) + "\n\n📎 Te comparto tu nota en PDF (adjunta el archivo aquí).");
              }}
              className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700"
            >
              Reenviar por WhatsApp
            </button>
          )}
        </div>
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
            Historial de visitas / compras — <span className="text-slate-700">Número de compras: {visitasOrdenadas.length}</span>
          </h3>
          <button onClick={() => setAgregandoVisita(true)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
            <Plus size={14} /> Agregar visita manualmente
          </button>
        </div>
        <div className="space-y-2">
          {visitasOrdenadas.map((v) => (
            <ResumenVisita key={v.id || v.folio} v={v} paciente={datos} config={config} />
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

  function marcarEntregado(o) {
    const hoy = fechaISO(new Date());
    setLaboratorio(laboratorio.map((x) => (x.id === o.id ? { ...x, fechaEntrega: hoy } : x)));
    const paciente = pacientes.find((p) => p.id === o.pacienteId);
    const nombre = o.nombreCliente || paciente?.nombre || "cliente";
    const msj = mensajeEntregaFinal(nombre);
    if (paciente?.telefono) abrirWhatsApp(paciente.telefono, msj.whatsapp);
    if (paciente?.mail) abrirEmail(paciente.mail, msj.email.asunto, msj.email.cuerpo);
    if (!paciente?.telefono && !paciente?.mail) {
      alert("Se marcó como entregado, pero este paciente no tiene teléfono ni correo guardado para agradecerle.");
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
              <th className="text-left px-3 py-2">Entrega al cliente</th>
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
                  {o.fechaEntrega ? (
                    <span className="text-xs text-emerald-700">{o.fechaEntrega}</span>
                  ) : (
                    <button
                      onClick={() => marcarEntregado(o)}
                      disabled={!o.fechaRecepcion}
                      className="text-xs px-2 py-1 rounded bg-slate-800 text-white disabled:opacity-30"
                      title={!o.fechaRecepcion ? "Primero márcala como recibida del laboratorio" : ""}
                    >
                      Marcar entregado y agradecer
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  {o.cancelada ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Cancelada</span>
                  ) : o.fechaEntrega ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Entregada</span>
                  ) : o.fechaRecepcion ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Recibida — lista para entregar</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Activa</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {o.cancelada ? (
                    <button onClick={() => reactivarOrden(o.id)} className="text-xs text-slate-600 underline">Reactivar</button>
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
                <div className="flex items-center gap-3 mb-4" style={{ borderBottom: `2px solid ${SKY}`, paddingBottom: 10 }}>
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
              <div className="flex items-center gap-3 mb-4" style={{ borderBottom: `2px solid ${SKY}`, paddingBottom: 10 }}>
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
  const [modoCorregirGastos, setModoCorregirGastos] = useState(false);
  const [pidiendoPasswordGastos, setPidiendoPasswordGastos] = useState(false);
  const [passwordGastos, setPasswordGastos] = useState("");
  const [errorPasswordGastos, setErrorPasswordGastos] = useState("");

  function intentarCorregirGastos() {
    if (passwordGastos === "spektrum2026") {
      setModoCorregirGastos(true);
      setPidiendoPasswordGastos(false);
      setPasswordGastos("");
      setErrorPasswordGastos("");
    } else {
      setErrorPasswordGastos("Contraseña incorrecta.");
    }
  }

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

  function actualizarPagoProveedor(id, campo, valor) {
    setPagosProveedores(
      pagosProveedores.map((p) => (p.id === id ? { ...p, [campo]: campo === "monto" ? Number(valor) : valor } : p))
    );
  }

  function eliminarPagoProveedor(id) {
    if (!window.confirm("¿Eliminar este pago a proveedor? No se podrá recuperar.")) return;
    setPagosProveedores(pagosProveedores.filter((p) => p.id !== id));
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
        <button onClick={() => cambiarDia(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border-none text-sm font-medium focus:outline-none" />
        <button onClick={() => cambiarDia(1)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ChevronRight size={18} />
        </button>
        {fecha !== fechaISO(new Date()) && (
          <button onClick={() => setFecha(fechaISO(new Date()))} className="text-xs text-slate-600 underline ml-1">
            Hoy
          </button>
        )}
      </div>

      <div id="corte-imprimible">
        <p className="hidden print:block font-bold mb-3">Corte Diario — {fecha}</p>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1 print:hidden">
          <TotalBox titulo="Vendido del día" monto={totalVendido} color="#111827" subtitulo={`${ventasDelDia.length} nota(s)`} />
          <TotalBox titulo="Total de tickets del día" monto={totalTicketsDia} color="#0f766e" subtitulo={`Ticket promedio: $${ticketPromedioDia.toFixed(2)}`} esConteo />
          <TotalBox titulo="Anticipos cobrados" monto={totalAnticipos} color="#6B7280" subtitulo={`${anticipos.length} pago(s)`} />
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="font-semibold text-sm">Desglose — Pago a proveedores</h4>
            <div className="flex gap-2">
              <button onClick={() => setMostrarProveedor(!mostrarProveedor)} className="text-xs text-slate-600 underline">
                + Registrar pago
              </button>
              {modoCorregirGastos ? (
                <button onClick={() => setModoCorregirGastos(false)} className="text-xs px-2 py-1 rounded bg-slate-800 text-white">
                  Bloquear de nuevo
                </button>
              ) : (
                <button onClick={() => setPidiendoPasswordGastos(true)} className="text-xs px-2 py-1 rounded bg-red-600 text-white font-semibold">
                  CORREGIR GASTOS
                </button>
              )}
            </div>
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
              {pagosProvDelDia.map((p) =>
                modoCorregirGastos ? (
                  <tr key={p.id} className="border-t align-top">
                    <td className="py-1 pr-1">
                      <select
                        value={p.proveedor}
                        onChange={(e) => actualizarPagoProveedor(p.id, "proveedor", e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs w-24"
                      >
                        <option value={p.proveedor}>{p.proveedor}</option>
                        {proveedores.filter((x) => x.nombre !== p.proveedor).map((x) => (
                          <option key={x.id} value={x.nombre}>{x.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-1">
                      <input
                        value={p.concepto}
                        onChange={(e) => actualizarPagoProveedor(p.id, "concepto", e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs w-24"
                      />
                    </td>
                    <td className="text-right py-1 pr-1">
                      <input
                        type="number"
                        value={p.monto}
                        onChange={(e) => actualizarPagoProveedor(p.id, "monto", e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs w-16 text-right"
                      />
                    </td>
                    <td className="text-right py-1">
                      <button onClick={() => eliminarPagoProveedor(p.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-t">
                    <td className="py-1">{p.proveedor} — {p.concepto}</td>
                    <td className="text-right py-1">${p.monto.toFixed(2)}</td>
                  </tr>
                )
              )}
              {pagosProvDelDia.length === 0 && <tr><td className="text-slate-400 py-2">Sin pagos a proveedores este día.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <Modal open={pidiendoPasswordGastos} onClose={() => { setPidiendoPasswordGastos(false); setPasswordGastos(""); setErrorPasswordGastos(""); }} title="Corregir gastos">
        <p className="text-sm text-slate-500 mb-3">Escribe la contraseña para poder editar o eliminar pagos a proveedores.</p>
        <Field label="Contraseña" type="password" value={passwordGastos} onChange={(e) => setPasswordGastos(e.target.value)} />
        {errorPasswordGastos && <p className="text-xs text-red-600 mb-2">{errorPasswordGastos}</p>}
        <button onClick={intentarCorregirGastos} className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ background: SKY_DARK }}>
          Desbloquear edición
        </button>
      </Modal>

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
        <button onClick={() => cambiarMes(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="border-none text-sm font-medium focus:outline-none" />
        <button onClick={() => cambiarMes(1)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ChevronRight size={18} />
        </button>
        {mes !== mesISO(new Date()) && (
          <button onClick={() => setMes(mesISO(new Date()))} className="text-xs text-slate-600 underline ml-1">
            Mes actual
          </button>
        )}
      </div>

      <div id="corte-mes-imprimible">
        <p className="hidden print:block font-bold mb-3">Corte del mes — {mes}</p>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1 print:hidden">
          <TotalBox titulo="Vendido del mes" monto={totalVendido} color="#111827" subtitulo={`${ventasDelMes.length} nota(s)`} />
          <TotalBox titulo="Total de tickets del mes" monto={totalTicketsMes} color="#0f766e" subtitulo={`Ticket promedio: $${ticketPromedioMes.toFixed(2)}`} esConteo />
          <TotalBox titulo="Anticipos cobrados" monto={totalAnticipos} color="#6B7280" subtitulo={`${anticipos.length} pago(s)`} />
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
                  className={`border-t cursor-pointer hover:bg-slate-50 ${folioSel === v.folio ? "bg-slate-50" : ""}`}
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
function ImportarView({ pacientes, setPacientes, inventario, setInventario, config, setConfig }) {
  const [categoria, setCategoria] = useState("Pacientes");
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null); // { encabezados, filas, filasNorm }
  const fileRef = useRef(null);

  function normalizarClave(str) {
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita acentos
      .toLowerCase()
      .replace(/[.:]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function campo(filaNorm, ...alias) {
    for (const a of alias) {
      const clave = normalizarClave(a);
      if (filaNorm[clave] !== undefined && filaNorm[clave] !== "") return filaNorm[clave];
    }
    return "";
  }

  function procesarCSV(text) {
    const lineas = text.split(/\r?\n/).filter(Boolean);
    const headers = lineas[0].split(",").map((h) => h.trim());
    return lineas.slice(1).map((linea) => {
      const valores = linea.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (valores[i] || "").trim()));
      return obj;
    });
  }

  function normalizarFilas(filas) {
    // homogeniza encabezados (acentos, mayúsculas, puntuación) para que coincidan aunque el archivo los escriba distinto
    return filas.map((fila) => {
      const obj = {};
      Object.entries(fila).forEach(([k, v]) => {
        obj[normalizarClave(k)] = typeof v === "string" ? v.trim() : v;
      });
      return obj;
    });
  }

  function manejarArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const esExcel = /\.(xlsx|xls)$/i.test(file.name);
    setProgreso(10);
    setResultado(null);

    const mostrarVistaPrevia = (filas) => {
      setProgreso(100);
      setTimeout(() => setProgreso(null), 400);
      if (filas.length === 0) {
        setResultado({ tipo: categoria, cantidad: 0, error: "El archivo no tiene filas de datos." });
        return;
      }
      const encabezados = Object.keys(filas[0]);
      const filasNorm = normalizarFilas(filas);
      setVistaPrevia({ encabezados, filas: filas.slice(0, 3), filasNorm, totalFilas: filas.length });
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
          mostrarVistaPrevia(filas);
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
        mostrarVistaPrevia(filas);
      };
      reader.readAsText(file);
    }
  }

  function confirmarImportacion() {
    if (!vistaPrevia) return;
    aplicarImportacion(vistaPrevia.filasNorm);
    setVistaPrevia(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function parsearFechaImportacion(valor) {
    if (valor === undefined || valor === null || valor === "") return "";
    try {
      if (valor instanceof Date) {
        return isNaN(valor.getTime()) ? "" : valor.toISOString();
      }
      if (typeof valor === "number") {
        // Número de serie de Excel (días desde 1899-12-30)
        const ms = Math.round((valor - 25569) * 86400 * 1000);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? "" : d.toISOString();
      }
      const texto = String(valor).trim();
      const d = new Date(texto);
      return isNaN(d.getTime()) ? "" : d.toISOString();
    } catch {
      return "";
    }
  }

  function aplicarImportacion(filas) {
    if (categoria === "Pacientes") {
      let lista = [...pacientes];
      let sinNombre = 0;
      filas.forEach((f) => {
        const nombreDetectado = campo(f, "nombre", "nombre completo", "nombre del paciente", "paciente", "name");
        if (!nombreDetectado) sinNombre++;
        const nombre = nombreDetectado || `Sin nombre (fila ${uid().slice(0, 4)})`;
        const claveNombre = nombre.trim().toLowerCase();
        const visita = {
          id: uid(),
          fecha: parsearFechaImportacion(campo(f, "fecha")),
          total: campo(f, "total"),
          anticipo: campo(f, "anticipo"),
          saldo: campo(f, "saldo"),
          fechaPrometido: campo(f, "fecha prometido", "fechaprometido"),
          od: {
            esf: campo(f, "od_esf", "od esf"), cil: campo(f, "od_cil", "od cil"), eje: campo(f, "od_eje", "od eje"),
            di: campo(f, "od_di", "od di"), add: campo(f, "od_add", "od add"), obs: campo(f, "od_obs", "od obs"),
          },
          os: {
            esf: campo(f, "os_esf", "os esf"), cil: campo(f, "os_cil", "os cil"), eje: campo(f, "os_eje", "os eje"),
            di: campo(f, "os_di", "os di"), add: campo(f, "os_add", "os add"), obs: campo(f, "os_obs", "os obs"),
          },
          materialReceta: campo(f, "material_receta", "material receta"),
          cantidad: campo(f, "cantidad"),
          descripcion: campo(f, "descripcion", "descripción"),
          precioMaterial: campo(f, "precio material", "precio_material"),
          totalProducto: campo(f, "total producto", "total_producto"),
          origen: "importado",
        };
        const idx = lista.findIndex((p) => p.nombre.trim().toLowerCase() === claveNombre);
        const domicilio = campo(f, "domicilio", "direccion", "dirección");
        const colonia = campo(f, "colonia");
        const cp = campo(f, "c.p.", "cp", "codigo postal", "código postal");
        const mail = campo(f, "mail", "correo", "email");
        const telefono = campo(f, "telefono", "teléfono", "tel", "celular", "whatsapp", "phone");

        const tieneDatosVisita = [
          visita.fecha, visita.total, visita.anticipo, visita.saldo, visita.fechaPrometido,
          visita.od.esf, visita.od.cil, visita.od.eje, visita.od.di, visita.od.add, visita.od.obs,
          visita.os.esf, visita.os.cil, visita.os.eje, visita.os.di, visita.os.add, visita.os.obs,
          visita.materialReceta, visita.cantidad, visita.descripcion, visita.precioMaterial, visita.totalProducto,
        ].some((v) => v !== "" && v !== undefined && v !== null);

        if (idx === -1) {
          lista.push({
            id: uid(),
            folio: lista.length + 1,
            nombre,
            domicilio,
            colonia,
            cp,
            mail,
            telefono,
            compras: tieneDatosVisita ? [visita] : [],
          });
        } else {
          const p = lista[idx];
          lista[idx] = {
            ...p,
            domicilio: p.domicilio || domicilio,
            colonia: p.colonia || colonia,
            cp: p.cp || cp,
            mail: p.mail || mail,
            telefono: p.telefono || telefono,
            compras: tieneDatosVisita ? [...(p.compras || []), visita] : p.compras || [],
          };
        }
      });
      setPacientes(lista);
      setResultado({
        tipo: "Pacientes",
        cantidad: filas.length,
        aviso:
          sinNombre > 0
            ? `Aviso: ${sinNombre} fila(s) no traían un nombre reconocible y se guardaron como pacientes separados con nombre temporal. Revisa el encabezado de la columna "Nombre" en tu archivo.`
            : "",
      });
    } else {
      const key = { Armazones: "armazones", "Lentes graduados": "lentesGraduados", "Lentes de contacto": "lentesContacto", "Lentes solares": "lentesSolares" }[categoria];
      const listaInv = inventario[key] || [];
      const nuevos = filas.map((f, i) => {
        const base = {
          id: uid(),
          nombre: campo(f, "nombre", "nombre del producto", "name") || "Sin nombre",
          precio: campo(f, "precio", "price") || "0",
          existencias: campo(f, "existencias", "stock") || "0",
          sku: `${key.slice(0, 3).toUpperCase()}-${(listaInv.length + i + 1).toString().padStart(4, "0")}`,
        };
        if (key === "lentesContacto") {
          return {
            ...base,
            marcaContacto: campo(f, "marca"),
            nombreProductoContacto: base.nombre,
            caracteristicas: campo(f, "caracteristicas principales", "caracteristicas", "características principales", "características"),
            rangos: campo(f, "rangos de graduacion", "rangos de graduación", "rangos"),
            presentacion: campo(f, "presentacion", "presentación"),
            tipoLente: campo(f, "tipo de lente", "tipo lente"),
            reemplazo: campo(f, "reemplazo"),
          };
        }
        return base;
      });
      setInventario({ ...inventario, [key]: [...listaInv, ...nuevos] });
      if (key === "lentesContacto") {
        const actual = config?.catalogoLentesContacto || [];
        const combinados = [...actual];
        nuevos.forEach((n) => {
          if (n.marcaContacto && n.nombreProductoContacto && !combinados.some((p) => p.nombreProducto === n.nombreProductoContacto && p.marca === n.marcaContacto)) {
            combinados.push({
              nombreProducto: n.nombreProductoContacto,
              marca: n.marcaContacto,
              caracteristicas: n.caracteristicas,
              rangos: n.rangos,
              presentacion: n.presentacion,
              tipoLente: n.tipoLente,
              reemplazo: n.reemplazo,
              precio: Number(n.precio) || 0,
            });
          }
        });
        setConfig({ ...config, catalogoLentesContacto: combinados });
      }
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
            {resultado.aviso && <p className="text-amber-700 mt-2">{resultado.aviso}</p>}
          </div>
        )}
        {resultado?.error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{resultado.error}</div>
        )}
      </div>

      {vistaPrevia && (
        <div className="bg-white border rounded-xl p-4 mt-4">
          <h3 className="font-semibold text-sm mb-2">Vista previa — confirma antes de importar</h3>
          <p className="text-xs text-slate-500 mb-2">
            Se detectaron {vistaPrevia.totalFilas} fila(s) con estas columnas. Revisa que "Nombre" tenga datos reales
            (no vacío) antes de confirmar.
          </p>
          <div className="overflow-x-auto mb-3">
            <table className="text-xs border-collapse">
              <thead>
                <tr style={{ background: BEIGE }}>
                  {vistaPrevia.encabezados.map((h) => (
                    <th key={h} className="border px-2 py-1 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.filas.map((fila, i) => (
                  <tr key={i}>
                    {vistaPrevia.encabezados.map((h) => (
                      <td key={h} className="border px-2 py-1 whitespace-nowrap">{String(fila[h] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmarImportacion} className="px-4 py-2 rounded-lg text-white text-sm" style={{ background: SKY_DARK }}>
              Confirmar importación ({vistaPrevia.totalFilas} filas)
            </button>
            <button onClick={() => { setVistaPrevia(null); if (fileRef.current) fileRef.current.value = ""; }} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
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
        <h3 className="font-semibold text-slate-700 mb-1">Registro de clientes con Google</h3>
        <p className="text-xs text-slate-500">
          Pega aquí el "Client ID" que te da Google Cloud al crear tus credenciales OAuth. Mientras esto esté vacío,
          el botón de Google en la tienda solo mostrará un aviso y los clientes seguirán pudiendo registrarse con
          nombre y teléfono sin problema.
        </p>
        <Field label="Google Client ID" value={local.googleClientId || ""} onChange={(e) => setLocal({ ...local, googleClientId: e.target.value })} />
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar Client ID
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 mb-1">Pago en línea con PayPal</h3>
        <p className="text-xs text-slate-500">
          Pega aquí el "Client ID" de tu app de PayPal Developer. Mientras esté en modo "Sandbox" son pagos de
          prueba (no se cobra dinero real) — cuando quieras cobrar de verdad, crea el Client ID de producción
          ("Live") en PayPal y pégalo aquí, marcando la casilla de abajo.
        </p>
        <Field label="PayPal Client ID" value={local.paypalClientId || ""} onChange={(e) => setLocal({ ...local, paypalClientId: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!local.paypalModoProduccion}
            onChange={(e) => setLocal({ ...local, paypalModoProduccion: e.target.checked })}
          />
          Este Client ID es de producción (Live) — cobros con dinero real
        </label>
        <button onClick={() => setConfig(local)} className="px-4 py-2 rounded-lg text-white text-sm flex items-center gap-1" style={{ background: SKY_DARK }}>
          <Save size={16} /> Guardar PayPal
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
      const raw = sessionStorage.getItem("spektrum_sesion_cliente");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const setSesionCliente = (s) => {
    setSesionClienteState(s);
    try {
      if (s) sessionStorage.setItem("spektrum_sesion_cliente", JSON.stringify(s));
      else sessionStorage.removeItem("spektrum_sesion_cliente");
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
  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white w-full max-w-sm h-full overflow-y-auto p-6 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
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
function decodificarJWT(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function BotonGoogleReal({ clientId, onCredencial }) {
  const divRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    function iniciar() {
      if (cancelado) return;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        setError("No se pudo cargar el botón de Google. Revisa tu conexión a internet.");
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (respuesta) => {
            const datos = decodificarJWT(respuesta.credential);
            if (datos) onCredencial({ nombre: datos.name || datos.email, mail: datos.email });
            else setError("No se pudo leer tu cuenta de Google.");
          },
        });
        if (divRef.current) {
          window.google.accounts.id.renderButton(divRef.current, { theme: "outline", size: "large", width: 280 });
        }
      } catch {
        setError("No se pudo iniciar el botón de Google. Revisa que el Client ID configurado sea correcto.");
      }
    }

    if (window.google && window.google.accounts && window.google.accounts.id) {
      iniciar();
    } else {
      let script = document.getElementById("google-identity-script");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.id = "google-identity-script";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
      script.addEventListener("load", iniciar);
      return () => script.removeEventListener("load", iniciar);
    }
    return () => {
      cancelado = true;
    };
  }, [clientId]);

  return (
    <div>
      <div ref={divRef} />
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function AccesoDrawer({ open, onClose, pasoInicial, usuarios, setUsuarios, onLoginEmpleado, pacientes, setPacientes, onLoginCliente, config }) {
  const [paso, setPaso] = useState("elegir"); // elegir | empleado | cliente
  const [empUsuario, setEmpUsuario] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empError, setEmpError] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteMail, setClienteMail] = useState("");
  const [clienteError, setClienteError] = useState("");
  const [clienteModo, setClienteModo] = useState("login"); // login | registro
  const [loginContacto, setLoginContacto] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [codigoEsperado, setCodigoEsperado] = useState("");
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [datosPendientes, setDatosPendientes] = useState(null); // { nombre, telefono, mail }

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
    setClienteModo("login");
    setLoginContacto("");
    setVerificando(false);
    setCodigoEsperado("");
    setCodigoIngresado("");
    setEnviandoCodigo(false);
    setDatosPendientes(null);
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

  function buscarPacientePorContacto(valor) {
    const v = valor.trim().toLowerCase();
    if (!v) return null;
    return pacientes.find(
      (p) =>
        (p.telefono && String(p.telefono).trim() === valor.trim()) ||
        (p.mail && String(p.mail).trim().toLowerCase() === v)
    );
  }

  function iniciarSesionCliente() {
    setClienteError("");
    if (!loginContacto.trim()) {
      setClienteError("Escribe el teléfono o correo con el que te registraste.");
      return;
    }
    const paciente = buscarPacientePorContacto(loginContacto);
    if (!paciente) {
      setClienteError("No encontramos ninguna cuenta con ese dato. ¿Aún no tienes cuenta? Créala abajo.");
      return;
    }
    if (!paciente.cuentaActiva) {
      setPacientes(pacientes.map((p) => (p.id === paciente.id ? { ...p, cuentaActiva: true } : p)));
    }
    onLoginCliente({ nombre: paciente.nombre, telefono: paciente.telefono, mail: paciente.mail, pacienteId: paciente.id });
    cerrar();
  }

  function registrarCliente() {
    setClienteError("");
    const telefono = clienteTelefono.trim();
    const mail = clienteMail.trim();
    if (!clienteNombre.trim() || !mail) {
      setClienteError("Escribe tu nombre y tu correo — es obligatorio para poder verificar tu cuenta.");
      return;
    }
    const yaExiste = pacientes.find(
      (p) =>
        (telefono && p.telefono && String(p.telefono).trim() === telefono) ||
        (mail && p.mail && String(p.mail).trim().toLowerCase() === mail.toLowerCase())
    );
    if (yaExiste) {
      setClienteError("Ya existe una cuenta con ese teléfono o correo. Usa 'Iniciar sesión' en su lugar.");
      return;
    }

    // Requiere verificar el correo con un código antes de crear la cuenta
    enviarCodigoAlCorreo(mail, clienteNombre.trim(), telefono);
  }

  function crearCuentaFinal({ nombre, telefono, mail }) {
    const paciente = {
      id: uid(),
      folio: pacientes.length + 1,
      nombre,
      telefono,
      mail,
      compras: [],
      cuentaActiva: true,
    };
    setPacientes([...pacientes, paciente]);
    const msj = mensajeBienvenida(paciente.nombre);
    if (telefono) abrirWhatsApp(telefono, msj.whatsapp);
    onLoginCliente({ nombre: paciente.nombre, telefono: paciente.telefono, mail: paciente.mail, pacienteId: paciente.id });
    cerrar();
  }

  async function enviarCodigoAlCorreo(mail, nombre, telefono) {
    setEnviandoCodigo(true);
    setClienteError("");
    const codigo = generarCodigoVerificacion();
    const enviado = await enviarCodigoPorCorreo(mail, codigo, nombre);
    setEnviandoCodigo(false);
    if (!enviado) {
      setClienteError("No se pudo enviar el código de verificación. Intenta de nuevo en un momento.");
      return;
    }
    setCodigoEsperado(codigo);
    setDatosPendientes({ nombre, telefono, mail });
    setCodigoIngresado("");
    setVerificando(true);
  }

  function verificarCodigoIngresado() {
    setClienteError("");
    if (codigoIngresado.trim() !== codigoEsperado) {
      setClienteError("El código no es correcto. Revisa tu correo e inténtalo de nuevo.");
      return;
    }
    crearCuentaFinal(datosPendientes);
  }


  function entrarConGoogle(datosGoogle) {
    const mailGoogle = (datosGoogle.mail || "").trim().toLowerCase();
    let paciente = pacientes.find((p) => p.mail && String(p.mail).trim().toLowerCase() === mailGoogle);
    const esNuevo = !paciente;
    if (!paciente) {
      paciente = {
        id: uid(),
        folio: pacientes.length + 1,
        nombre: datosGoogle.nombre,
        telefono: "",
        mail: datosGoogle.mail,
        compras: [],
        cuentaActiva: true,
      };
      setPacientes([...pacientes, paciente]);
    } else {
      setPacientes(pacientes.map((p) => (p.id === paciente.id ? { ...p, cuentaActiva: true } : p)));
    }
    if (esNuevo) {
      const msj = mensajeBienvenida(paciente.nombre);
      abrirEmail(paciente.mail, msj.email.asunto, msj.email.cuerpo);
    }
    onLoginCliente({ nombre: paciente.nombre, telefono: paciente.telefono, mail: paciente.mail, pacienteId: paciente.id });
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
          <Field label="Usuario" value={empUsuario} onChange={(e) => setEmpUsuario(e.target.value)} onKeyDown={enterActiva(entrarEmpleado)} />
          <Field label="Contraseña" type="password" value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} onKeyDown={enterActiva(entrarEmpleado)} />
          {empError && <p className="text-xs text-red-600 mb-2">{empError}</p>}
          <BotonNegro onClick={entrarEmpleado} className="mt-2">
            {usuarios.length === 0 ? "Crear cuenta y entrar" : "Iniciar sesión"}
          </BotonNegro>
        </div>
      )}

      {paso === "cliente" && (
        <div>
          <button onClick={() => setPaso("elegir")} className="text-xs text-slate-400 mb-3">← Volver</button>

          {clienteModo === "login" ? (
            <>
              <h2 className="text-xl font-semibold mb-1">Iniciar sesión</h2>
              <p className="text-sm text-slate-500 mb-4">Escribe el teléfono o correo con el que ya tienes cuenta.</p>
              <Field label="Teléfono o correo" value={loginContacto} onChange={(e) => setLoginContacto(e.target.value)} onKeyDown={enterActiva(iniciarSesionCliente)} />
              {clienteError && <p className="text-xs text-red-600 mb-2">{clienteError}</p>}
              <BotonNegro onClick={iniciarSesionCliente} className="mt-2">Iniciar sesión</BotonNegro>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              {config?.googleClientId ? (
                <BotonGoogleReal clientId={config.googleClientId} onCredencial={entrarConGoogle} />
              ) : (
                <BotonContorno onClick={() => setClienteError("El registro con Google todavía no está conectado — pide al administrador que configure el Client ID de Google en Configuración.")}>
                  Continuar con Google
                </BotonContorno>
              )}

              <p className="text-sm text-slate-500 mt-4 text-center">
                ¿Aún no tienes cuenta?{" "}
                <button
                  onClick={() => {
                    setClienteError("");
                    setClienteModo("registro");
                  }}
                  className="underline font-medium text-black"
                >
                  Crear cuenta nueva
                </button>
              </p>
            </>
          ) : verificando ? (
            <>
              <h2 className="text-xl font-semibold mb-1">Verifica tu correo</h2>
              <p className="text-sm text-slate-500 mb-4">
                Te enviamos un código de 6 dígitos a <b>{datosPendientes?.mail}</b>. Escríbelo aquí para activar tu cuenta.
              </p>
              <Field label="Código de verificación" value={codigoIngresado} onChange={(e) => setCodigoIngresado(e.target.value)} onKeyDown={enterActiva(verificarCodigoIngresado)} />
              {clienteError && <p className="text-xs text-red-600 mb-2">{clienteError}</p>}
              <BotonNegro onClick={verificarCodigoIngresado} className="mt-2">Verificar y crear cuenta</BotonNegro>
              <button
                onClick={() => enviarCodigoAlCorreo(datosPendientes.mail, datosPendientes.nombre, datosPendientes.telefono)}
                disabled={enviandoCodigo}
                className="text-sm text-slate-500 underline mt-3 block mx-auto disabled:opacity-40"
              >
                {enviandoCodigo ? "Reenviando…" : "Reenviar código"}
              </button>
              <button
                onClick={() => {
                  setVerificando(false);
                  setClienteError("");
                }}
                className="text-xs text-slate-400 mt-4 block mx-auto"
              >
                ← Corregir mis datos
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1">Crear cuenta nueva</h2>
              <p className="text-sm text-slate-500 mb-4">
                Con tu nombre y tu correo guardamos tus pedidos, tu receta y tu historial para la próxima vez. Te
                vamos a pedir confirmar tu correo con un código antes de activar tu cuenta.
              </p>
              <Field label="Nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} onKeyDown={enterActiva(registrarCliente)} />
              <Field label="Correo (obligatorio)" value={clienteMail} onChange={(e) => setClienteMail(e.target.value)} onKeyDown={enterActiva(registrarCliente)} />
              <Field label="Teléfono (WhatsApp) — opcional" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} onKeyDown={enterActiva(registrarCliente)} />
              {clienteError && <p className="text-xs text-red-600 mb-2">{clienteError}</p>}
              <BotonNegro onClick={registrarCliente} disabled={enviandoCodigo} className="mt-2">
                {enviandoCodigo ? "Enviando código…" : "Crear cuenta"}
              </BotonNegro>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              {config?.googleClientId ? (
                <BotonGoogleReal clientId={config.googleClientId} onCredencial={entrarConGoogle} />
              ) : (
                <BotonContorno onClick={() => setClienteError("El registro con Google todavía no está conectado — pide al administrador que configure el Client ID de Google en Configuración.")}>
                  Continuar con Google
                </BotonContorno>
              )}

              <p className="text-sm text-slate-500 mt-4 text-center">
                ¿Ya tienes cuenta?{" "}
                <button
                  onClick={() => {
                    setClienteError("");
                    setClienteModo("login");
                  }}
                  className="underline font-medium text-black"
                >
                  Iniciar sesión
                </button>
              </p>
            </>
          )}
        </div>
      )}
    </DrawerLateral>
  );
}

/* ---------- Header de la tienda ---------- */
function TiendaHeader({ config, sesionCliente, sesionStaff, carritoCount, onAbrirCarrito, onAbrirAcceso, onIrCategoria, onIrInicio, onVolverPanel, categoriaActiva, onCerrarSesionCliente }) {
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
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
          <div className="relative">
            <button
              onClick={() => (sesionCliente ? setMenuCuentaAbierto(!menuCuentaAbierto) : onAbrirAcceso())}
              className="flex items-center gap-1 text-sm"
            >
              <UserCog size={20} />
              <span className="text-xs sm:text-sm max-w-[70px] sm:max-w-none truncate">{sesionCliente ? sesionCliente.nombre.split(" ")[0] : "Cuenta"}</span>
            </button>
            {menuCuentaAbierto && sesionCliente && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuCuentaAbierto(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-lg py-2 z-50" style={{ minWidth: 180 }}>
                  <p className="px-4 py-1.5 text-xs text-slate-400 truncate">{sesionCliente.nombre}</p>
                  <button
                    onClick={() => {
                      setMenuCuentaAbierto(false);
                      if (window.confirm("¿Cerrar sesión?")) onCerrarSesionCliente();
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
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
function TarjetaArmazonCarrusel({ a, onVerProducto, onAgregarCarrito }) {
  return (
    <div className="border rounded-2xl p-3 hover:shadow-md transition-shadow shrink-0" style={{ width: 170 }}>
      <button onClick={() => onVerProducto({ ...a, categoria: "armazones" })} className="w-full text-left">
        <div className="rounded-xl mb-2 overflow-hidden" style={{ background: "#f4f4f4", height: 110 }}>
          {a.imagen && <img src={a.imagen} alt={a.nombre} className="w-full h-full object-cover" />}
        </div>
        <p className="text-sm font-medium truncate">{a.marcaArmazon ? `${a.marcaArmazon}${a.modeloArmazon ? " · " + a.modeloArmazon : ""}` : a.nombre}</p>
        <p className="text-sm text-slate-500">${a.precio} MXN</p>
      </button>
      <button
        onClick={() => onAgregarCarrito({ ...a, categoria: "armazones" })}
        className="w-full mt-2 py-1.5 rounded-full border border-black text-xs font-medium hover:bg-black hover:text-white transition-colors"
      >
        Agregar
      </button>
    </div>
  );
}

function CarruselLineaArmazones({ titulo, articulos, onVerProducto, onAgregarCarrito }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
      <h3 className="text-lg font-semibold mb-3">{titulo}</h3>
      {articulos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {articulos.map((a) => (
            <TarjetaArmazonCarrusel key={a.id} a={a} onVerProducto={onVerProducto} onAgregarCarrito={onAgregarCarrito} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Aún no hay armazones dados de alta en esta línea.</p>
      )}
    </div>
  );
}

function TiendaInicio({ config, inventario, onIrCategoria, onAgendar, onVerProducto, onAgregarCarrito }) {
  const armazones = inventario?.armazones || [];
  const premium = armazones.filter((a) => a.tipoLinea === "Armazón Línea Premium");
  const media = armazones.filter((a) => a.tipoLinea === "Armazón Línea Estándar");
  const economica = armazones.filter((a) => a.tipoLinea === "Armazón Línea Económica");

  return (
    <div>
      {/* Vista para celular: imagen centrada en la chica + logo/botones debajo, sin encimarse */}
      <div className="sm:hidden">
        {config?.imagenPrincipal ? (
          <div className="w-full overflow-hidden" style={{ height: 220 }}>
            <img
              src={config.imagenPrincipal}
              alt="Spektrum Ópticas"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 25%" }}
            />
          </div>
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: 220, background: "#f4f4f4" }}>
            <p className="text-xs text-slate-300">Sube tu imagen principal desde Configuración</p>
          </div>
        )}
        <div className="text-center px-4 py-6">
          {config?.logo ? (
            <img src={config.logo} alt="Spektrum Ópticas" style={{ mixBlendMode: "multiply" }} className="h-16 mx-auto mb-1" />
          ) : (
            <h1 className="text-2xl font-semibold mb-1">Spektrum Ópticas</h1>
          )}
          <p className="italic font-serif mb-4 text-lg" style={{ lineHeight: 1.1 }}>Mi mirada. Mi estilo</p>
          <div className="flex flex-col gap-2 max-w-[220px] mx-auto">
            <button onClick={onAgendar} className="px-5 py-2.5 rounded-full bg-white border border-black text-sm font-medium">Agendar examen</button>
            <button onClick={() => onIrCategoria("armazones")} className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-medium">¡Yo quiero!</button>
          </div>
        </div>
      </div>

      {/* Vista para tablet/escritorio: logo y botones superpuestos sobre la imagen completa */}
      <div className="hidden sm:block relative">
        {config?.imagenPrincipal ? (
          <img src={config.imagenPrincipal} alt="Spektrum Ópticas" className="w-full h-auto block" />
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: 380, background: "#f4f4f4" }}>
            <p className="text-xs text-slate-300">Sube tu imagen principal desde Configuración</p>
          </div>
        )}
        <div className="absolute inset-0 flex items-center">
          <div className="absolute -translate-x-1/2 left-[80%] max-w-xs md:max-w-sm text-left px-4">
            {config?.logo ? (
              <img
                src={config.logo}
                alt="Spektrum Ópticas"
                style={{ mixBlendMode: "multiply" }}
                className="mb-1 h-36 md:h-[143px]"
              />
            ) : (
              <h1 className="text-4xl md:text-5xl font-semibold mb-1">Spektrum Ópticas</h1>
            )}
            <p className="italic font-serif mb-5 text-2xl md:text-[28px]" style={{ lineHeight: 1.1 }}>Mi mirada. Mi estilo</p>
            <div className="flex flex-col gap-4 max-w-[264px]">
              <button onClick={onAgendar} className="px-8 py-4 rounded-full bg-white border border-black text-base font-medium">Agendar examen</button>
              <button onClick={() => onIrCategoria("armazones")} className="px-8 py-4 rounded-full bg-black text-white text-base font-medium">¡Yo quiero!</button>
            </div>
          </div>
        </div>
      </div>

      <CarruselLineaArmazones titulo="Línea Premium" articulos={premium} onVerProducto={onVerProducto} onAgregarCarrito={onAgregarCarrito} />
      <CarruselLineaArmazones titulo="Línea Media" articulos={media} onVerProducto={onVerProducto} onAgregarCarrito={onAgregarCarrito} />
      <CarruselLineaArmazones titulo="Línea Económica" articulos={economica} onVerProducto={onVerProducto} onAgregarCarrito={onAgregarCarrito} />

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
          <h4 className="font-semibold mb-1">Tiendas</h4>
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
              onKeyDown={enterActiva(suscribir)}
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

function TiendaCategoria({ categoriaActiva, inventario, onVerProducto, onAgregarCarrito, onVolver }) {
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
        (!filtroReemplazo || a.reemplazo === filtroReemplazo) &&
        (!filtroCosmetico || a.tipoLente === filtroCosmetico)
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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm font-medium mb-3 hover:underline">
        <ChevronLeft size={16} /> Volver
      </button>
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
            <option value="">Reemplazo (todos)</option>
            <option>Quincenal</option><option>Mensual</option><option>Anual</option>
          </select>
          <select value={filtroCosmetico} onChange={(e) => setFiltroCosmetico(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs">
            <option value="">Tipo de lente (todos)</option>
            <option>Esférico</option>
            <option>Tórico (Astigmatismo)</option>
            <option>Cosmético / Color</option>
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
function colorHex(nombre) {
  const mapa = {
    Negro: "#1a1a1a", Café: "#6b4423", Azul: "#3b6ea5", Transparente: "#eaeaea",
    Rosa: "#e6a8c4", Traslúcido: "#d8d8d8", Verde: "#4a7c59", Morado: "#6b4c9a",
    Lila: "#b19cd9", "Animal print": "#c9a876", Dorado: "#c9a227", Plata: "#c0c0c0",
    Rojo: "#b5352f", Combinado: "#8a8a8a",
  };
  return mapa[nombre] || "#cccccc";
}

function materialArmazonDesde(categoriaArmazon) {
  if (!categoriaArmazon) return "";
  if (categoriaArmazon.includes("Metal")) return "Metal";
  if (categoriaArmazon.includes("Pasta")) return "Acetato";
  if (categoriaArmazon.includes("Combinado")) return "Combinado (metal y acetato)";
  return "";
}

/* ---------- Probador virtual (cámara + detección de rostro en tiempo real) ---------- */
function ProbadorVirtual({ imagenArmazon, modo, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const imgRef = useRef(null);
  const [estado, setEstado] = useState("iniciando"); // iniciando | listo | error
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function loop() {
      if (cancelado) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && detectorRef.current && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
          const caras = await detectorRef.current.estimateFaces(video);
          if (caras.length > 0 && imgRef.current?.complete) {
            const kp = caras[0].keypoints;
            const ojoIzq = kp[33];
            const ojoDer = kp[263];

            if (modo === "contacto") {
              // Lente de contacto cosmético: se coloca un pequeño círculo del color/imagen sobre cada iris
              const irisIzq = kp[468] || ojoIzq;
              const irisDer = kp[473] || ojoDer;
              const dist = ojoIzq && ojoDer ? Math.hypot(ojoDer.x - ojoIzq.x, ojoDer.y - ojoIzq.y) : 60;
              const radio = dist * 0.16;
              [irisIzq, irisDer].forEach((p) => {
                if (!p) return;
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radio, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(imgRef.current, p.x - radio, p.y - radio, radio * 2, radio * 2);
                ctx.restore();
              });
            } else if (ojoIzq && ojoDer) {
              // Armazón: se coloca la imagen del producto abarcando ambos ojos
              const cx = (ojoIzq.x + ojoDer.x) / 2;
              const cy = (ojoIzq.y + ojoDer.y) / 2;
              const dist = Math.hypot(ojoDer.x - ojoIzq.x, ojoDer.y - ojoIzq.y);
              const angulo = Math.atan2(ojoDer.y - ojoIzq.y, ojoDer.x - ojoIzq.x);
              const ancho = dist * 2.3;
              const alto = ancho * (imgRef.current.height / imgRef.current.width);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(angulo);
              ctx.globalAlpha = 0.92;
              ctx.drawImage(imgRef.current, -ancho / 2, -alto / 2, ancho, alto);
              ctx.restore();
            }
          }
        } catch {
          // se ignora un frame fallido, se sigue intentando
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function iniciar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador no soporta acceso a la cámara.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tf = await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");
        await tf.setBackend("webgl");
        const faceLandmarksDetection = await import("@tensorflow-models/face-landmarks-detection");
        const detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          { runtime: "tfjs", refineLandmarks: modo === "contacto", maxFaces: 1 }
        );
        if (cancelado) return;
        detectorRef.current = detector;

        if (!imagenArmazon) {
          throw new Error("Este producto no tiene ninguna foto subida en Inventario para poder probarlo.");
        }

        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("No se pudo cargar la foto subida de este producto."));
          img.src = imagenArmazon;
        });
        if (cancelado) return;
        imgRef.current = img;

        setEstado("listo");
        loop();
      } catch (e) {
        setMensajeError(e?.message || "No se pudo acceder a la cámara.");
        setEstado("error");
      }
    }

    iniciar();
    return () => {
      cancelado = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [imagenArmazon, modo]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
      <button onClick={onCerrar} className="absolute top-5 right-5 text-white">
        <X size={28} />
      </button>
      {estado === "iniciando" && <p className="text-white text-sm mb-4">Cargando cámara y modelo de rostro… (puede tardar unos segundos la primera vez)</p>}
      {estado === "error" && (
        <div className="text-white text-center px-6 max-w-sm">
          <p className="mb-2">No se pudo abrir la prueba virtual.</p>
          <p className="text-xs text-slate-400">{mensajeError}</p>
          <p className="text-xs text-slate-400 mt-2">Revisa que le hayas dado permiso de cámara a esta página.</p>
        </div>
      )}
      <div className="relative" style={{ maxWidth: "100%", maxHeight: "75vh", display: estado === "listo" ? "block" : "none" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="max-w-full max-h-[75vh] rounded-xl block"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-xl"
          style={{ transform: "scaleX(-1)", pointerEvents: "none" }}
        />
      </div>
      <p className="text-slate-400 text-xs mt-4 max-w-sm text-center">
        {modo === "contacto"
          ? "Prueba virtual del color de tus lentes de contacto en tiempo real usando tu cámara."
          : "Prueba virtual en tiempo real usando tu cámara. Para mejores resultados, sube fotos del armazón de frente y con fondo simple desde Inventario."}
      </p>
    </div>
  );
}

function TiendaProductoPagina({ producto, categoriaLabel, onVolver, onAgregarCarrito }) {
  const [indiceFoto, setIndiceFoto] = useState(0);
  const [tallaSel, setTallaSel] = useState(producto.tallas?.[0] || "");
  const [mostrarTodo, setMostrarTodo] = useState(false);
  const [probadorAbierto, setProbadorAbierto] = useState(false);

  const galeria = [producto.imagen, ...(producto.galeriaExtra || [])].filter(Boolean);
  const esArmazonProducto = producto.categoria === "armazones";
  const requiereReceta = producto.categoria === "lentesGraduados" || producto.categoria === "lentesContacto";
  const materialMostrar = esArmazonProducto ? materialArmazonDesde(producto.categoriaArmazon) : producto.material;

  function siguienteFoto(delta) {
    if (galeria.length === 0) return;
    setIndiceFoto((i) => (i + delta + galeria.length) % galeria.length);
  }

  const esContactoProducto = producto.categoria === "lentesContacto";
  const specsBase = [];
  if (producto.marcaArmazon) specsBase.push(["Marca", producto.marcaArmazon]);
  if (producto.modeloArmazon) specsBase.push(["Modelo", producto.modeloArmazon]);
  if (esContactoProducto && producto.marcaContacto) specsBase.push(["Marca", producto.marcaContacto]);
  if (materialMostrar) specsBase.push(["Material", materialMostrar]);
  if (producto.clipOnCompatible) specsBase.push(["Clip-on compatible", producto.clipOnCompatible]);
  if (esContactoProducto && producto.tipoLente) specsBase.push(["Tipo de lente", producto.tipoLente]);
  if (esContactoProducto && producto.reemplazo) specsBase.push(["Reemplazo", producto.reemplazo]);
  if (esContactoProducto && producto.presentacion) specsBase.push(["Presentación", producto.presentacion]);

  const specsExtra = [];
  if (esArmazonProducto) {
    if (producto.tipoLinea) specsExtra.push(["Línea", producto.tipoLinea]);
    if (producto.categoriaArmazon) specsExtra.push(["Categoría", producto.categoriaArmazon]);
  } else if (esContactoProducto) {
    if (producto.caracteristicas) specsExtra.push(["Características principales", producto.caracteristicas]);
    if (producto.rangos) specsExtra.push(["Rangos de graduación", producto.rangos]);
  } else {
    if (producto.tipo) specsExtra.push(["Tipo", producto.tipo]);
    if (producto.tratamiento) specsExtra.push(["Tratamiento", producto.tratamiento]);
    if (producto.rango) specsExtra.push(["Rango de graduación", producto.rango]);
  }

  const esCosmeticoContacto = esContactoProducto && producto.tipoLente === "Cosmético / Color";
  const puedeProbarse = esArmazonProducto || esCosmeticoContacto;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm font-medium mb-3 hover:underline">
        <ChevronLeft size={16} /> Volver
      </button>
      <p className="text-xs text-slate-400 mb-4">
        Inicio / {categoriaLabel} / {producto.nombre}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div className="relative rounded-2xl overflow-hidden h-64 sm:h-80 md:h-[420px]" style={{ background: "#f4f4f4" }}>
            {galeria.length > 0 ? (
              <img src={galeria[indiceFoto]} alt={producto.nombre} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-300">Sin fotos todavía</div>
            )}
            {puedeProbarse && (
              <button
                onClick={() => {
                  if (galeria.length === 0) {
                    window.alert("Este producto todavía no tiene foto — sube una desde Inventario para poder probártelo.");
                    return;
                  }
                  setProbadorAbierto(true);
                }}
                className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-full px-3 py-1.5 text-xs font-medium shadow"
              >
                <Eye size={14} /> Pruébatelos
              </button>
            )}
          </div>
          {galeria.length > 1 && (
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => siguienteFoto(-1)} className="p-2 rounded-full border hover:bg-slate-50">
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-1.5">
                {galeria.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndiceFoto(i)}
                    className="rounded-full"
                    style={{ width: 7, height: 7, background: i === indiceFoto ? "#000" : "#d4d4d4" }}
                  />
                ))}
              </div>
              <button onClick={() => siguienteFoto(1)} className="p-2 rounded-full border hover:bg-slate-50">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between">
            <h1 className="text-3xl font-semibold mb-1">{producto.nombre}</h1>
            <button className="text-slate-300 hover:text-black mt-1">♡</button>
          </div>
          <p className="text-lg mb-4">
            ${producto.precio} MXN {esArmazonProducto && <span className="text-sm text-slate-400">| Incluye micas graduadas</span>}
            {requiereReceta && <span className="text-sm text-slate-400"> | Requiere receta</span>}
          </p>

          {producto.descripcion && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">{producto.descripcion}</p>
              <div className="flex gap-2">
                {[producto.descripcion].map((c) => (
                  <span key={c} className="w-7 h-7 rounded-full border-2 border-black" style={{ background: colorHex(c) }} title={c} />
                ))}
              </div>
            </div>
          )}

          {producto.tallas?.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-medium mb-2">Tallas disponibles</p>
              <div className="flex gap-2">
                {producto.tallas.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTallaSel(t)}
                    className={`w-9 h-9 rounded-full text-xs font-medium border ${tallaSel === t ? "bg-black text-white border-black" : "border-slate-300"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <BotonNegro onClick={() => onAgregarCarrito({ ...producto, tallaSeleccionada: tallaSel })} className="mb-5">
            Los quiero comprar
          </BotonNegro>

          <div className="space-y-2 text-sm text-slate-600">
            <p>🚚 Envío GRATIS en un máximo de 10 días hábiles</p>
            <p>🛡️ 30 días para cambios y devoluciones</p>
            <p>👓 Pruébatelos en nuestras tiendas</p>
          </div>
        </div>
      </div>

      <div className="mt-14 border-t pt-8">
        <h2 className="text-2xl font-semibold mb-4">Acerca de {producto.nombre}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <p className="text-sm text-slate-600">
            {producto.acercaDe || (esContactoProducto && producto.caracteristicas) || "Aún no se ha escrito la descripción de este producto — se puede agregar desde Inventario."}
          </p>
          <div>
            <table className="w-full text-sm">
              <tbody>
                {specsBase.length === 0 && specsExtra.length === 0 && (
                  <tr>
                    <td className="py-2 text-slate-400">Sin especificaciones capturadas todavía.</td>
                  </tr>
                )}
                {specsBase.map(([k, v]) => (
                  <tr key={k} className="border-t">
                    <td className="py-2 text-slate-500">{k}</td>
                    <td className="py-2 text-right">{v}</td>
                  </tr>
                ))}
                {mostrarTodo &&
                  specsExtra.map(([k, v]) => (
                    <tr key={k} className="border-t">
                      <td className="py-2 text-slate-500">{k}</td>
                      <td className="py-2 text-right">{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {specsExtra.length > 0 && (
              <div className="text-center mt-3">
                <button onClick={() => setMostrarTodo(!mostrarTodo)} className="px-4 py-1.5 rounded-full border text-xs font-medium">
                  {mostrarTodo ? "Mostrar menos" : "Mostrar todo"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {probadorAbierto && (
        <ProbadorVirtual
          imagenArmazon={galeria[indiceFoto] || producto.imagen}
          modo={esCosmeticoContacto ? "contacto" : "armazon"}
          onCerrar={() => setProbadorAbierto(false)}
        />
      )}
    </div>
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
function BotonesPayPal({ clientId, total, onAprobado, onError }) {
  const contenedorRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    function renderizar() {
      if (cancelado || !window.paypal || !contenedorRef.current) return;
      contenedorRef.current.innerHTML = "";
      try {
        window.paypal
          .Buttons({
            style: { layout: "vertical", color: "black", shape: "pill", label: "pay" },
            createOrder: (data, actions) =>
              actions.order.create({
                purchase_units: [{ amount: { value: Number(total).toFixed(2), currency_code: "MXN" } }],
              }),
            onApprove: async (data, actions) => {
              const detalles = await actions.order.capture();
              onAprobado(detalles);
            },
            onError: (err) => {
              setError("Ocurrió un problema con PayPal. Intenta de nuevo.");
              if (onError) onError(err);
            },
          })
          .render(contenedorRef.current);
      } catch {
        setError("No se pudieron cargar los botones de PayPal.");
      }
    }

    if (window.paypal) {
      renderizar();
    } else {
      let script = document.getElementById("paypal-sdk-script");
      if (!script) {
        script = document.createElement("script");
        script.id = "paypal-sdk-script";
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=MXN`;
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener("load", renderizar);
      script.addEventListener("error", () => setError("No se pudo cargar PayPal. Revisa tu conexión."));
      return () => {
        script.removeEventListener("load", renderizar);
      };
    }
    return () => {
      cancelado = true;
    };
  }, [clientId, total]);

  return (
    <div>
      <div ref={contenedorRef} />
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function TiendaCheckout({ open, onClose, carrito, sesionCliente, config, onAbrirAcceso, onConfirmar }) {
  const [receta, setReceta] = useState(null);
  const [formaPagoElegida, setFormaPagoElegida] = useState("entrega"); // entrega | linea
  const [formaPagoEntrega, setFormaPagoEntrega] = useState("efectivo");
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-semibold text-amber-800">Para comprar o crear una cita, primero crea una cuenta.</p>
          </div>
          <p className="text-sm text-slate-500 mb-4">Es rápido: solo necesitas tu nombre y tu teléfono.</p>
          <BotonNegro onClick={onAbrirAcceso}>Crear cuenta / Ingresar</BotonNegro>
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

          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">¿Cómo quieres pagar?</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setFormaPagoElegida("entrega")}
                className={`flex-1 py-2 rounded-full text-xs font-medium border ${formaPagoElegida === "entrega" ? "bg-black text-white border-black" : "border-slate-300"}`}
              >
                Pagar al recoger
              </button>
              <button
                onClick={() => setFormaPagoElegida("linea")}
                disabled={!config?.paypalClientId}
                className={`flex-1 py-2 rounded-full text-xs font-medium border disabled:opacity-40 ${formaPagoElegida === "linea" ? "bg-black text-white border-black" : "border-slate-300"}`}
                title={!config?.paypalClientId ? "El pago en línea todavía no está configurado" : ""}
              >
                Pagar en línea ahora
              </button>
            </div>

            {formaPagoElegida === "entrega" && (
              <select value={formaPagoEntrega} onChange={(e) => setFormaPagoEntrega(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="efectivo">Efectivo al recoger</option>
                <option value="tarjeta">Tarjeta al recoger</option>
                <option value="transferencia">Transferencia bancaria</option>
              </select>
            )}
          </div>

          {formaPagoElegida === "linea" && config?.paypalClientId ? (
            <>
              {!config?.paypalModoProduccion && (
                <p className="text-xs text-amber-600 mb-2">Modo de pruebas: este cobro no usa dinero real todavía.</p>
              )}
              <BotonesPayPal
                clientId={config.paypalClientId}
                total={total}
                onAprobado={(detalles) => onConfirmar(receta, { pagadoEnLinea: true, formaPago: "paypal", referenciaPago: detalles?.id })}
              />
            </>
          ) : (
            <BotonNegro
              onClick={() => onConfirmar(receta, { pagadoEnLinea: false, formaPago: formaPagoEntrega })}
              disabled={carrito.length === 0 || faltaReceta}
            >
              Confirmar pedido
            </BotonNegro>
          )}
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-semibold text-amber-800">Para comprar o crear una cita, primero crea una cuenta.</p>
          </div>
          <p className="text-sm text-slate-500 mb-4">Es rápido: solo necesitas tu nombre y tu teléfono.</p>
          <BotonNegro onClick={onAbrirAcceso}>Crear cuenta / Ingresar</BotonNegro>
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
  const [vista, setVista] = useState("inicio"); // inicio | categoria | producto
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
  const [vistaOrigenProducto, setVistaOrigenProducto] = useState("inicio");
  const [accionPendienteTrasLogin, setAccionPendienteTrasLogin] = useState(null); // 'agendar' | 'checkout' | null

  function agregarCarrito(a) {
    setCarrito([...carrito, { ...a, uidLinea: uid() }]);
  }

  function irCategoria(cat) {
    setCategoriaActiva(cat);
    setVista("categoria");
    window.scrollTo(0, 0);
  }

  function verProducto(p) {
    setVistaOrigenProducto(vista);
    setProductoVer(p);
    setVista("producto");
    window.scrollTo(0, 0);
  }

  function abrirAcceso(pasoInicial) {
    setAccesoPasoInicial(pasoInicial || "elegir");
    setAccesoAbierto(true);
  }

  function abrirExamen() {
    if (!sesionCliente) {
      setAccionPendienteTrasLogin("agendar");
      abrirAcceso("cliente");
      return;
    }
    setAgendarAbierto(true);
  }

  function abrirCuenta() {
    abrirAcceso("cliente");
  }

  function confirmarPedido(receta, infoPago) {
    let paciente = pacientes.find((p) => p.id === sesionCliente.pacienteId);
    const folio = (ventas[ventas.length - 1]?.folio || 0) + 1;
    const total = carrito.reduce((s, c) => s + Number(c.precio || 0), 0);
    const pagadoEnLinea = infoPago?.pagadoEnLinea;
    const nota = {
      folio,
      fecha: new Date().toISOString(),
      pacienteId: sesionCliente.pacienteId,
      nombreCliente: paciente?.nombre || sesionCliente.nombre,
      items: carrito,
      total,
      abono: pagadoEnLinea ? total : 0,
      saldo: pagadoEnLinea ? 0 : total,
      estatus: pagadoEnLinea ? "venta" : "presupuesto",
      formaPago: infoPago?.formaPago || "pendiente",
      referenciaPago: infoPago?.referenciaPago || "",
      vendedor: "Tienda en línea",
      origen: "portal",
      recetaArchivo: receta,
    };
    setVentas([...ventas, nota]);
    const msj = pagadoEnLinea ? mensajeAgradecimiento(nota.nombreCliente) : mensajePedidoRecibido(nota.nombreCliente, folio);
    if (sesionCliente.telefono) abrirWhatsApp(sesionCliente.telefono, msj.whatsapp);
    if (sesionCliente.mail) abrirEmail(sesionCliente.mail, msj.email.asunto, msj.email.cuerpo);
    setCarrito([]);
    setCheckoutAbierto(false);
    setMensajeFinal(
      pagadoEnLinea
        ? `¡Pago recibido! Tu pedido #${folio} quedó confirmado. Te avisamos por WhatsApp o correo cuando esté listo.`
        : `¡Listo! Tu pedido quedó registrado con folio #${folio}. Te avisamos por WhatsApp o correo en cuanto esté confirmado.`
    );
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
        onCerrarSesionCliente={() => {
          setSesionCliente(null);
          setMensajeFinal("Cerraste sesión correctamente.");
        }}
      />

      {mensajeFinal && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-sm text-center py-2 px-4">
          {mensajeFinal}
          <button onClick={() => setMensajeFinal("")} className="ml-3 underline">Cerrar</button>
        </div>
      )}

      {vista === "inicio" ? (
        <TiendaInicio
          config={config}
          inventario={inventario}
          onIrCategoria={irCategoria}
          onAgendar={abrirExamen}
          onVerProducto={verProducto}
          onAgregarCarrito={agregarCarrito}
        />
      ) : vista === "producto" ? (
        <TiendaProductoPagina
          producto={productoVer}
          categoriaLabel={
            { armazones: "Armazones", lentesGraduados: "Lentes graduados", lentesContacto: "Lentes de contacto", lentesSolares: "Lentes solares", accesorios: "Accesorios" }[
              productoVer?.categoria
            ] || ""
          }
          onVolver={() => setVista(vistaOrigenProducto)}
          onAgregarCarrito={(p) => {
            agregarCarrito(p);
            setCarritoAbierto(true);
          }}
        />
      ) : (
        <TiendaCategoria
          categoriaActiva={categoriaActiva}
          inventario={inventario}
          onVerProducto={verProducto}
          onAgregarCarrito={agregarCarrito}
          onVolver={() => setVista("inicio")}
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
        config={config}
        onAbrirAcceso={() => {
          setAccionPendienteTrasLogin("checkout");
          abrirAcceso("cliente");
        }}
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
        onAbrirAcceso={() => {
          setAccionPendienteTrasLogin("agendar");
          abrirAcceso("cliente");
        }}
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
        config={config}
        onLoginCliente={(datos) => {
          setSesionCliente(datos);
          if (accionPendienteTrasLogin === "agendar") setAgendarAbierto(true);
          else if (accionPendienteTrasLogin === "checkout") setCheckoutAbierto(true);
          else setMensajeFinal(`¡Listo, ${datos.nombre.split(" ")[0]}! Tu cuenta ya está activa.`);
          setAccionPendienteTrasLogin(null);
        }}
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

function GraficaDonut({ segmentos, size = 150, grosor = 20, valorCentro, tituloCentro }) {
  const radio = (size - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const total = segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0);
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radio} fill="none" stroke="#e5e7eb" strokeWidth={grosor} />
        {total > 0 &&
          segmentos.map((seg, i) => {
            const frac = Math.max(0, seg.valor) / total;
            if (frac <= 0) return null;
            const largo = frac * circunferencia;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radio}
                fill="none"
                stroke={seg.color}
                strokeWidth={grosor}
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={-acumulado}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            acumulado += largo;
            return el;
          })}
        <text x="50%" y="47%" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111827">
          {valorCentro}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="9" fill="#64748b">
          {tituloCentro}
        </text>
      </svg>
      <div className="mt-2 space-y-1">
        {segmentos.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-slate-600">{seg.label}:</span>
            <span className="font-medium">{seg.textoValor}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
        <h3 className="font-semibold text-slate-700 mb-4">Resumen ejecutivo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 justify-items-center">
          <GraficaDonut
            tituloCentro="de la meta"
            valorCentro={`${Math.min(999, pctMeta).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(alcanzado, meta), color: "#111827", label: "Vendido", textoValor: `$${alcanzado.toFixed(2)}` },
              { valor: Math.max(0, meta - alcanzado), color: "#e5e7eb", label: "Falta para la meta", textoValor: `$${Math.max(0, meta - alcanzado).toFixed(2)}` },
            ]}
          />
          <GraficaDonut
            tituloCentro="cobrado de lo vendido"
            valorCentro={`${(datosMes.vendido > 0 ? (Math.min(datosMes.cobrado, datosMes.vendido) / datosMes.vendido) * 100 : 0).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(datosMes.cobrado, datosMes.vendido), color: "#059669", label: "Cobrado", textoValor: `$${Math.min(datosMes.cobrado, datosMes.vendido).toFixed(2)}` },
              { valor: Math.max(0, datosMes.vendido - datosMes.cobrado), color: "#fca5a5", label: "Por cobrar", textoValor: `$${Math.max(0, datosMes.vendido - datosMes.cobrado).toFixed(2)}` },
            ]}
          />
          <GraficaDonut
            tituloCentro="proyectado de la meta"
            valorCentro={`${Math.min(999, pctProyectado).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(proyectadoVendido, meta), color: "#f59e0b", label: "Proyectado", textoValor: `$${proyectadoVendido.toFixed(2)}` },
              { valor: Math.max(0, meta - proyectadoVendido), color: "#e5e7eb", label: "Falta para la meta", textoValor: `$${Math.max(0, meta - proyectadoVendido).toFixed(2)}` },
            ]}
          />
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
  const proyectadoAnual = promedioMensual * 12;
  const pctProyectadoAnual = totalAnioMeta > 0 ? (proyectadoAnual / totalAnioMeta) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-slate-500 uppercase">Año</label>
        <button onClick={() => setAnio(anio - 1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-lg">{anio}</span>
        <button onClick={() => setAnio(anio + 1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight size={16} /></button>
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
        <TotalBox titulo="Meta anual" monto={totalAnioMeta} color="#111827" />
        <TotalBox titulo="Vendido anual" monto={totalAnioVendido} color="#0f766e" subtitulo={`${pctAnio.toFixed(1)}% de la meta`} />
        <TotalBox titulo="Cobrado anual" monto={totalAnioCobrado} color="#059669" />
        <TotalBox titulo="Pago a proveedores anual" monto={totalAnioGastos} color="#7c3aed" />
        <TotalBox titulo="Debe haber en caja" monto={debeHaberCajaAnual} color={debeHaberCajaAnual >= 0 ? "#0d9488" : "#dc2626"} subtitulo="Cobrado anual − pago a proveedores" />
        <TotalBox titulo="Promedio mensual" monto={promedioMensual} color="#7c3aed" subtitulo={`${mesesConDatos.length} mes(es) con datos`} />
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-slate-700 mb-4">Resumen ejecutivo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 justify-items-center">
          <GraficaDonut
            tituloCentro="de la meta anual"
            valorCentro={`${Math.min(999, pctAnio).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(totalAnioVendido, totalAnioMeta), color: "#111827", label: "Vendido", textoValor: `$${totalAnioVendido.toFixed(2)}` },
              { valor: Math.max(0, totalAnioMeta - totalAnioVendido), color: "#e5e7eb", label: "Falta para la meta", textoValor: `$${Math.max(0, totalAnioMeta - totalAnioVendido).toFixed(2)}` },
            ]}
          />
          <GraficaDonut
            tituloCentro="cobrado de lo vendido"
            valorCentro={`${(totalAnioVendido > 0 ? (Math.min(totalAnioCobrado, totalAnioVendido) / totalAnioVendido) * 100 : 0).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(totalAnioCobrado, totalAnioVendido), color: "#059669", label: "Cobrado", textoValor: `$${Math.min(totalAnioCobrado, totalAnioVendido).toFixed(2)}` },
              { valor: Math.max(0, totalAnioVendido - totalAnioCobrado), color: "#fca5a5", label: "Por cobrar", textoValor: `$${Math.max(0, totalAnioVendido - totalAnioCobrado).toFixed(2)}` },
            ]}
          />
          <GraficaDonut
            tituloCentro="proyectado de la meta"
            valorCentro={`${Math.min(999, pctProyectadoAnual).toFixed(0)}%`}
            segmentos={[
              { valor: Math.min(proyectadoAnual, totalAnioMeta), color: "#f59e0b", label: "Proyectado", textoValor: `$${proyectadoAnual.toFixed(2)}` },
              { valor: Math.max(0, totalAnioMeta - proyectadoAnual), color: "#e5e7eb", label: "Falta para la meta", textoValor: `$${Math.max(0, totalAnioMeta - proyectadoAnual).toFixed(2)}` },
            ]}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          El proyectado anual se calcula extendiendo el promedio mensual real (${promedioMensual.toFixed(2)}) a los 12 meses del año.
        </p>
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
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1 text-xs text-slate-600">Guardando cambios…</div>
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
            sesion={sesion}
          />
        )}
        {seccion === "inventario" && <InventarioView inventario={inventario} setInventario={setInventario} config={config} setConfig={setConfig} />}
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
          <ImportarView pacientes={pacientes} setPacientes={setPacientes} inventario={inventario} setInventario={setInventario} config={config} setConfig={setConfig} />
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
