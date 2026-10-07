import { BrowserRouter, Route, Routes } from "react-router";

import RutaProtegida from "./components/RutaProtegida";
import LayoutAdmin from "./components/admin/LayoutAdmin";
import MisEventos from "./pages/public/MisEventos";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Eventos from "./pages/admin/Eventos";
import DetalleEvento from "./pages/admin/DetalleEvento";
import EscanerQR from "./pages/admin/EscanerQR";
import Maestros from "./pages/admin/Maestros";
import Participacion from "./pages/admin/Participacion";

import EventosDisponibles from "./pages/public/EventosDisponibles";
import RegistroEvento from "./pages/public/RegistroEvento";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público */}
        <Route path="/" element={<EventosDisponibles />} />
        <Route path="/mis-eventos" element={<MisEventos />} />

        <Route path="/evento/:codigoEvento" element={<RegistroEvento />} />

        {/* Login */}
        <Route path="/admin/login" element={<Login />} />

        {/* Administración */}
        <Route
          path="/admin"
          element={
            <RutaProtegida>
              <LayoutAdmin />
            </RutaProtegida>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="/admin/participacion" element={<Participacion />} />

          <Route path="eventos" element={<Eventos />} />

          <Route path="eventos/:id" element={<DetalleEvento />} />

          <Route path="eventos/:id/escanear" element={<EscanerQR />} />

          <Route path="maestros" element={<Maestros />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
