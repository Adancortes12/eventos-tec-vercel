import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Link,
} from "react-router";

import {
  supabase,
} from "../../lib/supabase";

import {
  descargarExcel,
  fechaArchivoExcel,
  fechaParaExcel,
} from "../../lib/exportarExcel";

import type {
  ReporteExcel,
} from "../../lib/exportarExcel";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type Evento = {
  id: string;
  codigo_evento: string;
  nombre: string;
  fecha_evento: string;
  hora_evento: string | null;
  estado: string;
};

type FiltroParticipacion =
  | "todos"
  | "100"
  | "75-99"
  | "50-74"
  | "lt50";

type Filtros = {
  eventoIds: string[];
  carrera: string;
  participacion: FiltroParticipacion;
  busqueda: string;
};

type Estudiante = {
  numeroCuenta: string;
  nombre: string;

  genero:
    | "Hombre"
    | "Mujer"
    | null;

  carrera:
    | string
    | null;

  totalAsistio: number;
  totalInscribio: number;
  porcentaje: number;
};

type ReporteParticipacion = {
  eventos: {
    id: string;
    codigo: string;
    nombre: string;
    fecha: string;
    hora: string | null;
    estado: string;
  }[];

  filtros: {
    eventos: string[];
    carrera: string | null;
    participacion: FiltroParticipacion;
    busqueda: string | null;
  };

  carreras: string[];

  resumen: {
    totalAlumnos: number;
    totalInscripciones: number;
    totalAsistencias: number;

    promedioParticipacion:
      number;

    participacion100:
      number;

    participacion75_99:
      number;

    participacion50_74:
      number;

    participacionMenor50:
      number;
  };

  paginacion: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };

  estudiantes:
    Estudiante[];
};

type DetalleAlumno = {
  estudiante:
    Estudiante;

  eventos: {
    eventoId: string;

    codigoEvento:
      string;

    nombreEvento:
      string;

    fechaEvento:
      string;

    horaEvento:
      string | null;

    inscrito:
      boolean;

    asistio:
      boolean;

    horaAsistencia:
      string | null;

    fechaRegistro:
      string | null;
  }[];
};

/*
 * =====================================================
 * OPCIONES
 * =====================================================
 */

const CARRERAS_INICIALES = [
  "ARQUITECTURA",

  "CONTADOR PUBLICO",

  "INGENIERIA AMBIENTAL",

  "INGENIERIA BIOQUIMICA",

  "INGENIERIA EN GESTION EMPRESARIAL",

  "INGENIERIA EN INTELIGENCIA ARTIFICIAL",

  "INGENIERIA EN SISTEMAS COMPUTACIONALES",

  "INGENIERIA INDUSTRIAL",

  "INGENIERIA INFORMATICA",

  "INGENIERIA MECATRONICA",

  "LICENCIATURA EN ADMINISTRACION",
];

const OPCIONES_PARTICIPACION: {
  valor:
    FiltroParticipacion;

  texto:
    string;
}[] = [
  {
    valor: "todos",
    texto:
      "Todos los porcentajes",
  },

  {
    valor: "100",
    texto: "100%",
  },

  {
    valor: "75-99",
    texto:
      "75% a menos de 100%",
  },

  {
    valor: "50-74",
    texto:
      "50% a menos de 75%",
  },

  {
    valor: "lt50",
    texto:
      "Menos de 50%",
  },
];

const CLASE_INPUT =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/10 disabled:bg-slate-100 disabled:opacity-60";

const CLASE_BOTON =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/*
 * =====================================================
 * UTILIDADES
 * =====================================================
 */

function normalizarTexto(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase();
}

function formatearNumero(
  valor: number
) {
  return new Intl.NumberFormat(
    "es-MX"
  ).format(valor);
}

function formatearPorcentaje(
  valor: number
) {
  return `${new Intl.NumberFormat(
    "es-MX",
    {
      maximumFractionDigits:
        1,
    }
  ).format(valor)}%`;
}

function formatearFecha(
  valor:
    | string
    | null
) {
  if (!valor) {
    return "—";
  }

  const partes =
    valor
      .slice(0, 10)
      .split("-")
      .map(Number);

  const fecha =
    new Date(
      partes[0],
      partes[1] - 1,
      partes[2]
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(fecha);
}

function formatearFechaHora(
  valor:
    | string
    | null
) {
  if (!valor) {
    return "—";
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone:
        "America/Mexico_City",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        true,
    }
  ).format(fecha);
}

function mensajeError(
  error: unknown
) {
  return error instanceof
    Error
    ? error.message
    : "No se pudo completar la consulta.";
}

/*
 * =====================================================
 * PARÁMETROS DEL REPORTE
 * =====================================================
 */

function parametrosReporte(
  filtros: Filtros,
  pagina = 1,
  porPagina = 20
) {
  const parametros =
    new URLSearchParams({
      eventoIds:
        filtros.eventoIds.join(
          ","
        ),

      participacion:
        filtros.participacion,

      pagina:
        String(pagina),

      porPagina:
        String(porPagina),
    });

  if (
    filtros.carrera.trim()
  ) {
    parametros.set(
      "carrera",
      filtros.carrera.trim()
    );
  }

  if (
    filtros.busqueda.trim()
  ) {
    parametros.set(
      "busqueda",
      filtros.busqueda.trim()
    );
  }

  return parametros;
}

/*
 * =====================================================
 * CONSULTA
 * =====================================================
 */

async function consultarReporte<T>(
  parametros:
    URLSearchParams,

  signal:
    AbortSignal
): Promise<T> {
  const respuesta =
    await fetch(
      `/api/reportes/participacion?${parametros.toString()}`,
      {
        method: "GET",

        credentials:
          "include",

        signal,
      }
    );

  const datos =
    await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      datos.error ??
        "No se pudo generar el reporte."
    );
  }

  return datos as T;
}

function filtrosDelReporte(
  reporte:
    ReporteParticipacion
): Filtros {
  return {
    eventoIds:
      reporte.filtros.eventos,

    carrera:
      reporte.filtros.carrera ??
      "",

    participacion:
      reporte.filtros
        .participacion,

    busqueda:
      reporte.filtros.busqueda ??
      "",
  };
}

/*
 * =====================================================
 * OBTENER TODOS LOS ALUMNOS
 * =====================================================
 */

async function consultarReporteCompleto(
  reporte:
    ReporteParticipacion,

  signal:
    AbortSignal,

  comprobarContinuacion?:
    () => void
): Promise<ReporteParticipacion> {
  const filtros =
    filtrosDelReporte(
      reporte
    );

  comprobarContinuacion?.();

  const completo =
    await consultarReporte<ReporteParticipacion>(
      parametrosReporte(
        filtros,
        1,
        1000
      ),

      signal
    );

  const alumnos = [
    ...completo.estudiantes,
  ];

  for (
    let pagina = 2;
    pagina <=
    completo.paginacion
      .totalPaginas;
    pagina++
  ) {
    comprobarContinuacion?.();

    const bloque =
      await consultarReporte<ReporteParticipacion>(
        parametrosReporte(
          filtros,
          pagina,
          1000
        ),

        signal
      );

    alumnos.push(
      ...bloque.estudiantes
    );
  }

  return {
    ...completo,
    estudiantes: alumnos,
  };
}

/*
 * =====================================================
 * EXCEL
 * =====================================================
 */

function contenidoExcelParticipacion(
  reporte:
    ReporteParticipacion
): ReporteExcel {
  const rango =
    OPCIONES_PARTICIPACION.find(
      (opcion) =>
        opcion.valor ===
        reporte.filtros
          .participacion
    )?.texto ??
    "Todos los porcentajes";

  return {
    titulo:
      "Reporte de participación estudiantil",

    nombreArchivo:
      `Reporte_Participacion_${fechaArchivoExcel()}`,

    resumen: [
      {
        etiqueta:
          "Carrera",

        valor:
          reporte.filtros
            .carrera ??
          "Todas las carreras",
      },

      {
        etiqueta:
          "Participación",

        valor:
          rango,
      },

      {
        etiqueta:
          "Búsqueda",

        valor:
          reporte.filtros
            .busqueda ??
          "Todos los alumnos",
      },

      {
        etiqueta:
          "Eventos seleccionados",

        valor:
          reporte.eventos
            .length,

        formato:
          "#,##0",
      },

      {
        etiqueta:
          "Alumnos analizados",

        valor:
          reporte.resumen
            .totalAlumnos,

        formato:
          "#,##0",
      },

      {
        etiqueta:
          "Inscripciones",

        valor:
          reporte.resumen
            .totalInscripciones,

        formato:
          "#,##0",
      },

      {
        etiqueta:
          "Asistencias",

        valor:
          reporte.resumen
            .totalAsistencias,

        formato:
          "#,##0",
      },

      {
        etiqueta:
          "Promedio de participación",

        valor:
          reporte.resumen
            .promedioParticipacion /
          100,

        formato:
          "0.0%",
      },

      {
        etiqueta:
          "Alumnos con 100%",

        valor:
          reporte.resumen
            .participacion100,

        formato:
          "#,##0",
      },
    ],

    hojas: [
      {
        nombre:
          "Participación",

        columnas: [
          {
            titulo:
              "Número de cuenta",

            ancho: 22,

            formato: "@",
          },

          {
            titulo:
              "Nombre",

            ancho: 44,

            formato: "@",
          },

          {
            titulo:
              "Género",

            ancho: 15,

            formato: "@",
          },

          {
            titulo:
              "Carrera",

            ancho: 48,

            formato: "@",
          },

          {
            titulo:
              "Eventos asistidos",

            ancho: 20,

            formato:
              "#,##0",
          },

          {
            titulo:
              "Eventos inscritos",

            ancho: 20,

            formato:
              "#,##0",
          },

          {
            titulo:
              "Participación (%)",

            ancho: 20,

            formato:
              "0.0%",
          },
        ],

        filas:
          reporte.estudiantes.map(
            (alumno) => [
              alumno.numeroCuenta,

              alumno.nombre,

              alumno.genero ??
                "Sin dato",

              alumno.carrera ??
                "Sin dato",

              alumno.totalAsistio,

              alumno.totalInscribio,

              alumno.porcentaje /
                100,
            ]
          ),
      },

      {
        nombre:
          "Eventos",

        columnas: [
          {
            titulo:
              "Código del evento",

            ancho: 24,

            formato: "@",
          },

          {
            titulo:
              "Nombre del evento",

            ancho: 56,

            formato: "@",
          },

          {
            titulo:
              "Fecha",

            ancho: 18,

            formato:
              "dd/mm/yyyy",
          },

          {
            titulo:
              "Hora",

            ancho: 16,

            formato: "@",
          },

          {
            titulo:
              "Estado",

            ancho: 20,

            formato: "@",
          },
        ],

        filas:
          reporte.eventos.map(
            (evento) => [
              evento.codigo,

              evento.nombre,

              fechaParaExcel(
                evento.fecha
              ),

              evento.hora ??
                "Sin dato",

              evento.estado,
            ]
          ),
      },
    ],
  };
}

/*
 * =====================================================
 * IMPRESIÓN
 * =====================================================
 */

function escaparHtml(
  valor: unknown
) {
  return String(
    valor ?? ""
  ).replace(
    /[&<>"']/g,
    (caracter) => {
      const entidades:
        Record<
          string,
          string
        > = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entidades[
        caracter
      ];
    }
  );
}

function documentoImpresion(
  reporte:
    ReporteParticipacion
) {
  const filas =
    reporte.estudiantes
      .map(
        (alumno) => `
        <tr>
          <td>${escaparHtml(alumno.numeroCuenta)}</td>
          <td>${escaparHtml(alumno.nombre)}</td>
          <td>${escaparHtml(alumno.carrera ?? "Sin dato")}</td>
          <td>${alumno.totalInscribio}</td>
          <td>${alumno.totalAsistio}</td>
          <td>${escaparHtml(formatearPorcentaje(alumno.porcentaje))}</td>
        </tr>
      `
      )
      .join("");

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Reporte de participación</title>

      <style>
        @page {
          size: letter landscape;
          margin: 12mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #243247;
        }

        h1 {
          color: #1B396A;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th {
          background: #1B396A;
          color: white;
        }

        th,
        td {
          padding: 7px;
          border-bottom: 1px solid #ddd;
          text-align: left;
        }
      </style>
    </head>

    <body>
      <h1>
        Reporte de participación estudiantil
      </h1>

      <p>
        Instituto Tecnológico de Colima
      </p>

      <p>
        Carrera:
        <strong>
          ${escaparHtml(
            reporte.filtros.carrera ??
              "Todas las carreras"
          )}
        </strong>
      </p>

      <p>
        Eventos seleccionados:
        <strong>
          ${reporte.eventos.length}
        </strong>
      </p>

      <table>
        <thead>
          <tr>
            <th>Número</th>
            <th>Nombre</th>
            <th>Carrera</th>
            <th>Inscritos</th>
            <th>Asistidos</th>
            <th>Participación</th>
          </tr>
        </thead>

        <tbody>
          ${
            filas ||
            `
            <tr>
              <td colspan="6">
                No existen alumnos.
              </td>
            </tr>
          `
          }
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function paginasVisibles(
  actual: number,
  total: number
) {
  const valores =
    new Set<number>();

  valores.add(1);

  valores.add(total);

  for (
    let pagina =
      Math.max(
        1,
        actual - 2
      );

    pagina <=
    Math.min(
      total,
      actual + 2
    );

    pagina++
  ) {
    valores.add(
      pagina
    );
  }

  return [
    ...valores,
  ]
    .filter(
      (pagina) =>
        pagina >= 1 &&
        pagina <= total
    )
    .sort(
      (a, b) =>
        a - b
    );
}

/*
 * =====================================================
 * COMPONENTE
 * =====================================================
 */

export default function Participacion() {
  const [
    eventos,
    setEventos,
  ] =
    useState<Evento[]>([]);

  const [
    cargandoEventos,
    setCargandoEventos,
  ] =
    useState(true);

  const [
    errorEventos,
    setErrorEventos,
  ] =
    useState("");

  const [
    busquedaEventos,
    setBusquedaEventos,
  ] =
    useState("");

  const [
    filtros,
    setFiltros,
  ] =
    useState<Filtros>({
      eventoIds: [],

      carrera: "",

      participacion:
        "todos",

      busqueda: "",
    });

  const [
    carrerasDisponibles,
    setCarrerasDisponibles,
  ] =
    useState<string[]>(
      CARRERAS_INICIALES
    );

  const [
    porPagina,
    setPorPagina,
  ] =
    useState(20);

  const [
    reporte,
    setReporte,
  ] =
    useState<ReporteParticipacion | null>(
      null
    );

  const [
    generando,
    setGenerando,
  ] =
    useState(false);

  const [
    imprimiendo,
    setImprimiendo,
  ] =
    useState(false);

  const [
    exportandoExcel,
    setExportandoExcel,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    alumnoSeleccionado,
    setAlumnoSeleccionado,
  ] =
    useState<Estudiante | null>(
      null
    );

  const [
    detalle,
    setDetalle,
  ] =
    useState<DetalleAlumno | null>(
      null
    );

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] =
    useState(false);

  const [
    errorDetalle,
    setErrorDetalle,
  ] =
    useState("");

  const consultaLista =
    useRef<AbortController | null>(
      null
    );

  const consultaDetalle =
    useRef<AbortController | null>(
      null
    );

  const consultaImpresion =
    useRef<AbortController | null>(
      null
    );

  const consultaExcel =
    useRef<AbortController | null>(
      null
    );

  const dialogo =
    useRef<HTMLDialogElement | null>(
      null
    );

  const checkboxTodos =
    useRef<HTMLInputElement | null>(
      null
    );

  /*
   * ===================================================
   * CARGAR EVENTOS
   * ===================================================
   */

  useEffect(() => {
    let activo = true;

    async function cargarEventos() {
      try {
        setCargandoEventos(
          true
        );

        setErrorEventos(
          ""
        );

        const resultados:
          Evento[] = [];

        let inicio = 0;

        while (true) {
          const {
            data,
            error:
              errorConsulta,
          } = await supabase
            .from("eventos")
            .select(
              "id,codigo_evento,nombre,fecha_evento,hora_evento,estado"
            )
            .order(
              "fecha_evento",
              {
                ascending:
                  false,
              }
            )
            .order(
              "hora_evento",
              {
                ascending:
                  false,
              }
            )
            .range(
              inicio,
              inicio + 999
            );

          if (!activo) {
            return;
          }

          if (
            errorConsulta
          ) {
            throw errorConsulta;
          }

          const bloque =
            (data ??
              []) as Evento[];

          resultados.push(
            ...bloque
          );

          if (
            bloque.length <
            1000
          ) {
            break;
          }

          inicio += 1000;
        }

        setEventos(
          resultados
        );
      } catch (
        errorConsulta
      ) {
        console.error(
          errorConsulta
        );

        if (activo) {
          setErrorEventos(
            "No se pudieron cargar los eventos."
          );
        }
      } finally {
        if (activo) {
          setCargandoEventos(
            false
          );
        }
      }
    }

    void cargarEventos();

    return () => {
      activo = false;
    };
  }, []);

  /*
   * CANCELAR SOLICITUDES
   */
  useEffect(
    () => () => {
      consultaLista.current?.abort();

      consultaDetalle.current?.abort();

      consultaImpresion.current?.abort();

      consultaExcel.current?.abort();
    },
    []
  );

  /*
   * CHECKBOX TODOS
   */
  useEffect(() => {
    if (
      checkboxTodos.current
    ) {
      checkboxTodos.current.indeterminate =
        filtros.eventoIds
          .length > 0 &&
        filtros.eventoIds
          .length <
          eventos.length;
    }
  }, [
    filtros.eventoIds
      .length,
    eventos.length,
  ]);

  /*
   * MODAL
   */
  useEffect(() => {
    const elemento =
      dialogo.current;

    if (!elemento) {
      return;
    }

    if (
      !alumnoSeleccionado
    ) {
      if (
        elemento.open
      ) {
        elemento.close();
      }

      return;
    }

    if (
      !elemento.open
    ) {
      elemento.showModal();
    }
  }, [
    alumnoSeleccionado,
  ]);

  /*
   * ===================================================
   * EVENTOS VISIBLES
   * ===================================================
   */

  const eventosVisibles =
    useMemo(() => {
      const termino =
        normalizarTexto(
          busquedaEventos
        );

      return eventos.filter(
        (evento) =>
          !termino ||
          normalizarTexto(
            `${evento.codigo_evento} ${evento.nombre}`
          ).includes(
            termino
          )
      );
    }, [
      eventos,
      busquedaEventos,
    ]);

  const idsSeleccionados =
    useMemo(
      () =>
        new Set(
          filtros.eventoIds
        ),

      [
        filtros.eventoIds,
      ]
    );

  /*
   * ===================================================
   * DETALLE
   * ===================================================
   */

  function cerrarDetalle() {
    consultaDetalle.current?.abort();

    setAlumnoSeleccionado(
      null
    );

    setDetalle(null);

    setErrorDetalle("");

    setCargandoDetalle(
      false
    );
  }

  /*
   * ===================================================
   * SELECCIÓN EVENTOS
   * ===================================================
   */

  function seleccionarEvento(
    id: string
  ) {
    const actuales =
      new Set(
        filtros.eventoIds
      );

    if (
      actuales.has(id)
    ) {
      actuales.delete(id);
    } else {
      actuales.add(id);
    }

    setFiltros(
      (anteriores) => ({
        ...anteriores,

        eventoIds:
          eventos
            .filter(
              (evento) =>
                actuales.has(
                  evento.id
                )
            )
            .map(
              (evento) =>
                evento.id
            ),
      })
    );

    setReporte(null);

    cerrarDetalle();
  }

  function cambiarTodos(
    seleccionado:
      boolean
  ) {
    setFiltros(
      (anteriores) => ({
        ...anteriores,

        eventoIds:
          seleccionado
            ? eventos.map(
                (evento) =>
                  evento.id
              )
            : [],
      })
    );

    setReporte(null);

    cerrarDetalle();
  }

  /*
   * ===================================================
   * GENERAR REPORTE CON FILTROS EXPLÍCITOS
   * ===================================================
   */

  async function generarReporteConFiltros(
    filtrosAplicados:
      Filtros,

    pagina = 1,

    cantidad =
      porPagina
  ) {
    if (
      !filtrosAplicados
        .eventoIds.length
    ) {
      setError(
        "Selecciona al menos un evento."
      );

      return;
    }

    consultaLista.current?.abort();

    const controlador =
      new AbortController();

    consultaLista.current =
      controlador;

    setGenerando(true);

    setError("");

    cerrarDetalle();

    try {
      const datos =
        await consultarReporte<ReporteParticipacion>(
          parametrosReporte(
            filtrosAplicados,
            pagina,
            cantidad
          ),

          controlador.signal
        );

      if (
        controlador.signal
          .aborted
      ) {
        return;
      }

      setReporte(
        datos
      );

      /*
       * IMPORTANTE:
       * usamos el catálogo REAL que devuelve
       * el backend.
       */
      if (
        datos.carreras.length
      ) {
        setCarrerasDisponibles(
          [
            ...new Set(
              datos.carreras
            ),
          ].sort(
            (a, b) =>
              a.localeCompare(
                b,
                "es",
                {
                  sensitivity:
                    "base",
                }
              )
          )
        );
      }
    } catch (
      errorConsulta
    ) {
      if (
        !controlador.signal
          .aborted
      ) {
        setError(
          mensajeError(
            errorConsulta
          )
        );
      }
    } finally {
      if (
        consultaLista.current ===
        controlador
      ) {
        setGenerando(
          false
        );
      }
    }
  }

  function generarReporte(
    pagina = 1,
    cantidad =
      porPagina
  ) {
    return generarReporteConFiltros(
      filtros,
      pagina,
      cantidad
    );
  }

  /*
   * ===================================================
   * FILTRO CARRERA
   * ===================================================
   */

  function cambiarCarrera(
    carrera: string
  ) {
    const siguientes:
      Filtros = {
      ...filtros,
      carrera,
    };

    setFiltros(
      siguientes
    );

    /*
     * Si ya había reporte,
     * el filtro se aplica inmediatamente.
     */
    if (reporte) {
      void generarReporteConFiltros(
        siguientes,
        1,
        porPagina
      );
    }
  }

  /*
   * ===================================================
   * FILTRO PARTICIPACIÓN
   * ===================================================
   */

  function cambiarParticipacion(
    participacion:
      FiltroParticipacion
  ) {
    const siguientes:
      Filtros = {
      ...filtros,
      participacion,
    };

    setFiltros(
      siguientes
    );

    if (reporte) {
      void generarReporteConFiltros(
        siguientes,
        1,
        porPagina
      );
    }
  }

  /*
   * ===================================================
   * DETALLE ALUMNO
   * ===================================================
   */

  async function abrirDetalle(
    alumno:
      Estudiante
  ) {
    if (
      !reporte ||
      generando ||
      imprimiendo ||
      exportandoExcel
    ) {
      return;
    }

    consultaDetalle.current?.abort();

    const controlador =
      new AbortController();

    consultaDetalle.current =
      controlador;

    setAlumnoSeleccionado(
      alumno
    );

    setDetalle(null);

    setErrorDetalle("");

    setCargandoDetalle(
      true
    );

    try {
      const parametros =
        parametrosReporte(
          filtrosDelReporte(
            reporte
          )
        );

      parametros.set(
        "modo",
        "detalle"
      );

      parametros.set(
        "numeroCuenta",
        alumno.numeroCuenta
      );

      const datos =
        await consultarReporte<DetalleAlumno>(
          parametros,

          controlador.signal
        );

      if (
        !controlador.signal
          .aborted
      ) {
        setDetalle(
          datos
        );
      }
    } catch (
      errorConsulta
    ) {
      if (
        !controlador.signal
          .aborted
      ) {
        setErrorDetalle(
          mensajeError(
            errorConsulta
          )
        );
      }
    } finally {
      if (
        consultaDetalle.current ===
          controlador &&
        !controlador.signal
          .aborted
      ) {
        setCargandoDetalle(
          false
        );
      }
    }
  }

  /*
   * ===================================================
   * PDF
   * ===================================================
   */

  async function imprimirReporte() {
    if (
      !reporte ||
      generando ||
      imprimiendo ||
      exportandoExcel
    ) {
      return;
    }

    setImprimiendo(true);

    setError("");

    const controlador =
      new AbortController();

    consultaImpresion.current =
      controlador;

    try {
      const completo =
        await consultarReporteCompleto(
          reporte,

          controlador.signal
        );

      const ventana =
        window.open(
          "",
          "_blank"
        );

      if (!ventana) {
        throw new Error(
          "Permite ventanas emergentes para imprimir el reporte."
        );
      }

      ventana.document.open();

      ventana.document.write(
        documentoImpresion(
          completo
        )
      );

      ventana.document.close();

      ventana.focus();

      ventana.print();
    } catch (
      errorConsulta
    ) {
      if (
        !controlador.signal
          .aborted
      ) {
        setError(
          mensajeError(
            errorConsulta
          )
        );
      }
    } finally {
      setImprimiendo(
        false
      );
    }
  }

  /*
   * ===================================================
   * EXCEL
   * ===================================================
   */

  async function descargarReporteExcel() {
    if (
      !reporte ||
      generando ||
      imprimiendo ||
      exportandoExcel
    ) {
      return;
    }

    const controlador =
      new AbortController();

    consultaExcel.current =
      controlador;

    setExportandoExcel(
      true
    );

    setError("");

    try {
      const completo =
        await consultarReporteCompleto(
          reporte,

          controlador.signal
        );

      await descargarExcel(
        contenidoExcelParticipacion(
          completo
        ),

        controlador.signal
      );
    } catch (
      errorConsulta
    ) {
      if (
        !controlador.signal
          .aborted
      ) {
        setError(
          mensajeError(
            errorConsulta
          )
        );
      }
    } finally {
      if (
        !controlador.signal
          .aborted
      ) {
        setExportandoExcel(
          false
        );
      }
    }
  }

  /*
   * ===================================================
   * FORMULARIO
   * ===================================================
   */

  function enviarFormulario(
    evento:
      FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    void generarReporte(
      1
    );
  }

  const paginacion =
    reporte?.paginacion;

  const alumnoModal =
    detalle?.estudiante ??
    alumnoSeleccionado;

  const ocupado =
    generando ||
    imprimiendo ||
    exportandoExcel;

  /*
   * ===================================================
   * RENDER
   * ===================================================
   */

  return (
    <div className="space-y-6">
      {/* ENCABEZADO */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1B396A]">
            Reportes
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Participación estudiantil
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Consulta la participación de los alumnos en los eventos seleccionados.
          </p>
        </div>

        <Link
          to="/admin/eventos"
          className={CLASE_BOTON}
        >
          ← Volver a eventos
        </Link>
      </div>

      {/* CONFIGURACIÓN */}

      <form
        onSubmit={
          enviarFormulario
        }
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-bold text-slate-900">
          Configurar reporte
        </h2>

        {/* TODOS */}

        <div className="mt-5 flex justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              ref={
                checkboxTodos
              }
              type="checkbox"
              checked={
                eventos.length >
                  0 &&
                filtros
                  .eventoIds
                  .length ===
                  eventos.length
              }
              disabled={
                cargandoEventos
              }
              onChange={(
                e
              ) =>
                cambiarTodos(
                  e.target
                    .checked
                )
              }
              className="h-4 w-4 accent-[#1B396A]"
            />

            Seleccionar todos los eventos ({eventos.length})
          </label>

          <span className="text-sm font-semibold text-[#1B396A]">
            {
              filtros
                .eventoIds
                .length
            }{" "}
            seleccionados
          </span>
        </div>

        {/* BUSCAR EVENTO */}

        <input
          type="search"
          value={
            busquedaEventos
          }
          onChange={(e) =>
            setBusquedaEventos(
              e.target.value
            )
          }
          placeholder="Buscar evento por nombre o código"
          className={`${CLASE_INPUT} mt-4`}
        />

        {/* EVENTOS */}

        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          {cargandoEventos ? (
            <p className="p-5 text-sm text-slate-500">
              Cargando eventos...
            </p>
          ) : errorEventos ? (
            <p className="p-5 text-sm text-red-600">
              {errorEventos}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {eventosVisibles.map(
                (
                  evento
                ) => (
                  <label
                    key={
                      evento.id
                    }
                    className="flex cursor-pointer gap-3 p-4 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={idsSeleccionados.has(
                        evento.id
                      )}
                      onChange={() =>
                        seleccionarEvento(
                          evento.id
                        )
                      }
                      className="mt-1 h-4 w-4 accent-[#1B396A]"
                    />

                    <span>
                      <strong className="text-[#1B396A]">
                        {
                          evento.codigo_evento
                        }
                      </strong>

                      {" — "}

                      {
                        evento.nombre
                      }

                      <span className="mt-1 block text-xs text-slate-500">
                        {formatearFecha(
                          evento.fecha_evento
                        )}
                      </span>
                    </span>
                  </label>
                )
              )}
            </div>
          )}
        </div>

        {/* FILTROS */}

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {/* CARRERA */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Carrera
            </label>

            <select
              value={
                filtros.carrera
              }
              onChange={(
                e
              ) =>
                cambiarCarrera(
                  e.target.value
                )
              }
              className={
                CLASE_INPUT
              }
            >
              <option value="">
                Todas las carreras
              </option>

              {carrerasDisponibles.map(
                (
                  carrera
                ) => (
                  <option
                    key={
                      carrera
                    }
                    value={
                      carrera
                    }
                  >
                    {
                      carrera
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {/* PORCENTAJE */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Participación
            </label>

            <select
              value={
                filtros.participacion
              }
              onChange={(
                e
              ) =>
                cambiarParticipacion(
                  e.target
                    .value as FiltroParticipacion
                )
              }
              className={
                CLASE_INPUT
              }
            >
              {OPCIONES_PARTICIPACION.map(
                (
                  opcion
                ) => (
                  <option
                    key={
                      opcion.valor
                    }
                    value={
                      opcion.valor
                    }
                  >
                    {
                      opcion.texto
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {/* ALUMNO */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Buscar alumno
            </label>

            <input
              type="search"
              value={
                filtros.busqueda
              }
              onChange={(
                e
              ) =>
                setFiltros(
                  (
                    anteriores
                  ) => ({
                    ...anteriores,

                    busqueda:
                      e.target
                        .value,
                  })
                )
              }
              placeholder="Número de cuenta o nombre"
              className={
                CLASE_INPUT
              }
            />
          </div>
        </div>

        {/* BOTONES */}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={
              ocupado ||
              !filtros
                .eventoIds
                .length
            }
            className="rounded-xl bg-[#1B396A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {generando
              ? "Generando..."
              : "Generar reporte"}
          </button>

          <button
            type="button"
            disabled={
              !reporte ||
              ocupado
            }
            onClick={() =>
              void imprimirReporte()
            }
            className={
              CLASE_BOTON
            }
          >
            {imprimiendo
              ? "Preparando PDF..."
              : "Imprimir / Guardar PDF"}
          </button>

          <button
            type="button"
            disabled={
              !reporte ||
              ocupado
            }
            onClick={() =>
              void descargarReporteExcel()
            }
            className={
              CLASE_BOTON
            }
          >
            {exportandoExcel
              ? "Preparando Excel..."
              : "Descargar Excel"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* REPORTE */}

      {reporte && (
        <>
          {/* TARJETAS */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Alumnos analizados
              </p>

              <p className="mt-2 text-3xl font-bold text-[#1B396A]">
                {formatearNumero(
                  reporte.resumen
                    .totalAlumnos
                )}
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Eventos seleccionados
              </p>

              <p className="mt-2 text-3xl font-bold text-[#1B396A]">
                {
                  reporte
                    .eventos
                    .length
                }
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Promedio de participación
              </p>

              <p className="mt-2 text-3xl font-bold text-[#1B396A]">
                {formatearPorcentaje(
                  reporte.resumen
                    .promedioParticipacion
                )}
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Alumnos con 100%
              </p>

              <p className="mt-2 text-3xl font-bold text-[#1B396A]">
                {formatearNumero(
                  reporte.resumen
                    .participacion100
                )}
              </p>
            </div>
          </div>

          {/* FILTROS APLICADOS */}

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">
              Filtros aplicados
            </h2>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-slate-100 px-3 py-2">
                Carrera:{" "}
                {reporte
                  .filtros
                  .carrera ??
                  "Todas"}
              </span>

              <span className="rounded-lg bg-slate-100 px-3 py-2">
                Participación:{" "}
                {
                  OPCIONES_PARTICIPACION.find(
                    (
                      opcion
                    ) =>
                      opcion.valor ===
                      reporte
                        .filtros
                        .participacion
                  )?.texto
                }
              </span>
            </div>
          </div>

          {/* TABLA */}

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-bold">
                  Participación por alumno
                </h2>

                <p className="text-sm text-slate-500">
                  {
                    reporte
                      .paginacion
                      .total
                  }{" "}
                  alumnos
                </p>
              </div>

              <select
                value={
                  porPagina
                }
                onChange={(
                  e
                ) => {
                  const cantidad =
                    Number(
                      e.target
                        .value
                    );

                  setPorPagina(
                    cantidad
                  );

                  void generarReporte(
                    1,
                    cantidad
                  );
                }}
                className="rounded-lg border px-3 py-2"
              >
                {[10, 20, 50, 100].map(
                  (
                    cantidad
                  ) => (
                    <option
                      key={
                        cantidad
                      }
                      value={
                        cantidad
                      }
                    >
                      {
                        cantidad
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4">
                      Número
                    </th>

                    <th className="px-5 py-4">
                      Nombre
                    </th>

                    <th className="px-5 py-4">
                      Carrera
                    </th>

                    <th className="px-5 py-4">
                      Inscritos
                    </th>

                    <th className="px-5 py-4">
                      Asistidos
                    </th>

                    <th className="px-5 py-4">
                      Participación
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {reporte.estudiantes.map(
                    (
                      alumno
                    ) => (
                      <tr
                        key={
                          alumno.numeroCuenta
                        }
                        onClick={() =>
                          void abrirDetalle(
                            alumno
                          )
                        }
                        className="cursor-pointer border-t hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold text-[#1B396A]">
                          {
                            alumno.numeroCuenta
                          }
                        </td>

                        <td className="px-5 py-4">
                          {
                            alumno.nombre
                          }
                        </td>

                        <td className="px-5 py-4">
                          {alumno.carrera ??
                            "Sin dato"}
                        </td>

                        <td className="px-5 py-4">
                          {
                            alumno.totalInscribio
                          }
                        </td>

                        <td className="px-5 py-4">
                          {
                            alumno.totalAsistio
                          }
                        </td>

                        <td className="px-5 py-4">
                          {formatearPorcentaje(
                            alumno.porcentaje
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {reporte
                    .estudiantes
                    .length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          6
                        }
                        className="p-10 text-center text-slate-500"
                      >
                        No hay alumnos que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINACIÓN */}

            {paginacion && (
              <div className="flex flex-wrap justify-between gap-3 border-t p-5">
                <p className="text-sm text-slate-500">
                  Página{" "}
                  {
                    paginacion.pagina
                  }{" "}
                  de{" "}
                  {
                    paginacion.totalPaginas
                  }
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      paginacion.pagina <=
                        1 ||
                      ocupado
                    }
                    onClick={() =>
                      void generarReporte(
                        paginacion.pagina -
                          1
                      )
                    }
                    className={
                      CLASE_BOTON
                    }
                  >
                    Anterior
                  </button>

                  {paginasVisibles(
                    paginacion.pagina,
                    paginacion.totalPaginas
                  ).map(
                    (
                      pagina
                    ) => (
                      <button
                        key={
                          pagina
                        }
                        type="button"
                        onClick={() =>
                          void generarReporte(
                            pagina
                          )
                        }
                        className={
                          pagina ===
                          paginacion.pagina
                            ? "rounded-lg bg-[#1B396A] px-3 py-2 text-white"
                            : "rounded-lg border px-3 py-2"
                        }
                      >
                        {
                          pagina
                        }
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={
                      paginacion.pagina >=
                        paginacion.totalPaginas ||
                      ocupado
                    }
                    onClick={() =>
                      void generarReporte(
                        paginacion.pagina +
                          1
                      )
                    }
                    className={
                      CLASE_BOTON
                    }
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL */}

      <dialog
        ref={
          dialogo
        }
        onCancel={(
          e
        ) => {
          e.preventDefault();

          cerrarDetalle();
        }}
        className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-slate-900/50"
      >
        {alumnoModal && (
          <>
            <div className="flex justify-between gap-4 border-b p-5">
              <div>
                <p className="text-sm font-semibold text-[#1B396A]">
                  Detalle de participación
                </p>

                <h2 className="text-xl font-bold">
                  {
                    alumnoModal.nombre
                  }
                </h2>

                <p className="text-sm text-slate-500">
                  {
                    alumnoModal.numeroCuenta
                  }{" "}
                  ·{" "}
                  {alumnoModal.carrera ??
                    "Sin carrera"}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  cerrarDetalle
                }
                className={
                  CLASE_BOTON
                }
              >
                Cerrar
              </button>
            </div>

            {cargandoDetalle && (
              <p className="p-6">
                Cargando...
              </p>
            )}

            {errorDetalle && (
              <p className="p-6 text-red-600">
                {
                  errorDetalle
                }
              </p>
            )}

            {detalle && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4">
                        Evento
                      </th>

                      <th className="px-5 py-4">
                        Fecha
                      </th>

                      <th className="px-5 py-4">
                        Inscrito
                      </th>

                      <th className="px-5 py-4">
                        Asistió
                      </th>

                      <th className="px-5 py-4">
                        Hora
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.eventos.map(
                      (
                        evento
                      ) => (
                        <tr
                          key={
                            evento.eventoId
                          }
                          className="border-t"
                        >
                          <td className="px-5 py-4">
                            <strong className="text-[#1B396A]">
                              {
                                evento.codigoEvento
                              }
                            </strong>

                            <br />

                            {
                              evento.nombreEvento
                            }
                          </td>

                          <td className="px-5 py-4">
                            {formatearFecha(
                              evento.fechaEvento
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {evento.inscrito
                              ? "Sí"
                              : "No"}
                          </td>

                          <td className="px-5 py-4">
                            {evento.asistio
                              ? "Sí"
                              : "No"}
                          </td>

                          <td className="px-5 py-4">
                            {evento.asistio
                              ? formatearFechaHora(
                                  evento.horaAsistencia
                                )
                              : "—"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}