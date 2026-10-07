import { useEffect, useState } from "react";
import InstalarPWA from "../InstalarPWA";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import {
  cerrarSesionSitec,
  obtenerSesion,
  type UsuarioSesion,
} from "../../lib/sesion";

import ModalNuevoEvento from "./ModalNuevoEvento";
import ModalEventoCreado from "./ModalEventoCreado";

import type { EventoCreado } from "./ModalNuevoEvento";

type UsuarioMaestro = Extract<
  UsuarioSesion,
  {
    tipo: "maestro";
  }
>;

export type ContextoAdmin = {
  abrirModalNuevoEvento: () => void;

  rol: "maestro" | "admin" | "superadmin";

  puedeCrearEventos: boolean;
};

export default function LayoutAdmin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [usuario, setUsuario] = useState<UsuarioMaestro | null>(null);

  const [cargandoUsuario, setCargandoUsuario] = useState(true);

  const [menuAbierto, setMenuAbierto] = useState(false);

  const [modalNuevoEventoAbierto, setModalNuevoEventoAbierto] = useState(false);

  const [eventoCreado, setEventoCreado] = useState<EventoCreado | null>(null);

  /*
   * CARGAR USUARIO SITEc
   */
  useEffect(() => {
    async function cargarUsuario() {
      const sesion = await obtenerSesion();

      /*
       * RutaProtegida ya hace esta
       * validación, pero mantenemos
       * una segunda comprobación aquí.
       */
      if (!sesion || sesion.tipo !== "maestro") {
        navigate("/", {
          replace: true,
        });

        return;
      }

      setUsuario(sesion);
      setCargandoUsuario(false);

      /*
       * Los maestros normales no
       * necesitan entrar al dashboard
       * administrativo.
       */

      if (
        sesion.rol !== "superadmin" &&
        location.pathname.startsWith("/admin/maestros")
      ) {
        navigate("/admin/eventos", {
          replace: true,
        });

        return;
      }
    }

    cargarUsuario();
  }, [navigate, location.pathname]);

  /*
   * PERMISOS
   */
  const puedeCrearEventos =
    usuario?.rol === "admin" || usuario?.rol === "superadmin";

  const puedeVerDashboard = true;

  const puedeAdministrarMaestros = usuario?.rol === "superadmin";
  /*
   * ABRIR NUEVO EVENTO
   */
  const abrirModalNuevoEvento = () => {
    if (!puedeCrearEventos) {
      return;
    }

    setModalNuevoEventoAbierto(true);

    setMenuAbierto(false);
  };
  <div className="mb-3">
    <InstalarPWA />
  </div>;
  /*
   * CERRAR SESIÓN
   */
  const cerrarSesion = async () => {
    await cerrarSesionSitec();
  };

  /*
   * EVENTO CREADO
   */
  const alCrearEvento = (evento: EventoCreado) => {
    setModalNuevoEventoAbierto(false);

    setEventoCreado(evento);
  };

  const verEventoCreado = () => {
    if (!eventoCreado) {
      return;
    }

    const id = eventoCreado.id;

    setEventoCreado(null);

    navigate(`/admin/eventos/${id}`);
  };

  /*
   * CLASE DE LOS LINKS
   */
  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    `flex items-center rounded-xl px-4 py-3 text-sm font-medium transition ${
      isActive
        ? "bg-[#1B396A] text-white shadow-sm"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  /*
   * CARGANDO SESIÓN
   */
  if (cargandoUsuario || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Cargando panel...</p>
      </main>
    );
  }

  /*
   * TEXTO DEL ROL
   */
  const nombreRol =
    usuario.rol === "superadmin"
      ? "Superadministrador"
      : usuario.rol === "admin"
        ? "Administrador"
        : "Maestro";

  const descripcionRol =
    usuario.rol === "superadmin"
      ? "Control total del sistema"
      : usuario.rol === "admin"
        ? "Gestión de eventos"
        : "Control de asistencia";

  return (
    <div className="min-h-screen bg-slate-100">
      {/*
       * HEADER MÓVIL
       */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div>
          <p className="font-bold text-slate-900">Eventos Estudiantiles</p>

          <p className="text-xs text-slate-500">{nombreRol}</p>
        </div>

        <div className="flex items-center gap-2">
          <InstalarPWA />

          <button
            type="button"
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            {menuAbierto ? "Cerrar" : "Menú"}
          </button>
        </div>
      </header>

      {/*
       * FONDO MÓVIL
       */}
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/*
       * SIDEBAR
       */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 transform bg-slate-950 text-white transition-transform duration-200 lg:translate-x-0 ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/*
           * LOGO
           */}
          <div className="border-b border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1B396A] text-lg font-bold text-white">
                EA
              </div>

              <div>
                <h1 className="font-bold text-white">Eventos</h1>

                <p className="text-sm text-slate-400">
                  Panel de gestión del administrador
                </p>
              </div>
            </div>
          </div>

          {/*
           * CREAR EVENTO
           *
           * SOLO ADMIN Y SUPERADMIN
           */}
          {puedeCrearEventos && (
            <div className="p-4 pb-2">
              <button
                type="button"
                onClick={abrirModalNuevoEvento}
                className="w-full rounded-xl bg-[#1B396A] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                + Nuevo evento
              </button>
            </div>
          )}

          {/*
           * NAVEGACIÓN
           */}
          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Navegación
            </p>

            {/*
             * Dashboard solamente
             * admin y superadmin
             */}
            {puedeVerDashboard && (
              <NavLink
                to="/admin"
                end
                className={enlaceClase}
                onClick={() => setMenuAbierto(false)}
              >
                Dashboard
              </NavLink>
            )}

            {/*
             * Todos los maestros
             * pueden ver eventos
             */}
            <NavLink
              to="/admin/eventos"
              className={enlaceClase}
              onClick={() => setMenuAbierto(false)}
            >
              Eventos
            </NavLink>
            {/* Participación generar reportes */}
            <NavLink
              to="/admin/participacion"
              className={enlaceClase}
              onClick={() => setMenuAbierto(false)}
            >
              Participación 
            </NavLink>

            {/* Maestros y administradores */}
            {puedeAdministrarMaestros && (
              <NavLink
                to="/admin/maestros"
                className={enlaceClase}
                onClick={() => setMenuAbierto(false)}
              >
                Maestros y administradores
              </NavLink>
            )}
          </nav>

          {/*
           * USUARIO
           */}
          <div className="border-t border-slate-800 p-4">
            <div className="mb-3 rounded-xl bg-slate-900 p-4">
              <p className="text-sm font-semibold text-white">{nombreRol}</p>

              <p className="mt-1 text-xs text-slate-400">
                {usuario.usuarioSitec}
              </p>

              <p className="mt-2 text-xs text-slate-500">{descripcionRol}</p>
            </div>

            <button
              type="button"
              onClick={cerrarSesion}
              className="w-full rounded-xl border border-red-900/50 px-4 py-3 text-left text-sm font-medium text-red-400 transition hover:bg-red-950/50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/*
       * CONTENIDO
       */}
      <div className="lg:pl-72">
        {/*
         * BARRA SUPERIOR PC
         */}
        <header className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white px-8 lg:flex">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Sistema de eventos estudiantiles
            </p>
          </div>

          {/*
           * SOLO ADMIN Y SUPERADMIN
           */}
          {puedeCrearEventos && (
            <button
              type="button"
              onClick={abrirModalNuevoEvento}
              className="rounded-xl bg-[#1B396A] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Nuevo evento
            </button>
          )}
        </header>

        {/*
         * PÁGINA ACTUAL
         */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet
              context={{
                abrirModalNuevoEvento,
                rol: usuario.rol,
                puedeCrearEventos,
              }}
            />
          </div>
        </main>
      </div>

      {/*
       * MODALES
       *
       * Solo se montan para usuarios
       * con permiso para crear eventos.
       */}
      {puedeCrearEventos && (
        <>
          <ModalNuevoEvento
            abierto={modalNuevoEventoAbierto}
            cerrar={() => setModalNuevoEventoAbierto(false)}
            alCrear={alCrearEvento}
          />

          {eventoCreado && (
            <ModalEventoCreado
              evento={eventoCreado}
              cerrar={() => setEventoCreado(null)}
              verEvento={verEventoCreado}
            />
          )}
        </>
      )}
    </div>
  );
}
