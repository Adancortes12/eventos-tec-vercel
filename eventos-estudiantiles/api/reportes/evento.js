import { supabaseAdmin } from "../../server/lib/supabaseAdmin.js";

import {
  obtenerCookie,
  verificarSesion,
} from "../../server/lib/session.js";

/*
 * Normalizar texto para comparaciones.
 */
function normalizarTexto(valor) {
  return String(valor ?? "")
    .replace(/\+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}
/*
 * SITEc maneja:
 *
 * 1 = Hombre
 * 2 = Mujer
 */
function normalizarGenero(valor) {
  const genero = normalizarTexto(valor);

  if (
    [
      "1",
      "m",
      "h",
      "masculino",
      "hombre",
      "male",
    ].includes(genero)
  ) {
    return "Hombre";
  }

  if (
    [
      "2",
      "f",
      "femenino",
      "mujer",
      "female",
    ].includes(genero)
  ) {
    return "Mujer";
  }

  return null;
}

/*
 * Obtener parámetro.
 */
function obtenerParametro(req, nombre) {
  const valor = req.query?.[nombre];

  if (Array.isArray(valor)) {
    return String(valor[0] ?? "")
      .replace(/\+/g, " ");
  }

  return typeof valor === "string"
    ? valor.replace(/\+/g, " ")
    : "";
}

/*
 * Convertir parámetro booleano.
 */
function esVerdadero(valor) {
  return [
    "true",
    "1",
    "si",
    "sí",
  ].includes(
    normalizarTexto(valor)
  );
}

/*
 * Obtener token servidor-servidor de SITEc.
 */
async function obtenerTokenSitec() {
  const {
    SIITEC_CLIENT_ID,
    SIITEC_CLIENT_SECRET,
    SIITEC_TOKEN_ENDPOINT,
  } = process.env;

  if (
    !SIITEC_CLIENT_ID ||
    !SIITEC_CLIENT_SECRET ||
    !SIITEC_TOKEN_ENDPOINT
  ) {
    throw new Error(
      "Faltan variables de SIITEC."
    );
  }

  const credenciales =
    Buffer.from(
      `${SIITEC_CLIENT_ID}:${SIITEC_CLIENT_SECRET}`
    ).toString("base64");

  const body =
    new URLSearchParams({
      grant_type:
        "client_credentials",
    });

  const respuesta = await fetch(
    SIITEC_TOKEN_ENDPOINT,
    {
      method: "POST",

      headers: {
        Authorization:
          `Basic ${credenciales}`,

        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: body.toString(),
    }
  );

  const datos =
    await respuesta.json();

  if (
    !respuesta.ok ||
    !datos.access_token
  ) {
    throw new Error(
      "No se pudo obtener el token de SIITEC."
    );
  }

  return datos.access_token;
}

/*
 * Obtener estudiante desde SITEc.
 */
async function obtenerPerfilSitec(
  numeroEstudiante,
  sitecUsuarioId,
  token
) {
  const endpoint =
    process.env.SIITEC_USUARIOS_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      "Falta SIITEC_USUARIOS_ENDPOINT."
    );
  }

  const parametros =
    new URLSearchParams({
      matricula:
        numeroEstudiante,

      activo: "1",
    });

  const respuesta =
    await fetch(
      `${endpoint}?${parametros.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  const datos =
    await respuesta.json();

  if (
    !respuesta.ok ||
    !Array.isArray(datos)
  ) {
    throw new Error(
      `No se pudo consultar SITEc para ${numeroEstudiante}.`
    );
  }

  return (
    datos.find(
      (usuario) =>
        String(
          usuario.usuario_id
        ) ===
        String(sitecUsuarioId)
    ) ?? null
  );
}

/*
 * Procesar elementos con concurrencia limitada.
 *
 * Lo usamos SOLO cuando el usuario
 * solicita actualizar SITEc.
 */
async function procesarConLimite(
  elementos,
  limite,
  funcion
) {
  const resultados =
    new Array(
      elementos.length
    );

  let siguiente = 0;

  async function trabajador() {
    while (true) {
      const indice =
        siguiente++;

      if (
        indice >=
        elementos.length
      ) {
        return;
      }

      resultados[indice] =
        await funcion(
          elementos[indice],
          indice
        );
    }
  }

  const trabajadores =
    Math.min(
      limite,
      elementos.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          trabajadores,
      },
      () => trabajador()
    )
  );

  return resultados;
}

/*
 * Actualizar información de SITEc.
 */
async function actualizarDatosSitec(
  inscripciones
) {
  const advertencias = [];

  /*
   * Obtener números de estudiante.
   */
  const numeros =
    [
      ...new Set(
        inscripciones
          .map(
            (inscripcion) =>
              String(
                inscripcion
                  .numero_estudiante ??
                  ""
              ).trim()
          )
          .filter(Boolean)
      ),
    ];

  if (numeros.length === 0) {
    return {
      inscripciones,
      actualizados: 0,
      errores: 0,
      advertencias,
    };
  }

  /*
   * Obtener vínculos internos
   * con SITEc.
   */
  const {
    data: estudiantes,
    error:
      errorEstudiantes,
  } =
    await supabaseAdmin
      .from("estudiantes")
      .select(`
        id,
        numero_estudiante,
        sitec_usuario_id
      `)
      .in(
        "numero_estudiante",
        numeros
      );

  if (errorEstudiantes) {
    throw new Error(
      "No se pudieron consultar los estudiantes."
    );
  }

  const estudiantesPorNumero =
    new Map(
      (estudiantes ?? []).map(
        (estudiante) => [
          String(
            estudiante
              .numero_estudiante
          ),
          estudiante,
        ]
      )
    );

  /*
   * Un solo token para todas
   * las consultas.
   */
  const token =
    await obtenerTokenSitec();

  let actualizados = 0;
  let errores = 0;

  /*
   * Diez consultas simultáneas.
   *
   * Esto SOLO sucede cuando se
   * solicita una actualización.
   */
  const resultados =
    await procesarConLimite(
      inscripciones,
      10,
      async (
        inscripcion
      ) => {
        const numero =
          String(
            inscripcion
              .numero_estudiante ??
              ""
          ).trim();

        const estudiante =
          estudiantesPorNumero.get(
            numero
          );

        /*
         * No existe vínculo.
         */
        if (
          !estudiante ||
          !estudiante.sitec_usuario_id
        ) {
          errores++;

          advertencias.push(
            `No se encontró vínculo con SITEc para ${numero}.`
          );

          return inscripcion;
        }

        try {
          const perfil =
            await obtenerPerfilSitec(
              numero,
              estudiante.sitec_usuario_id,
              token
            );

          /*
           * Si SITEc no devuelve
           * el perfil, conservamos
           * los datos anteriores.
           */
          if (!perfil) {
            errores++;

            advertencias.push(
              `No se encontró el perfil de SITEc para ${numero}.`
            );

            return inscripcion;
          }

          const generoSitec =
            normalizarGenero(
              perfil.sexo
            );

          const carreraSitec =
            perfil.carrera ??
            inscripcion.carrera ??
            null;

          /*
           * Si SITEc no pudo traducir
           * el género, conservamos
           * el anterior.
           */
          const generoFinal =
            generoSitec ??
            inscripcion.genero ??
            null;

          /*
           * Actualizar solo si
           * realmente cambió.
           */
          const cambio =
            generoFinal !==
              inscripcion.genero ||
            carreraSitec !==
              inscripcion.carrera;

          if (cambio) {
            const {
              error:
                errorActualizacion,
            } =
              await supabaseAdmin
                .from(
                  "inscripciones"
                )
                .update({
                  genero:
                    generoFinal,

                  carrera:
                    carreraSitec,
                })
                .eq(
                  "id",
                  inscripcion.id
                );

            if (
              errorActualizacion
            ) {
              errores++;

              console.error(
                "Error actualizando inscripción:",
                errorActualizacion
              );

              advertencias.push(
                `No se pudieron guardar los datos de SITEc para ${numero}.`
              );

              return inscripcion;
            }

            actualizados++;
          }

          return {
            ...inscripcion,

            genero:
              generoFinal,

            carrera:
              carreraSitec,
          };
        } catch (error) {
          errores++;

          console.error(
            `Error SITEc ${numero}:`,
            error
          );

          advertencias.push(
            `No se pudieron actualizar los datos de SITEc para ${numero}.`
          );

          /*
           * Muy importante:
           * NO borramos los datos
           * anteriores si SITEc falla.
           */
          return inscripcion;
        }
      }
    );

  return {
    inscripciones:
      resultados,

    actualizados,

    errores,

    advertencias,
  };
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error:
        "Método no permitido.",
    });
  }

  try {
    /*
     * 1. SESIÓN
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
      sesion.tipo !== "maestro"
    ) {
      return res.status(401).json({
        error:
          "Debes iniciar sesión como maestro.",
      });
    }

    /*
     * 2. MAESTRO ACTIVO
     */
    const {
      data: maestro,
      error:
        errorMaestro,
    } =
      await supabaseAdmin
        .from("maestros")
        .select(`
          id,
          activo
        `)
        .eq(
          "id",
          sesion.id
        )
        .maybeSingle();

    if (errorMaestro) {
      return res.status(500).json({
        error:
          "No se pudo verificar el usuario.",
      });
    }

    if (
      !maestro ||
      !maestro.activo
    ) {
      return res.status(403).json({
        error:
          "Tu cuenta no tiene acceso activo al sistema.",
      });
    }

    /*
     * 3. PARÁMETROS
     */
    const eventoId =
      obtenerParametro(
        req,
        "eventoId"
      ).trim();

    const tipo =
      (
        obtenerParametro(
          req,
          "tipo"
        ) || "general"
      )
        .trim()
        .toLowerCase();

    const carreraFiltro =
      obtenerParametro(
        req,
        "carrera"
      ).trim();

    const actualizar =
      esVerdadero(
        obtenerParametro(
          req,
          "actualizar"
        )
      );

    if (!eventoId) {
      return res.status(400).json({
        error:
          "No se recibió un evento válido.",
      });
    }

    if (
      ![
        "general",
        "carrera",
      ].includes(tipo)
    ) {
      return res.status(400).json({
        error:
          "El tipo de reporte debe ser general o carrera.",
      });
    }

    if (
      tipo === "carrera" &&
      !carreraFiltro
    ) {
      return res.status(400).json({
        error:
          "Debes seleccionar una carrera.",
      });
    }

    /*
     * 4. EVENTO
     */
    const {
      data: evento,
      error: errorEvento,
    } =
      await supabaseAdmin
        .from("eventos")
        .select(`
          id,
          codigo_evento,
          nombre,
          descripcion,
          fecha_evento,
          hora_evento,
          estado,
          fecha_activacion,
          duracion_minutos,
          cierre_inscripcion
        `)
        .eq(
          "id",
          eventoId
        )
        .maybeSingle();

    if (errorEvento) {
      return res.status(500).json({
        error:
          "No se pudo consultar el evento.",
      });
    }

    if (!evento) {
      return res.status(404).json({
        error:
          "El evento no existe.",
      });
    }

    /*
     * 5. INSCRIPCIONES
     *
     * IMPORTANTE:
     * Aquí usamos género y carrera
     * almacenados.
     */
    const {
      data: inscripcionesIniciales,
      error:
        errorInscripciones,
    } =
      await supabaseAdmin
        .from("inscripciones")
        .select(`
          id,
          estudiante_id,
          numero_estudiante,
          nombre_completo,
          registrado_en,
          asistio,
          asistio_en,
          genero,
          carrera
        `)
        .eq(
          "evento_id",
          eventoId
        )
        .order(
          "numero_estudiante",
          {
            ascending: true,
          }
        );

    if (errorInscripciones) {
      return res.status(500).json({
        error:
          "No se pudieron cargar las inscripciones.",
      });
    }

    let inscripciones =
      inscripcionesIniciales ??
      [];

    let datosActualizacion = {
      solicitada: actualizar,
      actualizados: 0,
      errores: 0,
    };

    let advertencias = [];

    /*
     * 6. ACTUALIZAR SITEc
     *
     * SOLO si se pidió explícitamente.
     */
    if (actualizar) {
      const resultado =
        await actualizarDatosSitec(
          inscripciones
        );

      inscripciones =
        resultado.inscripciones;

      datosActualizacion = {
        solicitada: true,

        actualizados:
          resultado.actualizados,

        errores:
          resultado.errores,
      };

      advertencias =
        resultado.advertencias;
    }

    /*
     * 7. DATOS SITEc FALTANTES
     */
    const datosSitecPendientes =
      inscripciones.filter(
        (inscripcion) =>
          !inscripcion.genero ||
          !inscripcion.carrera
      ).length;

    /*
     * 8. CARRERAS DISPONIBLES
     */
    const carreras = [
      ...new Set(
        inscripciones
          .map(
            (inscripcion) =>
              inscripcion.carrera
          )
          .filter(Boolean)
      ),
    ].sort(
      (a, b) =>
        String(a).localeCompare(
          String(b),
          "es-MX"
        )
    );

    /*
     * 9. FILTRO
     */
    const estudiantesFiltrados =
      tipo === "carrera"
        ? inscripciones.filter(
            (inscripcion) =>
              normalizarTexto(
                inscripcion.carrera
              ) ===
              normalizarTexto(
                carreraFiltro
              )
          )
        : inscripciones;

    /*
     * 10. ESTADÍSTICAS
     */
    const numeroRegistros =
      estudiantesFiltrados.length;

    const asistenciasHombres =
      estudiantesFiltrados.filter(
        (inscripcion) =>
          inscripcion.asistio &&
          normalizarGenero(
            inscripcion.genero
          ) === "Hombre"
      ).length;

    const asistenciasMujeres =
      estudiantesFiltrados.filter(
        (inscripcion) =>
          inscripcion.asistio &&
          normalizarGenero(
            inscripcion.genero
          ) === "Mujer"
      ).length;

    const asistenciasTotal =
      estudiantesFiltrados.filter(
        (inscripcion) =>
          inscripcion.asistio
      ).length;

    const faltantes =
      numeroRegistros -
      asistenciasTotal;

    const porcentajeAsistencia =
      numeroRegistros > 0
        ? Number(
            (
              (asistenciasTotal /
                numeroRegistros) *
              100
            ).toFixed(1)
          )
        : 0;

    /*
     * 11. ESTUDIANTES PARA EL REPORTE
     */
    const estudiantes =
      estudiantesFiltrados.map(
        (inscripcion) => ({
          id:
            inscripcion.id,

          numeroCuenta:
            inscripcion.numero_estudiante,

          nombre:
            inscripcion.nombre_completo,

          genero:
            normalizarGenero(
              inscripcion.genero
            ),

          carrera:
            inscripcion.carrera,

          asistio:
            Boolean(
              inscripcion.asistio
            ),

          horaAsistencia:
            inscripcion.asistio_en,
        })
      );

    /*
     * 12. RESPUESTA
     */
    return res.status(200).json({
      evento,

      filtro: {
        tipo,

        carrera:
          tipo === "carrera"
            ? carreraFiltro
            : null,
      },

      carreras,

      datosSitec: {
        pendientes:
          datosSitecPendientes,

        actualizacion:
          datosActualizacion,
      },

      resumen: {
        numeroRegistros,

        asistenciasHombres,

        asistenciasMujeres,

        asistenciasTotal,

        porcentajeAsistencia,

        faltantes,
      },

      estudiantes,

      advertencias: [
        ...new Set(
          advertencias
        ),
      ],
    });
  } catch (error) {
    console.error(
      "Error generando reporte:",
      error
    );

    return res.status(500).json({
      error:
        "Ocurrió un error al generar el reporte.",
    });
  }
}