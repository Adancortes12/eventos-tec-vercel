import {
  obtenerCookie,
  verificarSesion,
} from "../../server/lib/session.js";

import {
  supabaseAdmin,
} from "../../server/lib/supabaseAdmin.js";

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

  res.setHeader(
    "Cache-Control",
    "private, no-store"
  );

  try {
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
          "Debes iniciar sesión.",
      });
    }

    /*
     * Verificar que el maestro
     * continúe activo.
     */
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
        "Error verificando maestro:",
        errorMaestro
      );

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
          "Tu cuenta no tiene acceso activo.",
      });
    }

    const [
      totalEventosRespuesta,
      eventosActivosRespuesta,
      registradosRespuesta,
      asistenciasRespuesta,
      recientesRespuesta,
    ] = await Promise.all([
      supabaseAdmin
        .from("eventos")
        .select("*", {
          count: "exact",
          head: true,
        }),

      supabaseAdmin
        .from("eventos")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "estado",
          "activo"
        ),

      supabaseAdmin
        .from("inscripciones")
        .select("*", {
          count: "exact",
          head: true,
        }),

      supabaseAdmin
        .from("inscripciones")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "asistio",
          true
        ),

      supabaseAdmin
        .from("eventos")
        .select(`
          id,
          codigo_evento,
          nombre,
          fecha_evento,
          hora_evento,
          estado
        `)
        .order(
          "creado_en",
          {
            ascending: false,
          }
        )
        .limit(5),
    ]);

    const errorConsulta =
      totalEventosRespuesta.error ||
      eventosActivosRespuesta.error ||
      registradosRespuesta.error ||
      asistenciasRespuesta.error ||
      recientesRespuesta.error;

    if (errorConsulta) {
      console.error(
        "Error dashboard:",
        errorConsulta
      );

      return res.status(500).json({
        error:
          "No se pudo cargar el dashboard.",
      });
    }

    return res.status(200).json({
      totalEventos:
        totalEventosRespuesta.count ??
        0,

      eventosActivos:
        eventosActivosRespuesta.count ??
        0,

      totalRegistrados:
        registradosRespuesta.count ??
        0,

      totalAsistencias:
        asistenciasRespuesta.count ??
        0,

      eventosRecientes:
        recientesRespuesta.data ??
        [],
    });
  } catch (error) {
    console.error(
      "Error dashboard:",
      error
    );

    return res.status(500).json({
      error:
        "Ocurrió un error al cargar el dashboard.",
    });
  }
}