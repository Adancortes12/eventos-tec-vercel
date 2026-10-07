import { supabaseAdmin } from "../../server/lib/supabaseAdmin.js";
import {
  obtenerCookie,
  verificarSesion,
} from "../../server/lib/session.js";

const TAMANO_BLOQUE = 1000;
const EVENTOS_POR_BLOQUE = 100;

const FILTROS_PARTICIPACION = new Set([
  "todos",
  "100",
  "75-99",
  "50-74",
  "lt50",
]);

/*
 * =====================================================
 * NORMALIZACIÓN
 * =====================================================
 */

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * SITEc puede guardar las carreras con pequeñas
 * diferencias:
 *
 * INGENIERÍA EN SISTEMAS COMPUTACIONALES
 * INGENIERIA EN SISTEMAS COMPUTACIONALES
 * ISC
 *
 * Aquí todas terminan con un mismo nombre.
 */
function normalizarCarrera(valor) {
  const texto = normalizarTexto(valor);

  if (!texto) {
    return null;
  }

  if (
    texto === "arq" ||
    texto.includes("arquitect")
  ) {
    return "ARQUITECTURA";
  }

  if (
    texto === "cp" ||
    texto.includes("contador") ||
    texto.includes("contaduria")
  ) {
    return "CONTADOR PUBLICO";
  }

  if (
    texto.includes("ambiental")
  ) {
    return "INGENIERIA AMBIENTAL";
  }

  if (
    texto.includes("bioquim")
  ) {
    return "INGENIERIA BIOQUIMICA";
  }

  if (
    texto === "ige" ||
    (
      texto.includes("gestion") &&
      texto.includes("empres")
    )
  ) {
    return "INGENIERIA EN GESTION EMPRESARIAL";
  }

  if (
    texto === "iia" ||
    (
      texto.includes("intelig") &&
      texto.includes("artif")
    )
  ) {
    return "INGENIERIA EN INTELIGENCIA ARTIFICIAL";
  }

  if (
    texto === "isc" ||
    (
      texto.includes("sist") &&
      texto.includes("comput")
    )
  ) {
    return "INGENIERIA EN SISTEMAS COMPUTACIONALES";
  }

  if (
    texto.includes("industrial")
  ) {
    return "INGENIERIA INDUSTRIAL";
  }

  if (
    texto === "iinf" ||
    texto.includes("informat")
  ) {
    return "INGENIERIA INFORMATICA";
  }

  if (
    texto.includes("mecatron")
  ) {
    return "INGENIERIA MECATRONICA";
  }

  if (
    texto.includes("administracion")
  ) {
    return "LICENCIATURA EN ADMINISTRACION";
  }

  /*
   * Si SITEc trae una carrera nueva que todavía
   * no conocemos, no la eliminamos.
   */
  return texto.toUpperCase();
}

function normalizarGenero(valor) {
  const genero = normalizarTexto(valor);

  if (
    ["1", "hombre", "masculino"].includes(
      genero
    )
  ) {
    return "Hombre";
  }

  if (
    ["2", "mujer", "femenino"].includes(
      genero
    )
  ) {
    return "Mujer";
  }

  return null;
}

/*
 * =====================================================
 * PARÁMETROS
 * =====================================================
 */

function obtenerEventoIds(req) {
  const parametro =
    req.query?.eventoIds ??
    req.query?.eventos;

  const valores = Array.isArray(parametro)
    ? parametro
    : typeof parametro === "string"
      ? [parametro]
      : [];

  return [
    ...new Set(
      valores
        .flatMap((valor) =>
          String(valor).split(",")
        )
        .map((valor) =>
          valor.trim().toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
}

function obtenerEntero(
  valor,
  predeterminado,
  maximo = Number.MAX_SAFE_INTEGER
) {
  if (valor == null) {
    return predeterminado;
  }

  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    return null;
  }

  if (String(valor).trim() === "") {
    return null;
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero < 1
  ) {
    return null;
  }

  return Math.min(
    numero,
    maximo
  );
}

/*
 * =====================================================
 * EVENTOS
 * =====================================================
 */

async function obtenerEventos(eventoIds) {
  const resultados = [];

  for (
    let inicio = 0;
    inicio < eventoIds.length;
    inicio += EVENTOS_POR_BLOQUE
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("eventos")
      .select(
        "id,codigo_evento,nombre,fecha_evento,hora_evento,estado"
      )
      .in(
        "id",
        eventoIds.slice(
          inicio,
          inicio +
            EVENTOS_POR_BLOQUE
        )
      );

    if (error) {
      throw error;
    }

    resultados.push(
      ...(data ?? [])
    );
  }

  const porId = new Map(
    resultados.map(
      (evento) => [
        evento.id,
        evento,
      ]
    )
  );

  return eventoIds
    .map((id) =>
      porId.get(id)
    )
    .filter(Boolean);
}

/*
 * =====================================================
 * INSCRIPCIONES
 * =====================================================
 */

async function obtenerInscripciones(
  eventoIds
) {
  const resultados = [];

  for (
    let inicioEventos = 0;
    inicioEventos <
    eventoIds.length;
    inicioEventos +=
      EVENTOS_POR_BLOQUE
  ) {
    const bloqueEventos =
      eventoIds.slice(
        inicioEventos,
        inicioEventos +
          EVENTOS_POR_BLOQUE
      );

    let inicio = 0;

    while (true) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("inscripciones")
        .select(
          `
          id,
          evento_id,
          numero_estudiante,
          nombre_completo,
          genero,
          carrera,
          registrado_en,
          asistio,
          asistio_en
          `
        )
        .in(
          "evento_id",
          bloqueEventos
        )
        .order(
          "registrado_en",
          {
            ascending: true,
          }
        )
        .order("id", {
          ascending: true,
        })
        .range(
          inicio,
          inicio +
            TAMANO_BLOQUE -
            1
        );

      if (error) {
        throw error;
      }

      const registros =
        data ?? [];

      resultados.push(
        ...registros
      );

      if (
        registros.length <
        TAMANO_BLOQUE
      ) {
        break;
      }

      inicio +=
        TAMANO_BLOQUE;
    }
  }

  return resultados;
}

function instante(valor) {
  const numero =
    valor
      ? Date.parse(valor)
      : 0;

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}

/*
 * =====================================================
 * AGRUPAR ESTUDIANTES
 * =====================================================
 */

function agruparEstudiantes(
  inscripciones
) {
  const mapa = new Map();

  /*
   * Se ordenan para que nombre,
   * carrera y género conserven
   * el dato más reciente.
   */
  const ordenadas = [
    ...inscripciones,
  ].sort(
    (a, b) =>
      instante(
        a.registrado_en
      ) -
        instante(
          b.registrado_en
        ) ||
      String(a.id).localeCompare(
        String(b.id)
      )
  );

  for (
    const inscripcion of ordenadas
  ) {
    const numero = String(
      inscripcion.numero_estudiante ??
        ""
    ).trim();

    if (!numero) {
      continue;
    }

    if (!mapa.has(numero)) {
      mapa.set(numero, {
        numeroCuenta: numero,
        nombre: "Sin nombre",
        carrera: null,
        genero: null,
        registrosPorEvento:
          new Map(),
      });
    }

    const estudiante =
      mapa.get(numero);

    const nombre = String(
      inscripcion.nombre_completo ??
        ""
    ).trim();

    const carrera =
      normalizarCarrera(
        inscripcion.carrera
      );

    const genero =
      normalizarGenero(
        inscripcion.genero
      );

    if (nombre) {
      estudiante.nombre =
        nombre;
    }

    if (carrera) {
      estudiante.carrera =
        carrera;
    }

    if (genero) {
      estudiante.genero =
        genero;
    }

    const anterior =
      estudiante.registrosPorEvento.get(
        inscripcion.evento_id
      );

    const asistio =
      inscripcion.asistio ===
      true;

    const asistioEnActual =
      asistio
        ? inscripcion.asistio_en ??
          null
        : null;

    const asistioEnAnterior =
      anterior?.asistioEn ??
      null;

    const asistioEn =
      instante(
        asistioEnActual
      ) >=
      instante(
        asistioEnAnterior
      )
        ? asistioEnActual ??
          asistioEnAnterior
        : asistioEnAnterior;

    /*
     * Un alumno solo cuenta una vez
     * por evento.
     */
    estudiante.registrosPorEvento.set(
      inscripcion.evento_id,
      {
        id: inscripcion.id,

        eventoId:
          inscripcion.evento_id,

        registradoEn:
          anterior?.registradoEn ??
          inscripcion.registrado_en ??
          null,

        asistio: Boolean(
          anterior?.asistio ||
            asistio
        ),

        asistioEn,
      }
    );
  }

  return [
    ...mapa.values(),
  ].map(
    ({
      registrosPorEvento,
      ...estudiante
    }) => ({
      ...estudiante,

      inscripciones: [
        ...registrosPorEvento.values(),
      ],
    })
  );
}

/*
 * =====================================================
 * PARTICIPACIÓN
 * =====================================================
 */

function calcularParticipacion(
  estudiante
) {
  const totalRegistrados =
    estudiante.inscripciones.length;

  const totalAsistencias =
    estudiante.inscripciones.filter(
      (registro) =>
        registro.asistio
    ).length;

  return {
    totalRegistrados,
    totalAsistencias,

    porcentaje:
      totalRegistrados > 0
        ? (
            totalAsistencias /
            totalRegistrados
          ) * 100
        : 0,
  };
}

function porcentajeVisible(
  porcentaje
) {
  const redondeado =
    Number(
      porcentaje.toFixed(1)
    );

  /*
   * Evita mostrar 75% si
   * realmente es 74.96%.
   */
  const limite = [
    50,
    75,
    100,
  ].find(
    (valor) =>
      porcentaje < valor &&
      redondeado >= valor
  );

  return limite
    ? limite - 0.1
    : redondeado;
}

function cumpleFiltroParticipacion(
  porcentaje,
  filtro
) {
  switch (filtro) {
    case "100":
      return porcentaje === 100;

    case "75-99":
      return (
        porcentaje >= 75 &&
        porcentaje < 100
      );

    case "50-74":
      return (
        porcentaje >= 50 &&
        porcentaje < 75
      );

    case "lt50":
      return porcentaje < 50;

    default:
      return true;
  }
}

function coincideBusqueda(
  estudiante,
  busqueda
) {
  const termino =
    normalizarTexto(busqueda);

  if (!termino) {
    return true;
  }

  return (
    normalizarTexto(
      estudiante.numeroCuenta
    ).includes(termino) ||
    normalizarTexto(
      estudiante.nombre
    ).includes(termino)
  );
}

/*
 * =====================================================
 * RESPUESTA ESTUDIANTE
 * =====================================================
 */

function construirEstudiante(
  estudiante
) {
  const participacion =
    calcularParticipacion(
      estudiante
    );

  return {
    numeroCuenta:
      estudiante.numeroCuenta,

    nombre:
      estudiante.nombre,

    genero:
      estudiante.genero,

    carrera:
      estudiante.carrera,

    totalAsistio:
      participacion.totalAsistencias,

    totalInscribio:
      participacion.totalRegistrados,

    porcentaje:
      porcentajeVisible(
        participacion.porcentaje
      ),
  };
}

/*
 * =====================================================
 * DETALLE
 * =====================================================
 */

function construirDetalleAlumno(
  estudiante,
  eventos
) {
  const porEvento =
    new Map(
      estudiante.inscripciones.map(
        (registro) => [
          registro.eventoId,
          registro,
        ]
      )
    );

  return eventos.map(
    (evento) => {
      const registro =
        porEvento.get(
          evento.id
        );

      return {
        eventoId: evento.id,

        codigoEvento:
          evento.codigo_evento,

        nombreEvento:
          evento.nombre,

        fechaEvento:
          evento.fecha_evento,

        horaEvento:
          evento.hora_evento,

        inscrito:
          Boolean(registro),

        asistio:
          Boolean(
            registro?.asistio
          ),

        horaAsistencia:
          registro?.asistio
            ? registro.asistioEn
            : null,

        fechaRegistro:
          registro?.registradoEn ??
          null,
      };
    }
  );
}

/*
 * =====================================================
 * HANDLER
 * =====================================================
 */

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        error:
          "Método no permitido.",
      });
  }

  res.setHeader(
    "Cache-Control",
    "private, no-store"
  );

  try {
    /*
     * SESIÓN
     */
    const tokenSesion =
      obtenerCookie(
        req,
        "eventos_session"
      );

    const sesion =
      verificarSesion(
        tokenSesion
      );

    if (
      !sesion ||
      sesion.tipo !==
        "maestro"
    ) {
      return res
        .status(401)
        .json({
          error:
            "Debes iniciar sesión como maestro.",
        });
    }

    const {
      data: maestro,
      error: errorMaestro,
    } = await supabaseAdmin
      .from("maestros")
      .select(
        "id,rol_sistema,activo"
      )
      .eq(
        "id",
        sesion.id
      )
      .maybeSingle();

    if (errorMaestro) {
      console.error(
        "Error consultando maestro:",
        errorMaestro
      );

      return res
        .status(500)
        .json({
          error:
            "No se pudo verificar el usuario.",
        });
    }

    if (
      !maestro ||
      !maestro.activo
    ) {
      return res
        .status(403)
        .json({
          error:
            "Tu cuenta no tiene acceso activo al sistema.",
        });
    }

    /*
     * PARÁMETROS
     */
    const eventoIds =
      obtenerEventoIds(req);

    const carreraRaw =
      typeof req.query
        ?.carrera ===
      "string"
        ? req.query.carrera.trim()
        : "";

    const carrera =
      carreraRaw
        ? normalizarCarrera(
            carreraRaw
          )
        : null;

    const filtroParticipacion =
      typeof req.query
        ?.participacion ===
      "string"
        ? req.query
            .participacion
        : "todos";

    const busqueda =
      typeof req.query
        ?.busqueda ===
      "string"
        ? req.query.busqueda.trim()
        : "";

    const modo =
      typeof req.query?.modo ===
      "string"
        ? req.query.modo
        : "lista";

    const numeroCuenta =
      typeof req.query
        ?.numeroCuenta ===
      "string"
        ? req.query.numeroCuenta.trim()
        : "";

    const pagina =
      obtenerEntero(
        req.query?.pagina,
        1
      );

    const porPagina =
      obtenerEntero(
        req.query?.porPagina,
        20,
        1000
      );

    /*
     * VALIDACIONES
     */
    if (!eventoIds.length) {
      return res
        .status(400)
        .json({
          error:
            "Debes seleccionar al menos un evento.",
        });
    }

    if (
      eventoIds.some(
        (id) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            id
          )
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "La selección contiene un identificador de evento inválido.",
        });
    }

    if (
      pagina === null ||
      porPagina === null
    ) {
      return res
        .status(400)
        .json({
          error:
            "La página y las filas por página deben ser números enteros positivos.",
        });
    }

    if (
      !FILTROS_PARTICIPACION.has(
        filtroParticipacion
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "El filtro de participación no es válido.",
        });
    }

    if (
      ![
        "lista",
        "detalle",
      ].includes(modo)
    ) {
      return res
        .status(400)
        .json({
          error:
            "El modo de consulta no es válido.",
        });
    }

    if (
      modo === "detalle" &&
      !numeroCuenta
    ) {
      return res
        .status(400)
        .json({
          error:
            "Debes indicar el número de cuenta.",
        });
    }

    /*
     * EVENTOS
     */
    const eventos =
      await obtenerEventos(
        eventoIds
      );

    if (
      eventos.length !==
      eventoIds.length
    ) {
      return res
        .status(400)
        .json({
          error:
            "Uno o más eventos seleccionados ya no están disponibles. Recarga la página y revisa la selección.",
        });
    }

    /*
     * INSCRIPCIONES
     */
    const inscripciones =
      await obtenerInscripciones(
        eventoIds
      );

    const todosLosEstudiantes =
      agruparEstudiantes(
        inscripciones
      );

    /*
     * DETALLE DE ALUMNO
     */
    if (
      modo === "detalle"
    ) {
      const estudiante =
        todosLosEstudiantes.find(
          (alumno) =>
            alumno.numeroCuenta ===
            numeroCuenta
        );

      if (!estudiante) {
        return res
          .status(404)
          .json({
            error:
              "No se encontró al estudiante en los eventos seleccionados.",
          });
      }

      return res
        .status(200)
        .json({
          estudiante:
            construirEstudiante(
              estudiante
            ),

          eventos:
            construirDetalleAlumno(
              estudiante,
              eventos
            ),
        });
    }

    /*
     * =================================================
     * FILTROS
     * =================================================
     */

    const estudiantes =
      todosLosEstudiantes
        .filter(
          (estudiante) => {
            /*
             * CARRERA
             */
            if (
              carrera &&
              normalizarCarrera(
                estudiante.carrera
              ) !== carrera
            ) {
              return false;
            }

            /*
             * PARTICIPACIÓN
             */
            const participacion =
              calcularParticipacion(
                estudiante
              );

            if (
              !cumpleFiltroParticipacion(
                participacion.porcentaje,
                filtroParticipacion
              )
            ) {
              return false;
            }

            /*
             * BUSCADOR
             */
            if (
              !coincideBusqueda(
                estudiante,
                busqueda
              )
            ) {
              return false;
            }

            return true;
          }
        )
        .sort(
          (a, b) =>
            a.nombre.localeCompare(
              b.nombre,
              "es",
              {
                sensitivity:
                  "base",
              }
            ) ||
            a.numeroCuenta.localeCompare(
              b.numeroCuenta
            )
        );

    /*
     * ESTADÍSTICAS
     */
    const participaciones =
      estudiantes.map(
        calcularParticipacion
      );

    const totalAlumnos =
      estudiantes.length;

    const totalInscripciones =
      participaciones.reduce(
        (total, valor) =>
          total +
          valor.totalRegistrados,
        0
      );

    const totalAsistencias =
      participaciones.reduce(
        (total, valor) =>
          total +
          valor.totalAsistencias,
        0
      );

    const promedioParticipacion =
      totalAlumnos > 0
        ? participaciones.reduce(
            (total, valor) =>
              total +
              valor.porcentaje,
            0
          ) / totalAlumnos
        : 0;

    const cantidad = (
      filtro
    ) =>
      participaciones.filter(
        (valor) =>
          cumpleFiltroParticipacion(
            valor.porcentaje,
            filtro
          )
      ).length;

    /*
     * PAGINACIÓN
     */
    const totalPaginas =
      Math.max(
        Math.ceil(
          totalAlumnos /
            porPagina
        ),
        1
      );

    const paginaReal =
      Math.min(
        pagina,
        totalPaginas
      );

    const inicio =
      (paginaReal - 1) *
      porPagina;

    /*
     * CARRERAS DISPONIBLES
     */
    const carreras = [
      ...new Set(
        todosLosEstudiantes
          .map(
            (alumno) =>
              normalizarCarrera(
                alumno.carrera
              )
          )
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(
        b,
        "es",
        {
          sensitivity: "base",
        }
      )
    );

    /*
     * RESPUESTA
     */
    return res
      .status(200)
      .json({
        eventos:
          eventos.map(
            (evento) => ({
              id: evento.id,

              codigo:
                evento.codigo_evento,

              nombre:
                evento.nombre,

              fecha:
                evento.fecha_evento,

              hora:
                evento.hora_evento,

              estado:
                evento.estado,
            })
          ),

        filtros: {
          eventos: eventoIds,

          carrera:
            carrera ?? null,

          participacion:
            filtroParticipacion,

          busqueda:
            busqueda ||
            null,
        },

        carreras,

        resumen: {
          totalAlumnos,

          totalInscripciones,

          totalAsistencias,

          promedioParticipacion:
            Number(
              promedioParticipacion.toFixed(
                1
              )
            ),

          participacion100:
            cantidad("100"),

          participacion75_99:
            cantidad(
              "75-99"
            ),

          participacion50_74:
            cantidad(
              "50-74"
            ),

          participacionMenor50:
            cantidad(
              "lt50"
            ),
        },

        paginacion: {
          pagina:
            paginaReal,

          porPagina,

          total:
            totalAlumnos,

          totalPaginas,
        },

        estudiantes:
          estudiantes
            .slice(
              inicio,
              inicio +
                porPagina
            )
            .map(
              construirEstudiante
            ),
      });
  } catch (error) {
    console.error(
      "Error generando reporte de participación:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Ocurrió un error al generar el reporte de participación.",
      });
  }
}