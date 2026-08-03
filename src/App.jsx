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
function POSView({ pacientes, setPacientes, inventario, ventas, setVentas, presetPacienteId, clearPreset, presetCobroFolio, clearPresetCobro, config, laboratorio, setLaboratorio, sesion }) {
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [busquedaArt, setBusquedaArt] = useState("");
  const [categoriaArtSel, setCategoriaArtSel] = useState("");
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

  const [cobrandoFolio, setCobrandoFolio] = useState(null);
  const [montoCobroFolio, setMontoCobroFolio] = useState("");
  const [formaPagoCobroFolio, setFormaPagoCobroFolio] = useState("efectivo");

  useEffect(() => {
    if (presetCobroFolio) {
      const venta = ventas.find((v) => v.folio === presetCobroFolio);
      if (venta) {
        setCobrandoFolio(presetCobroFolio);
        setMontoCobroFolio(venta.saldo.toString());
      }
      clearPresetCobro();
    }
  }, [presetCobroFolio]);

  function registrarCobroFolio() {
    const monto = Number(montoCobroFolio || 0);
    if (!cobrandoFolio || monto <= 0) return;
    setVentas(
      ventas.map((v) => {
        if (v.folio !== cobrandoFolio) return v;
        const nuevoAbono = v.abono + monto;
        const nuevoSaldo = Math.max(0, v.saldo - monto);
        const pago = { fecha: new Date().toISOString(), monto, formaPago: formaPagoCobroFolio, tipo: "liquidacion" };
        return { ...v, abono: nuevoAbono, saldo: nuevoSaldo, pagos: [...(v.pagos || []), pago] };
      })
    );
    setCobrandoFolio(null);
    setMontoCobroFolio("");
  }

  const todosArticulos = Object.entries(inventario).flatMap(([cat, arr]) =>
    arr.map((a) => ({ ...a, categoria: cat }))
  );
  const articulosFiltrados = todosArticulos.filter(
    (a) =>
      (!busquedaArt || a.nombre.toLowerCase().includes(busquedaArt.toLowerCase())) &&
      (!categoriaArtSel || a.categoria === categoriaArtSel)
  );

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
          <div className="flex gap-2 mb-2">
            <select
              value={categoriaArtSel}
              onChange={(e) => setCategoriaArtSel(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Todas las categorías</option>
              <option value="armazones">Armazones</option>
              <option value="lentesGraduados">Lentes graduados</option>
              <option value="lentesContacto">Lentes de contacto</option>
              <option value="lentesSolares">Lentes solares</option>
              <option value="accesorios">Accesorios</option>
            </select>
            <input
              value={busquedaArt}
              onChange={(e) => setBusquedaArt(e.target.value)}
              placeholder="Nombre del artículo..."
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
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

      <Modal open={!!cobrandoFolio} onClose={() => setCobrandoFolio(null)} title={`Cobrar saldo pendiente — Folio #${cobrandoFolio}`}>
        {(() => {
          const venta = ventas.find((v) => v.folio === cobrandoFolio);
          if (!venta) return null;
          return (
            <div>
              <p className="text-sm mb-1">Cliente: <b>{venta.nombreCliente}</b></p>
              <p className="text-sm text-slate-500 mb-4">
                Total: ${venta.total.toFixed(2)} · Abonado: ${venta.abono.toFixed(2)} · Saldo pendiente: ${venta.saldo.toFixed(2)}
              </p>
              <Field label="Monto a cobrar" type="number" value={montoCobroFolio} onChange={(e) => setMontoCobroFolio(e.target.value)} />
              <label className="block mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase">Forma de pago</span>
                <select value={formaPagoCobroFolio} onChange={(e) => setFormaPagoCobroFolio(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <button onClick={registrarCobroFolio} className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ background: SKY_DARK }}>
                Registrar cobro
              </button>
            </div>
          );
        })()}
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
              <select value={nuevo.tratamiento} onChange={(e) => setNuevo({ ...nuevo, tratamiento: e.target.value })} className="block border rounded-lg px-2 py-1.5 text-sm
