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

    const {
      data: maestro,
      error: errorMaestro,
    } = await supabaseAdmin
      .from("maestros")
      .select(
        "id,activo"
      )
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
          "Tu cuenta no tiene acceso activo.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("eventos")
      .select(`
        id,
        codigo_evento,
        nombre,
        descripcion,
        fecha_evento,
        hora_evento,
        estado,
        creado_en
      `)
      .order(
        "fecha_evento",
        {
          ascending: true,
        }
      );

    if (error) {
      console.error(
        "Error cargando eventos:",
        error
      );

      return res.status(500).json({
        error:
          "No se pudieron cargar los eventos.",
      });
    }

    return res.status(200).json({
      eventos:
        data ?? [],
    });
  } catch (error) {
    console.error(
      "Error cargando eventos:",
      error
    );

    return res.status(500).json({
      error:
        "Ocurrió un error al cargar los eventos.",
    });
  }
}