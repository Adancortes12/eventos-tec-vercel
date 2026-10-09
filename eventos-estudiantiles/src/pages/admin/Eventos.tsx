import { useEffect, useMemo, useState } from "react";

import {
  Link,
  useOutletContext,
} from "react-router";

type Evento = {
  id: string;
  codigo_evento: string;
  nombre: string;
  descripcion: string | null;
  fecha_evento: string;
  hora_evento: string;
  estado: string;
  creado_en: string;
};

type ContextoAdmin = {
  abrirModalNuevoEvento: () => void;

  rol:
    | "maestro"
    | "admin"
    | "superadmin";

  puedeCrearEventos: boolean;
};

type FiltroEstado =
  | "todos"
  | "activo"
  | "finalizado";

export default function Eventos() {
  const {
    abrirModalNuevoEvento,
    puedeCrearEventos,
  } = useOutletContext<ContextoAdmin>();

  const [eventos, setEventos] =
    useState<Evento[]>([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstado>("todos");

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * Guarda el ID del evento que se está
   * finalizando para evitar doble clic.
   */
  const [
    eventoFinalizandoId,
    setEventoFinalizandoId,
  ] = useState<string | null>(null);

  /*
   * =====================================
   * CARGAR EVENTOS
   * =====================================
   */
 useEffect(() => {
  const cargarEventos =
    async () => {
      setCargando(true);
      setError("");

      try {
        const respuesta =
          await fetch(
            "/api/eventos/listar",
            {
              method: "GET",
              credentials:
                "include",
            }
          );

        const datos =
          await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            datos.error ??
              "No se pudieron cargar los eventos."
          );
        }

        setEventos(
          datos.eventos ??
            []
        );
      } catch (
        errorConsulta
      ) {
        console.error(
          errorConsulta
        );

        setError(
          errorConsulta instanceof
            Error
            ? errorConsulta.message
            : "No se pudieron cargar los eventos."
        );
      } finally {
        setCargando(false);
      }
    };

  void cargarEventos();
}, []);

  /*
   * =====================================
   * FILTRAR EVENTOS
   * =====================================
   */
  const eventosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return eventos.filter(
        (evento) => {
          const coincideEstado =
            filtroEstado === "todos" ||
            evento.estado ===
              filtroEstado;

          const coincideBusqueda =
            texto === "" ||
            evento.nombre
              .toLowerCase()
              .includes(texto) ||
            evento.codigo_evento
              .toLowerCase()
              .includes(texto);

          return (
            coincideEstado &&
            coincideBusqueda
          );
        }
      );
    }, [
      eventos,
      busqueda,
      filtroEstado,
    ]);

  /*
   * =====================================
   * TOTALES
   * =====================================
   */
  const totalActivos =
    eventos.filter(
      (evento) =>
        evento.estado === "activo"
    ).length;

  const totalFinalizados =
    eventos.filter(
      (evento) =>
        evento.estado ===
        "finalizado"
    ).length;

  /*
   * =====================================
   * FINALIZAR EVENTO
   * =====================================
   */
  const finalizarEvento = async (
    evento: Evento
  ) => {
    if (
      evento.estado !== "activo" ||
      eventoFinalizandoId
    ) {
      return;
    }

    const confirmar =
      window.confirm(
        `¿Seguro que quieres finalizar el evento "${evento.nombre}"?`
      );

    if (!confirmar) {
      return;
    }

    setEventoFinalizandoId(
      evento.id
    );

    try {
      const respuesta =
        await fetch(
          "/api/eventos/finalizar",
          {
            method: "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              eventoId:
                evento.id,
            }),
          }
        );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {
        window.alert(
          datos.error ??
            "No se pudo finalizar el evento."
        );

        return;
      }

      /*
       * Actualizamos solamente el evento
       * modificado en el estado local.
       *
       * Así no necesitamos recargar
       * toda la página.
       */
      setEventos(
        (eventosActuales) =>
          eventosActuales.map(
            (eventoActual) =>
              eventoActual.id ===
              evento.id
                ? {
                    ...eventoActual,
                    estado:
                      "finalizado",
                  }
                : eventoActual
          )
      );
    } catch (errorConsulta) {
      console.error(
        errorConsulta
      );

      window.alert(
        "No se pudo conectar con el servidor."
      );
    } finally {
      setEventoFinalizandoId(
        null
      );
    }
  };

  return (
    <div>
      {/* =====================================
          ENCABEZADO
      ====================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1B396A]">
            Administración
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#1F2937]">
            Eventos
          </h1>

          <p className="mt-2 text-gray-600">
            {puedeCrearEventos
              ? "Consulta y administra los eventos registrados."
              : "Consulta los eventos y registra asistencias."}
          </p>
        </div>

        {puedeCrearEventos && (
          <button
            type="button"
            onClick={
              abrirModalNuevoEvento
            }
            className="w-fit rounded-xl bg-[#1B396A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            + Nuevo evento
          </button>
        )}
      </div>

      {/* =====================================
          RESUMEN
      ====================================== */}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* TOTAL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">
            Total
          </p>

          <p className="mt-2 text-3xl font-bold text-[#1F2937]">
            {eventos.length}
          </p>
        </div>

        {/* ACTIVOS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">
            Activos
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            {totalActivos}
          </p>
        </div>

        {/* FINALIZADOS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">
            Finalizados
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-600">
            {totalFinalizados}
          </p>
        </div>
      </div>

      {/* =====================================
          BÚSQUEDA Y FILTROS
      ====================================== */}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* BUSCADOR */}

          <div className="w-full lg:max-w-md">
            <label className="sr-only">
              Buscar evento
            </label>

            <input
              type="search"
              value={busqueda}
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
              placeholder="Buscar por nombre o código..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#1F2937] outline-none transition focus:border-[#1B396A]"
            />
          </div>

          {/* FILTROS */}

          <div className="flex flex-wrap gap-2">
            {/* TODOS */}

            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "todos"
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filtroEstado ===
                "todos"
                  ? "bg-slate-900 text-white"
                  : "bg-[#F5F5F5] text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos
            </button>

            {/* ACTIVOS */}

            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "activo"
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filtroEstado ===
                "activo"
                  ? "bg-green-600 text-white"
                  : "bg-[#F5F5F5] text-slate-600 hover:bg-slate-200"
              }`}
            >
              Activos
            </button>

            {/* FINALIZADOS */}

            <button
              type="button"
              onClick={() =>
                setFiltroEstado(
                  "finalizado"
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filtroEstado ===
                "finalizado"
                  ? "bg-slate-700 text-white"
                  : "bg-[#F5F5F5] text-slate-600 hover:bg-slate-200"
              }`}
            >
              Finalizados
            </button>
          </div>
        </div>
      </div>

      {/* =====================================
          ESTADOS
      ====================================== */}

      {cargando && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">
            Cargando eventos...
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!cargando &&
        !error &&
        eventosFiltrados.length ===
          0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="font-semibold text-slate-800">
              No se encontraron
              eventos
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Prueba otra búsqueda o
              cambia el filtro.
            </p>
          </div>
        )}

      {/* =====================================
          LISTA DE EVENTOS
      ====================================== */}

      {!cargando &&
        !error &&
        eventosFiltrados.length >
          0 && (
          <>
            {/* CANTIDAD */}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando{" "}
                {
                  eventosFiltrados.length
                }{" "}
                evento
                {eventosFiltrados.length !==
                1
                  ? "s"
                  : ""}
              </p>
            </div>

            {/* TARJETAS */}

            <div className="mt-4 grid gap-4">
              {eventosFiltrados.map(
                (evento) => (
                  <article
                    key={
                      evento.id
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      {/* INFORMACIÓN */}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* CÓDIGO */}

                          <span className="text-xs font-semibold text-[#1B396A]">
                            {
                              evento.codigo_evento
                            }
                          </span>

                          {/* ESTADO */}

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              evento.estado ===
                              "activo"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {evento.estado ===
                            "activo"
                              ? "Activo"
                              : "Finalizado"}
                          </span>
                        </div>

                        {/* NOMBRE */}

                        <h2 className="mt-3 text-xl font-bold text-[#1F2937]">
                          {
                            evento.nombre
                          }
                        </h2>

                        {/* DESCRIPCIÓN */}

                        {evento.descripcion && (
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                            {
                              evento.descripcion
                            }
                          </p>
                        )}

                        {/* FECHA Y HORA */}

                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                          <p>
                            <span className="font-medium text-slate-700">
                              Fecha:
                            </span>{" "}
                            {
                              evento.fecha_evento
                            }
                          </p>

                          <p>
                            <span className="font-medium text-slate-700">
                              Hora:
                            </span>{" "}
                            {
                              evento.hora_evento
                            }
                          </p>
                        </div>
                      </div>

                      {/* =====================================
                          ACCIONES
                      ====================================== */}

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {/* VER EVENTO */}

                        <Link
                          to={`/admin/eventos/${evento.id}`}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#F5F5F5]"
                        >
                          Ver evento
                        </Link>

                        {/* PASAR ASISTENCIA */}

                        {evento.estado ===
                          "activo" && (
                          <Link
                            to={`/admin/eventos/${evento.id}/escanear`}
                            className="rounded-xl bg-[#1B396A] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            Pasar
                            asistencia
                          </Link>
                        )}

                        {/* FINALIZAR EVENTO */}

                        {puedeCrearEventos &&
                          evento.estado ===
                            "activo" && (
                            <button
                              type="button"
                              onClick={() =>
                                finalizarEvento(
                                  evento
                                )
                              }
                              disabled={
                                eventoFinalizandoId !==
                                null
                              }
                              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {eventoFinalizandoId ===
                              evento.id
                                ? "Finalizando..."
                                : "Finalizar evento"}
                            </button>
                          )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </>
        )}
    </div>
  );
}