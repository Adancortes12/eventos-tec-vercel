import { useEffect, useRef, useState } from "react";

import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";

import ModalEditarEvento from "../../components/admin/ModalEditarEvento";
import ModalQrEvento from "../../components/admin/ModalQrEvento";
import { descargarExcel, fechaHoraParaExcel, fechaParaExcel } from "../../lib/exportarExcel";
import type { ReporteExcel } from "../../lib/exportarExcel";

type Evento = {
  id: string;
  codigo_evento: string;
  nombre: string;
  descripcion: string | null;
  fecha_evento: string;
  hora_evento: string;
  estado: string;
  fecha_activacion: string;
  duracion_minutos: number;
  cierre_inscripcion: string | null;
};

type ContextoAdmin = {
  puedeCrearEventos: boolean;
  rol: "maestro" | "admin" | "superadmin";
};

type Inscripcion = {
  id: string;
  numero_estudiante: string;
  nombre_completo: string;
  registrado_en: string;
  asistio: boolean;
  asistio_en: string | null;
};

type DatosDetalle = {
  evento: Evento;
  inscripciones: Inscripcion[];
};

type TipoReporte = "general" | "carrera";

type EstudianteReporte = {
  id: string;
  numeroCuenta: string;
  nombre: string;
  genero: "Hombre" | "Mujer" | null;
  carrera: string | null;
  asistio: boolean;
  horaAsistencia: string | null;
};

type DatosReporte = {
  evento: Evento;
  filtro: {
    tipo: TipoReporte;
    carrera: string | null;
  };
  carreras: string[];
  datosSitec: {
    pendientes: number;
    actualizacion: {
      solicitada: boolean;
      actualizados: number;
      errores: number;
    };
  };
  resumen: {
    numeroRegistros: number;
    asistenciasHombres: number;
    asistenciasMujeres: number;
    asistenciasTotal: number;
    porcentajeAsistencia: number;
    faltantes: number;
  };
  estudiantes: EstudianteReporte[];
  advertencias: string[];
};

async function obtenerDatosEvento(
  id: string,
): Promise<DatosDetalle> {
  const respuesta = await fetch(
    `/api/eventos/detalle?eventoId=${encodeURIComponent(id)}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      datos.error ?? "No se pudo cargar el evento.",
    );
  }

  return {
    evento: datos.evento,
    inscripciones: datos.inscripciones ?? [],
  };
}

async function obtenerReporte(
  eventoId: string,
  tipo: TipoReporte,
  carrera?: string,
  actualizar = false,
): Promise<DatosReporte> {
  const parametros = new URLSearchParams({
    eventoId,
    tipo,
  });

  if (tipo === "carrera" && carrera) {
    parametros.set("carrera", carrera);
  }

  if (actualizar) {
    parametros.set("actualizar", "true");
  }

  const respuesta = await fetch(
    `/api/reportes/evento?${parametros.toString()}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      datos.error ?? "No se pudo generar el reporte.",
    );
  }

  return datos as DatosReporte;
}

function formatearFecha(
  valor: string | null | undefined,
): string {
  if (!valor) {
    return "—";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return valor;
  }

  return fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatearHora(
  valor: string | null | undefined,
): string {
  if (!valor) {
    return "—";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return valor;
  }

  return fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function generarNombreArchivoReporte(
  datos: DatosReporte,
): string {
  const codigoEvento =
    datos.evento.codigo_evento
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-");

  if (
    datos.filtro.tipo === "carrera" &&
    datos.filtro.carrera
  ) {
    const carrera =
      datos.filtro.carrera
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `Reporte_${codigoEvento}_${carrera}`;
  }

  return `Reporte_${codigoEvento}_General`;
}

function contenidoExcelEvento(datos: DatosReporte): ReporteExcel {
  return {
    titulo: "Reporte de asistencia por evento",
    nombreArchivo: generarNombreArchivoReporte(datos),
    resumen: [
      { etiqueta: "Código del evento", valor: datos.evento.codigo_evento },
      { etiqueta: "Evento", valor: datos.evento.nombre },
      { etiqueta: "Fecha del evento", valor: fechaParaExcel(datos.evento.fecha_evento), formato: "dd/mm/yyyy" },
      { etiqueta: "Hora del evento", valor: datos.evento.hora_evento },
      { etiqueta: "Estado", valor: datos.evento.estado },
      { etiqueta: "Tipo de reporte", valor: datos.filtro.tipo === "carrera" ? "Por carrera" : "General" },
      { etiqueta: "Carrera", valor: datos.filtro.carrera ?? "Todas las carreras" },
      { etiqueta: "Registros", valor: datos.resumen.numeroRegistros, formato: "#,##0" },
      { etiqueta: "Asistencias de hombres", valor: datos.resumen.asistenciasHombres, formato: "#,##0" },
      { etiqueta: "Asistencias de mujeres", valor: datos.resumen.asistenciasMujeres, formato: "#,##0" },
      { etiqueta: "Asistencias totales", valor: datos.resumen.asistenciasTotal, formato: "#,##0" },
      { etiqueta: "Faltantes", valor: datos.resumen.faltantes, formato: "#,##0" },
      { etiqueta: "Porcentaje de asistencia", valor: datos.resumen.porcentajeAsistencia / 100, formato: "0.0%" },
      { etiqueta: "Datos institucionales pendientes", valor: datos.datosSitec.pendientes, formato: "#,##0" },
      { etiqueta: "Zona horaria de asistencia", valor: "Ciudad de México (America/Mexico_City)" },
    ],
    hojas: [{
      nombre: "Asistencia",
      columnas: [
        { titulo: "Número de cuenta", ancho: 22, formato: "@" },
        { titulo: "Nombre", ancho: 44, formato: "@" },
        { titulo: "Género", ancho: 15, formato: "@" },
        { titulo: "Carrera", ancho: 48, formato: "@" },
        { titulo: "Asistió", ancho: 14, formato: "@" },
        { titulo: "Fecha de asistencia (CDMX)", ancho: 25, formato: "dd/mm/yyyy" },
        { titulo: "Hora de asistencia (CDMX)", ancho: 25, formato: "hh:mm:ss" },
      ],
      filas: datos.estudiantes.map((alumno) => {
        const asistencia = alumno.asistio ? fechaHoraParaExcel(alumno.horaAsistencia) : null;
        return [
          alumno.numeroCuenta, alumno.nombre, alumno.genero ?? "Sin dato", alumno.carrera ?? "Sin dato",
          alumno.asistio ? "Sí" : "No", asistencia, asistencia,
        ];
      }),
    }],
  };
}

export default function DetalleEvento() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { puedeCrearEventos } =
    useOutletContext<ContextoAdmin>();

  const [evento, setEvento] =
    useState<Evento | null>(null);

  const [inscripciones, setInscripciones] =
    useState<Inscripcion[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [modalEditarAbierto, setModalEditarAbierto] =
    useState(false);

  const [modalQrAbierto, setModalQrAbierto] =
    useState(false);

  /*
   * REPORTES
   */
  const [tipoReporte, setTipoReporte] =
    useState<TipoReporte>("general");

  const [carreraReporte, setCarreraReporte] =
    useState("");

  const [reporte, setReporte] =
    useState<DatosReporte | null>(null);

  const [carrerasDisponibles, setCarrerasDisponibles] =
    useState<string[]>([]);

  const [cargandoCarreras, setCargandoCarreras] =
    useState(false);

  const [cargandoReporte, setCargandoReporte] =
    useState(false);

  const [actualizandoSitec, setActualizandoSitec] =
    useState(false);

  const [exportandoExcel, setExportandoExcel] = useState(false);
  const consultaExcel = useRef<AbortController | null>(null);

  const [errorReporte, setErrorReporte] =
    useState("");

  const [mensajeReporte, setMensajeReporte] =
    useState("");

  useEffect(() => {
  return () => {
    consultaExcel.current?.abort();
  };
}, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let activo = true;

    obtenerDatosEvento(id)
      .then((datos) => {
        if (!activo) {
          return;
        }

        setEvento(datos.evento);
        setInscripciones(datos.inscripciones);
        setError("");
      })
      .catch((errorConsulta: unknown) => {
        if (!activo) {
          return;
        }

        if (errorConsulta instanceof Error) {
          setError(errorConsulta.message);
        } else {
          setError(
            "Ocurrió un error al cargar el evento.",
          );
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [id]);

  const refrescarDatos = async () => {
    if (!id) {
      return;
    }

    try {
      const datos =
        await obtenerDatosEvento(id);

      setEvento(datos.evento);
      setInscripciones(datos.inscripciones);
      setError("");
    } catch (errorConsulta) {
      console.error(errorConsulta);

      setError(
        "No se pudo actualizar la información del evento.",
      );
    }
  };

  const actualizarEvento = async () => {
    setModalEditarAbierto(false);
    await refrescarDatos();
  };

  const finalizarEvento = async () => {
    if (!evento) {
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que quieres finalizar este evento?",
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        "/api/eventos/finalizar",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            eventoId: evento.id,
          }),
        },
      );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {
        window.alert(
          datos.error ??
            "No se pudo finalizar el evento.",
        );

        return;
      }

      await refrescarDatos();
    } catch (error) {
      console.error(error);

      window.alert(
        "No se pudo conectar con el servidor.",
      );
    }
  };

  const eliminarEvento = async () => {
    if (!evento) {
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar este evento? Esta acción no se puede deshacer.",
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        "/api/eventos/eliminar",
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            eventoId: evento.id,
          }),
        },
      );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {
        window.alert(
          datos.error ??
            "No se pudo eliminar el evento.",
        );

        return;
      }

      navigate("/admin/eventos");
    } catch (error) {
      console.error(error);

      window.alert(
        "No se pudo conectar con el servidor.",
      );
    }
  };

  /*
   * Generar el reporte normal.
   *
   * Esta operación NO consulta SITEc.
   */
  const generarReporte = async () => {
    if (!id) {
      return;
    }

    if (
      tipoReporte === "carrera" &&
      !carreraReporte
    ) {
      setErrorReporte(
        "Selecciona una carrera para generar el reporte.",
      );

      return;
    }

    setCargandoReporte(true);
    setErrorReporte("");
    setMensajeReporte("");

    try {
      const datos =
        await obtenerReporte(
          id,
          tipoReporte,
          tipoReporte === "carrera"
            ? carreraReporte
            : undefined,
          false,
        );

      setReporte(datos);
      setCarrerasDisponibles(datos.carreras);

      if (
        datos.carreras.length > 0 &&
        !carreraReporte
      ) {
        setCarreraReporte(
          datos.carreras[0],
        );
      }

      setMensajeReporte(
        "Reporte generado correctamente.",
      );
    } catch (errorConsulta) {
      console.error(
        errorConsulta,
      );

      setErrorReporte(
        errorConsulta instanceof Error
          ? errorConsulta.message
          : "No se pudo generar el reporte.",
      );
    } finally {
      setCargandoReporte(false);
    }
  };

  /*
   * Actualizar datos institucionales desde SITEc.
   *
   * Esta es la operación pesada.
   * Solo se ejecuta cuando el usuario
   * la solicita explícitamente.
   */
  const actualizarDatosSitec = async () => {
    if (!id) {
      return;
    }

    const confirmar =
      window.confirm(
        "Esta acción consultará los datos institucionales de SITEc para los estudiantes registrados en este evento. Puede tardar varios segundos. ¿Deseas continuar?",
      );

    if (!confirmar) {
      return;
    }

    setActualizandoSitec(true);
    setErrorReporte("");
    setMensajeReporte("");

    try {
      const datos =
        await obtenerReporte(
          id,
          tipoReporte,
          tipoReporte === "carrera"
            ? carreraReporte
            : undefined,
          true,
        );

      setReporte(datos);
      setCarrerasDisponibles(datos.carreras);

      setMensajeReporte(
        `Datos de SITEc actualizados. ${datos.datosSitec.actualizacion.actualizados} registros fueron actualizados.`,
      );
    } catch (errorConsulta) {
      console.error(
        errorConsulta,
      );

      setErrorReporte(
        errorConsulta instanceof Error
          ? errorConsulta.message
          : "No se pudieron actualizar los datos de SITEc.",
      );
    } finally {
      setActualizandoSitec(false);
    }
  };

  /*
   * Si cambiamos de general a carrera,
   * mantenemos el último reporte para no
   * perder información visual.
   */
  const cambiarTipoReporte = async (
    nuevoTipo: TipoReporte,
  ) => {
    setTipoReporte(nuevoTipo);
    setErrorReporte("");
    setMensajeReporte("");

    if (
      nuevoTipo === "general" ||
      carrerasDisponibles.length > 0
    ) {
      return;
    }

    if (!id) {
      return;
    }

    setCargandoCarreras(true);

    try {
      /*
       * Solo cargamos el catálogo de carreras.
       * Esto NO consulta SITEc.
       */
      const datos =
        await obtenerReporte(
          id,
          "general",
        );

      setCarrerasDisponibles(
        datos.carreras,
      );

      if (
        datos.carreras.length > 0
      ) {
        setCarreraReporte(
          datos.carreras[0],
        );
      }
    } catch (errorConsulta) {
      console.error(
        errorConsulta,
      );

      setErrorReporte(
        errorConsulta instanceof Error
          ? errorConsulta.message
          : "No se pudieron cargar las carreras.",
      );
    } finally {
      setCargandoCarreras(false);
    }
  };

  const imprimirReporte = () => {
    if (!reporte || cargandoReporte || actualizandoSitec || exportandoExcel) {
      return;
    }

    const nombreArchivo =
      generarNombreArchivoReporte(reporte);

    const tituloAnterior = document.title;

    document.title = nombreArchivo;
    document.body.classList.add("modo-impresion");

    const restaurar = () => {
      document.title = tituloAnterior;
      document.body.classList.remove("modo-impresion");
    };

    window.addEventListener("afterprint", restaurar, {
      once: true,
    });

    window.print();
  };

  const descargarReporteExcel = async () => {
    if (!reporte || reporte.evento.id !== id || cargandoReporte || actualizandoSitec || exportandoExcel) return;
    const controlador = new AbortController();
    consultaExcel.current = controlador;
    setExportandoExcel(true);
    setErrorReporte("");
    setMensajeReporte("");
    try {
      if (reporte.estudiantes.length !== reporte.resumen.numeroRegistros) {
        throw new Error("El reporte no contiene todos los registros. Genera de nuevo el reporte antes de descargar el Excel.");
      }
      // Exporta el resultado generado, incluido su filtro de carrera, sin consultar SITEc.
      await descargarExcel(contenidoExcelEvento(reporte), controlador.signal);
      if (!controlador.signal.aborted) setMensajeReporte("Archivo Excel preparado correctamente.");
    } catch (errorConsulta) {
      if (!controlador.signal.aborted) {
        setErrorReporte(errorConsulta instanceof Error ? errorConsulta.message : "No se pudo descargar el Excel.");
      }
    } finally {
      if (consultaExcel.current === controlador && !controlador.signal.aborted) setExportandoExcel(false);
    }
  };

  if (!id) {
    return (
      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-red-600">
          Evento no válido.
        </p>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="py-10">
        <p className="text-gray-600">
          Cargando evento...
        </p>
      </div>
    );
  }

  if (error || !evento) {
    return (
      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-red-600">
          {error ||
            "Evento no encontrado."}
        </p>
      </div>
    );
  }

  const totalRegistrados =
    inscripciones.length;

  const totalAsistieron =
    inscripciones.filter(
      (inscripcion) =>
        inscripcion.asistio,
    ).length;

  const totalPendientes =
    totalRegistrados -
    totalAsistieron;

  const porcentajeAsistencia =
    totalRegistrados > 0
      ? (
          (totalAsistieron /
            totalRegistrados) *
          100
        ).toFixed(1)
      : "0.0";

  const carrerasReporte =
    carrerasDisponibles.length > 0
      ? carrerasDisponibles
      : reporte?.carreras ?? [];

  return (
    <div>
      <style>{`
        @media print {
          body.modo-impresion * {
            visibility: hidden !important;
          }

          body.modo-impresion .reporte-impresion,
          body.modo-impresion .reporte-impresion * {
            visibility: visible !important;
          }

          body.modo-impresion .reporte-impresion {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          body.modo-impresion .no-print {
            display: none !important;
          }

          /*
           * En pantalla las tablas tienen un ancho mínimo para
           * poder desplazarse horizontalmente. En el PDF eso
           * provoca que la última columna quede fuera de la hoja.
           * En impresión eliminamos ese mínimo y repartimos las
           * cinco columnas dentro del ancho disponible.
           */
          body.modo-impresion .reporte-tabla-contenedor {
            overflow: visible !important;
            width: 100% !important;
          }

          body.modo-impresion .reporte-tabla {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            font-size: 9.5pt !important;
          }

          body.modo-impresion .reporte-tabla th,
          body.modo-impresion .reporte-tabla td {
            padding: 7px 6px !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
            vertical-align: top !important;
          }

          body.modo-impresion .reporte-tabla th:nth-child(1),
          body.modo-impresion .reporte-tabla td:nth-child(1) {
            width: 14% !important;
          }

          body.modo-impresion .reporte-tabla th:nth-child(2),
          body.modo-impresion .reporte-tabla td:nth-child(2) {
            width: 27% !important;
          }

          body.modo-impresion .reporte-tabla th:nth-child(3),
          body.modo-impresion .reporte-tabla td:nth-child(3) {
            width: 12% !important;
          }

          body.modo-impresion .reporte-tabla th:nth-child(4),
          body.modo-impresion .reporte-tabla td:nth-child(4) {
            width: 30% !important;
          }

          body.modo-impresion .reporte-tabla th:nth-child(5),
          body.modo-impresion .reporte-tabla td:nth-child(5) {
            width: 17% !important;
          }

          body.modo-impresion .reporte-tabla thead {
            display: table-header-group !important;
          }

          body.modo-impresion .reporte-tabla tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          @page {
            margin: 12mm;
          }
        }
      `}</style>

      <div className="print:hidden">
        <Link
          to="/admin/eventos"
          className="text-sm font-medium text-[#1B396A] transition hover:opacity-80"
        >
          ← Volver a eventos
        </Link>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-7 print:hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-[#1B396A]">
                {evento.codigo_evento}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  evento.estado === "activo"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {evento.estado ===
                "activo"
                  ? "Activo"
                  : "Finalizado"}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-[#1F2937]">
              {evento.nombre}
            </h1>

            {evento.descripcion && (
              <p className="mt-3 max-w-3xl whitespace-pre-line text-gray-600">
                {evento.descripcion}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-700">
                  Fecha:
                </span>{" "}
                {evento.fecha_evento}
              </p>

              <p>
                <span className="font-medium text-gray-700">
                  Hora:
                </span>{" "}
                {evento.hora_evento}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            {evento.estado ===
              "activo" && (
              <Link
                to={`/admin/eventos/${evento.id}/escanear`}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Pasar asistencia
              </Link>
            )}

            <button
              type="button"
              onClick={() =>
                setModalQrAbierto(
                  true,
                )
              }
              className="rounded-lg border border-[#1B396A]/30 px-4 py-2 text-sm font-semibold text-[#1B396A] transition hover:bg-[#EEF2F7]"
            >
              Ver enlace y QR
            </button>

            {puedeCrearEventos &&
              evento.estado ===
                "activo" && (
                <button
                  type="button"
                  onClick={() =>
                    setModalEditarAbierto(
                      true,
                    )
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F5F5]"
                >
                  Editar evento
                </button>
              )}

            {puedeCrearEventos &&
              evento.estado ===
                "activo" && (
                <button
                  type="button"
                  onClick={
                    finalizarEvento
                  }
                  className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
                >
                  Finalizar evento
                </button>
              )}

            {puedeCrearEventos &&
              inscripciones.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    eliminarEvento
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Eliminar evento
                </button>
              )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-600">
            Registrados
          </p>

          <p className="mt-2 text-3xl font-bold text-[#1F2937]">
            {totalRegistrados}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-600">
            Asistieron
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            {totalAsistieron}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-600">
            Pendientes
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {totalPendientes}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-600">
            Porcentaje de asistencia
          </p>

          <p className="mt-2 text-3xl font-bold text-[#1B396A]">
            {porcentajeAsistencia}%
          </p>
        </div>
      </section>

      {/* =====================================================
          REPORTES
      ====================================================== */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#1B396A]/10 bg-white shadow print:shadow-none print:border-0">
        <div className="border-b border-gray-200 bg-[#F8FAFC] p-5 sm:p-6 print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-8 w-1 rounded-full bg-[#1B396A]" />

                <h2 className="text-xl font-bold text-[#1F2937]">
                  Reportes de asistencia
                </h2>
              </div>

              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Genera el reporte del evento o
                consulta únicamente una carrera.
                Los reportes normales utilizan los
                datos almacenados y no realizan
                consultas a SITEc.
              </p>
            </div>

            <div className="rounded-lg border border-[#1B396A]/15 bg-white px-4 py-3 text-xs text-gray-600">
              <p className="font-semibold text-[#1B396A]">
                Datos institucionales
              </p>
              <p className="mt-1">
                SITEc se consulta únicamente
                cuando solicitas una actualización.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Tipo de reporte
              </label>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    cambiarTipoReporte(
                      "general",
                    )
                  }
                  disabled={exportandoExcel}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    tipoReporte ===
                    "general"
                      ? "bg-white text-[#1B396A] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Reporte general
                </button>

                <button
                  type="button"
                  onClick={() =>
                    cambiarTipoReporte(
                      "carrera",
                    )
                  }
                  disabled={exportandoExcel}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    tipoReporte ===
                    "carrera"
                      ? "bg-white text-[#1B396A] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Por carrera
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="carrera-reporte"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Filtrar por carrera
              </label>

              <select
                id="carrera-reporte"
                value={carreraReporte}
                onChange={(event) =>
                  setCarreraReporte(
                    event.target.value,
                  )
                }
                disabled={
                  tipoReporte !==
                  "carrera" ||
                  cargandoReporte ||
                  actualizandoSitec ||
                  exportandoExcel ||
                  cargandoCarreras
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">
                  Selecciona una carrera
                </option>

                {carrerasReporte.map(
                  (carrera) => (
                    <option
                      key={carrera}
                      value={carrera}
                    >
                      {carrera}
                    </option>
                  ),
                )}
              </select>

              {tipoReporte ===
                "carrera" &&
                cargandoCarreras && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Cargando carreras...
                  </p>
                )}
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={generarReporte}
                disabled={
                  cargandoReporte ||
                  actualizandoSitec ||
                  exportandoExcel ||
                  (tipoReporte ===
                    "carrera" &&
                    !carreraReporte)
                }
                className="w-full rounded-xl bg-[#1B396A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#142B52] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                {cargandoReporte
                  ? "Generando..."
                  : "Generar reporte"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1B396A]">
                Actualización de datos institucionales
              </p>

              <p className="mt-1 text-xs leading-5 text-gray-600">
                Consulta SITEc y actualiza género y
                carrera de los estudiantes registrados.
                Esta operación puede tardar varios
                segundos.
              </p>
            </div>

            <button
              type="button"
              onClick={actualizarDatosSitec}
              disabled={
                cargandoReporte ||
                actualizandoSitec ||
                exportandoExcel ||
                (tipoReporte ===
                  "carrera" &&
                  !carreraReporte)
              }
              className="shrink-0 rounded-lg border border-[#1B396A]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1B396A] transition hover:bg-[#EEF2F7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actualizandoSitec
                ? "Actualizando SITEc..."
                : "Actualizar datos de SITEc"}
            </button>
          </div>

          {mensajeReporte && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {mensajeReporte}
            </div>
          )}

          {errorReporte && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorReporte}
            </div>
          )}
        </div>

        {reporte && (
          <div
            id="reporte-asistencia"
            className="reporte-impresion bg-white p-5 sm:p-8"
          >
            <div className="border-b-4 border-[#1B396A] pb-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-[#1B396A]">
                    TECNOLÓGICO NACIONAL DE MÉXICO
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-[#1F2937]">
                    Instituto Tecnológico de Colima
                  </h2>

                  <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Reporte de asistencia
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 px-4 py-3 text-left sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Código del evento
                  </p>

                  <p className="mt-1 font-bold text-[#1B396A]">
                    {reporte.evento.codigo_evento}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Generado:{" "}
                    {new Date().toLocaleString(
                      "es-MX",
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Evento
                </p>

                <h3 className="mt-1 text-xl font-bold text-[#1F2937]">
                  {reporte.evento.nombre}
                </h3>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                  <span>
                    <strong className="text-gray-700">
                      Fecha:
                    </strong>{" "}
                    {formatearFecha(
                      reporte.evento.fecha_evento,
                    )}
                  </span>

                  <span>
                    <strong className="text-gray-700">
                      Hora:
                    </strong>{" "}
                    {reporte.evento.hora_evento}
                  </span>

                  <span>
                    <strong className="text-gray-700">
                      Tipo:
                    </strong>{" "}
                    {reporte.filtro.tipo ===
                    "carrera"
                      ? "Por carrera"
                      : "General"}
                  </span>

                  {reporte.filtro.carrera && (
                    <span>
                      <strong className="text-gray-700">
                        Carrera:
                      </strong>{" "}
                      {reporte.filtro.carrera}
                    </span>
                  )}
                </div>
              </div>

              <div className="no-print flex flex-wrap items-end justify-start gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={imprimirReporte}
                  disabled={cargandoReporte || actualizandoSitec || exportandoExcel}
                  className="no-print rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => void descargarReporteExcel()}
                  disabled={cargandoReporte || actualizandoSitec || exportandoExcel}
                  className="no-print rounded-lg border border-[#1B396A]/30 px-4 py-2.5 text-sm font-semibold text-[#1B396A] transition hover:bg-[#EEF2F7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportandoExcel ? "Preparando Excel…" : "Descargar Excel"}
                </button>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Registros
                </p>
                <p className="mt-2 text-2xl font-bold text-[#1F2937]">
                  {reporte.resumen.numeroRegistros}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hombres
                </p>
                <p className="mt-2 text-2xl font-bold text-[#1B396A]">
                  {reporte.resumen.asistenciasHombres}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mujeres
                </p>
                <p className="mt-2 text-2xl font-bold text-[#1B396A]">
                  {reporte.resumen.asistenciasMujeres}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Asistencias
                </p>
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {reporte.resumen.asistenciasTotal}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Faltantes
                </p>
                <p className="mt-2 text-2xl font-bold text-yellow-700">
                  {reporte.resumen.faltantes}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-[#F3F6FA] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Porcentaje de asistencia
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Asistencias registradas respecto al
                  total de registros.
                </p>
              </div>

              <p className="text-3xl font-bold text-[#1B396A]">
                {reporte.resumen.porcentajeAsistencia}%
              </p>
            </div>

            {reporte.datosSitec.actualizacion
              .solicitada && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <strong>
                  Actualización SITEc:
                </strong>{" "}
                {
                  reporte.datosSitec
                    .actualizacion
                    .actualizados
                }{" "}
                registros actualizados y{" "}
                {
                  reporte.datosSitec
                    .actualizacion
                    .errores
                }{" "}
                con incidencia.
              </div>
            )}

            {reporte.datosSitec
              .pendientes > 0 && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                Hay{" "}
                <strong>
                  {
                    reporte.datosSitec
                      .pendientes
                  }
                </strong>{" "}
                registros sin algún dato
                institucional disponible.
              </div>
            )}

            {reporte.advertencias.length >
              0 && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 print:hidden">
                <p className="font-semibold">
                  Observaciones de actualización
                </p>

                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {reporte.advertencias
                    .slice(0, 10)
                    .map(
                      (
                        advertencia,
                        indice,
                      ) => (
                        <li key={indice}>
                          {advertencia}
                        </li>
                      ),
                    )}
                </ul>
              </div>
            )}

            <div className="mt-7">
              <div className="flex flex-col gap-2 border-b border-gray-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#1F2937]">
                    Relación de estudiantes
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Número de cuenta, nombre,
                    género, carrera y hora de
                    asistencia.
                  </p>
                </div>

                <p className="text-sm font-semibold text-[#1B396A]">
                  {reporte.estudiantes.length} registros
                </p>
              </div>

              {reporte.estudiantes.length ===
              0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  No hay estudiantes para los
                  criterios seleccionados.
                </div>
              ) : reporte.filtro.tipo === "general" ? (
                <div className="mt-4 space-y-7">
                  {Object.entries(
                    reporte.estudiantes.reduce<
                      Record<string, EstudianteReporte[]>
                    >((grupos, estudiante) => {
                      const carrera =
                        estudiante.carrera?.trim() ||
                        "No disponible";

                      if (!grupos[carrera]) {
                        grupos[carrera] = [];
                      }

                      grupos[carrera].push(estudiante);

                      return grupos;
                    }, {}),
                  )
                    .sort(([carreraA], [carreraB]) =>
                      carreraA.localeCompare(
                        carreraB,
                        "es",
                        { sensitivity: "base" },
                      ),
                    )
                    .map(([carrera, estudiantes]) => (
                      <section
                        key={carrera}
                        className="break-inside-avoid-page"
                      >
                        <div className="flex items-center justify-between border-b-2 border-[#1B396A] pb-2">
                          <h4 className="text-base font-bold uppercase text-[#1B396A]">
                            {carrera}
                          </h4>

                          <span className="text-sm font-semibold text-gray-500">
                            {estudiantes.length}{" "}
                            {estudiantes.length === 1
                              ? "estudiante"
                              : "estudiantes"}
                          </span>
                        </div>

                        <div className="reporte-tabla-contenedor mt-3 overflow-x-auto">
                          <table className="reporte-tabla w-full min-w-[900px] border-collapse text-left">
                            <thead>
                              <tr className="border-b-2 border-[#1B396A]/20 bg-[#F8FAFC]">
                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                                  Número de cuenta
                                </th>

                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                                  Nombre
                                </th>

                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                                  Género
                                </th>

                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                                  Carrera
                                </th>

                                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                                  Hora de asistencia
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {estudiantes.map((estudiante) => (
                                <tr
                                  key={estudiante.id}
                                  className="border-b border-gray-100"
                                >
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                                    {estudiante.numeroCuenta}
                                  </td>

                                  <td className="px-4 py-3 text-sm font-medium text-[#1F2937]">
                                    {estudiante.nombre}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {estudiante.genero ?? "No disponible"}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {estudiante.carrera ?? "No disponible"}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {estudiante.asistio
                                      ? formatearHora(
                                          estudiante.horaAsistencia,
                                        )
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <div className="reporte-tabla-contenedor mt-3 overflow-x-auto">
                  <table className="reporte-tabla w-full min-w-[900px] border-collapse text-left">
                    <thead>
                      <tr className="border-b-2 border-[#1B396A]/20 bg-[#F8FAFC]">
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                          Número de cuenta
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                          Nombre
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                          Género
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                          Carrera
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#1B396A]">
                          Hora de asistencia
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {reporte.estudiantes.map((estudiante) => (
                        <tr
                          key={estudiante.id}
                          className="border-b border-gray-100"
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                            {estudiante.numeroCuenta}
                          </td>

                          <td className="px-4 py-3 text-sm font-medium text-[#1F2937]">
                            {estudiante.nombre}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {estudiante.genero ?? "No disponible"}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {estudiante.carrera ?? "No disponible"}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {estudiante.asistio
                              ? formatearHora(
                                  estudiante.horaAsistencia,
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
              Documento generado por el sistema de
              Eventos Estudiantiles del Instituto
              Tecnológico de Colima.
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl bg-white shadow print:hidden">
        <div className="border-b border-gray-200 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1F2937]">
                Estudiantes registrados
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Consulta el registro y estado de
                asistencia de los estudiantes.
              </p>
            </div>

            <p className="text-sm font-medium text-gray-600">
              Total: {totalRegistrados}
            </p>
          </div>
        </div>

        {inscripciones.length ===
        0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-gray-700">
              Aún no hay estudiantes registrados.
            </p>

            <p className="mt-1 text-sm text-gray-600">
              Los estudiantes aparecerán aquí
              cuando se registren al evento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-600">
                    Número
                  </th>

                  <th className="px-5 py-3 text-sm font-semibold text-gray-600">
                    Nombre
                  </th>

                  <th className="px-5 py-3 text-sm font-semibold text-gray-600">
                    Registro
                  </th>

                  <th className="px-5 py-3 text-sm font-semibold text-gray-600">
                    Estado
                  </th>

                  <th className="px-5 py-3 text-sm font-semibold text-gray-600">
                    Hora de asistencia
                  </th>
                </tr>
              </thead>

              <tbody>
                {inscripciones.map(
                  (inscripcion) => (
                    <tr
                      key={
                        inscripcion.id
                      }
                      className="border-t border-gray-100"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {
                          inscripcion.numero_estudiante
                        }
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-[#1F2937]">
                        {
                          inscripcion.nombre_completo
                        }
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {new Date(
                          inscripcion.registrado_en,
                        ).toLocaleString(
                          "es-MX",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {inscripcion.asistio ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Asistió
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {inscripcion.asistio_en
                          ? new Date(
                              inscripcion.asistio_en,
                            ).toLocaleString(
                              "es-MX",
                            )
                          : "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalEditarAbierto && (
        <ModalEditarEvento
          evento={evento}
          cerrar={() =>
            setModalEditarAbierto(
              false,
            )
          }
          alActualizar={
            actualizarEvento
          }
        />
      )}

      {modalQrAbierto && (
        <ModalQrEvento
          codigoEvento={
            evento.codigo_evento
          }
          nombreEvento={
            evento.nombre
          }
          cerrar={() =>
            setModalQrAbierto(
              false,
            )
          }
        />
      )}
    </div>
  );
}
