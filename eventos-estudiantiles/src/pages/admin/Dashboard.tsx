import { useEffect, useState } from "react";
import {
  Link,
  useOutletContext,
} from "react-router";

type Evento = {
  id: string;
  codigo_evento: string;
  nombre: string;
  fecha_evento: string;
  hora_evento: string;
  estado: string;
};

type ContextoAdmin = {
  abrirModalNuevoEvento: () => void;
};

export default function Dashboard() {
  const { abrirModalNuevoEvento } =
    useOutletContext<ContextoAdmin>();

  const [totalEventos, setTotalEventos] =
    useState(0);

  const [eventosActivos, setEventosActivos] =
    useState(0);

  const [totalRegistrados, setTotalRegistrados] =
    useState(0);

  const [totalAsistencias, setTotalAsistencias] =
    useState(0);

  const [eventosRecientes, setEventosRecientes] =
    useState<Evento[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

 useEffect(() => {
  const cargarDashboard =
    async () => {
      setCargando(true);
      setError("");

      try {
        const respuesta =
          await fetch(
            "/api/admin/dashboard",
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
              "No se pudo cargar el dashboard."
          );
        }

        setTotalEventos(
          datos.totalEventos ??
            0
        );

        setEventosActivos(
          datos.eventosActivos ??
            0
        );

        setTotalRegistrados(
          datos.totalRegistrados ??
            0
        );

        setTotalAsistencias(
          datos.totalAsistencias ??
            0
        );

        setEventosRecientes(
          datos.eventosRecientes ??
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
            : "No se pudo cargar el dashboard."
        );
      } finally {
        setCargando(false);
      }
    };

  void cargarDashboard();
}, []);

  const porcentajeGeneral =
    totalRegistrados > 0
      ? (
          (totalAsistencias /
            totalRegistrados) *
          100
        ).toFixed(1)
      : "0.0";

  if (cargando) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">
          Cargando dashboard...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1B396A]">
            Panel administrativo
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#1F2937]">
            Dashboard
          </h1>

          <p className="mt-2 text-gray-600">
            Consulta rápidamente el estado de tus
            eventos y asistencias.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalNuevoEvento}
          className="w-fit rounded-xl bg-[#1B396A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          + Crear evento
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Estadísticas */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">
            Eventos totales
          </p>

          <p className="mt-3 text-4xl font-bold text-[#1F2937]">
            {totalEventos}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Eventos creados en el sistema
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">
            Eventos activos
          </p>

          <p className="mt-3 text-4xl font-bold text-green-600">
            {eventosActivos}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Disponibles para registro
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">
            Estudiantes registrados
          </p>

          <p className="mt-3 text-4xl font-bold text-[#1B396A]">
            {totalRegistrados}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Registros acumulados
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">
            Asistencias
          </p>

          <p className="mt-3 text-4xl font-bold text-violet-600">
            {totalAsistencias}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {porcentajeGeneral}% de asistencia general
          </p>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1F2937]">
          Acciones rápidas
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={abrirModalNuevoEvento}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1B396A] hover:shadow"
          >
            <p className="font-semibold text-[#1F2937]">
              Crear nuevo evento
            </p>

            <p className="mt-1 text-sm text-gray-600">
              Registra un evento y genera su enlace y QR.
            </p>
          </button>

          <Link
            to="/admin/eventos"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1B396A] hover:shadow"
          >
            <p className="font-semibold text-[#1F2937]">
              Administrar eventos
            </p>

            <p className="mt-1 text-sm text-gray-600">
              Consulta registros, asistencias y eventos.
            </p>
          </Link>
        </div>
      </div>

      {/* Eventos recientes */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 id="eventos-recientes" className="text-xl font-bold text-[#1F2937]">
              Eventos recientes
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Últimos eventos registrados.
            </p>
          </div>

          <Link
            to="/admin/eventos"
            className="w-fit text-sm font-semibold text-[#1B396A] hover:opacity-80"
          >
            Ver todos →
          </Link>
        </div>

        {eventosRecientes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-700">
              Todavía no hay eventos.
            </p>

            <p className="mt-1 text-sm text-gray-600">
              Crea uno para comenzar.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {eventosRecientes.map((evento) => (
              <div
                key={evento.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-[#F5F5F5] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#1B396A]">
                      {evento.codigo_evento}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        evento.estado === "activo"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {evento.estado === "activo"
                        ? "Activo"
                        : "Finalizado"}
                    </span>
                  </div>

                  <h3 className="mt-2 font-semibold text-[#1F2937]">
                    {evento.nombre}
                  </h3>

                  <p className="mt-1 text-sm text-gray-600">
                    {evento.fecha_evento} ·{" "}
                    {evento.hora_evento}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/admin/eventos/${evento.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Ver evento
                  </Link>

                  {evento.estado === "activo" && (
                    <Link
                      to={`/admin/eventos/${evento.id}/escanear`}
                      className="rounded-lg bg-[#1B396A] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      Pasar asistencia
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}