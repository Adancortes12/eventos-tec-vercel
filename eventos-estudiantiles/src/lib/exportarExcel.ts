import type { Workbook, Worksheet } from "exceljs";

type ValorExcel = string | number | boolean | Date | null;

export type ReporteExcel = {
  titulo: string;
  nombreArchivo: string;
  resumen: { etiqueta: string; valor: ValorExcel; formato?: string }[];
  hojas: {
    nombre: string;
    columnas: { titulo: string; ancho: number; formato?: string }[];
    filas: ValorExcel[][];
  }[];
};

const AZUL = "FF1B396A";
const ZONA_HORARIA = "America/Mexico_City";
const FILA_ENCABEZADOS = 6;

export function fechaArchivoExcel(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

// Las fechas del evento son días de calendario, sin conversión de zona horaria.
export function fechaParaExcel(valor: string | null): Date | null {
  if (!valor) return null;
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!coincidencia) return null;
  const [, anio, mes, dia] = coincidencia;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  return fecha.toISOString().slice(0, 10) === `${anio}-${mes}-${dia}` ? fecha : null;
}

// Excel no guarda zonas horarias. Se escribe el reloj local de Ciudad de México.
export function fechaHoraParaExcel(valor: string | null): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha);
  const numero = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
  return new Date(Date.UTC(
    numero("year"), numero("month") - 1, numero("day"),
    numero("hour"), numero("minute"), numero("second"),
  ));
}

function comprobarCancelacion(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Descarga cancelada.", "AbortError");
}

function crearHoja(
  libro: Workbook,
  nombre: string,
  titulo: string,
  generacion: string,
  columnas: ReporteExcel["hojas"][number]["columnas"],
): Worksheet {
  const hoja = libro.addWorksheet(nombre, {
    properties: { defaultRowHeight: 24 },
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADOS, xSplit: 1 }],
    pageSetup: {
      orientation: "landscape", fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${FILA_ENCABEZADOS}`,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "&LInstituto Tecnológico de Colima&RPágina &P de &N" },
  });
  hoja.columns = columnas.map((columna) => ({
    width: columna.ancho, style: { numFmt: columna.formato ?? "General" },
  }));
  const cabecera = ["TECNOLÓGICO NACIONAL DE MÉXICO", "Instituto Tecnológico de Colima", titulo, generacion];
  cabecera.forEach((texto, indice) => {
    const numero = indice + 1;
    hoja.mergeCells(numero, 1, numero, columnas.length);
    const celda = hoja.getCell(numero, 1);
    celda.value = texto;
    celda.font = { name: "Calibri", size: indice === 2 ? 16 : 11, bold: indice < 3, color: { argb: AZUL } };
    celda.alignment = { vertical: "middle", wrapText: true };
    hoja.getRow(numero).height = indice === 2 ? 30 : 22;
  });
  const encabezados = hoja.getRow(FILA_ENCABEZADOS);
  encabezados.values = columnas.map((columna) => columna.titulo);
  encabezados.height = 32;
  encabezados.eachCell((celda) => {
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  return hoja;
}

function agregarFilas(
  hoja: Worksheet,
  columnas: ReporteExcel["hojas"][number]["columnas"],
  filas: ValorExcel[][],
) {
  if (filas.length > 1048576 - FILA_ENCABEZADOS) {
    throw new Error("El reporte supera el máximo de filas permitido por Excel.");
  }
  for (const valores of filas) {
    const fila = hoja.addRow(valores);
    let lineas = 1;
    columnas.forEach((columna, indice) => {
      const celda = fila.getCell(indice + 1);
      // Las cadenas se escriben como texto, incluso si empiezan con =, +, - o @.
      celda.numFmt = columna.formato ?? "General";
      celda.font = { name: "Calibri", size: 11, color: { argb: "FF243247" } };
      celda.alignment = { vertical: "middle", wrapText: true, horizontal: typeof valores[indice] === "number" ? "right" : "left" };
      celda.border = { bottom: { style: "hair", color: { argb: "FFDDE3EC" } } };
      if (fila.number % 2 === 0) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6FA" } };
      }
      if (typeof valores[indice] === "string") {
        lineas = Math.max(lineas, Math.ceil(valores[indice].length / Math.max(columna.ancho - 3, 1)));
      }
    });
    fila.height = Math.max(24, Math.min(lineas, 16) * 15 + 8);
  }
  hoja.autoFilter = {
    from: { row: FILA_ENCABEZADOS, column: 1 },
    to: { row: Math.max(hoja.rowCount, FILA_ENCABEZADOS), column: columnas.length },
  };
}

export async function descargarExcel(reporte: ReporteExcel, signal?: AbortSignal): Promise<void> {
  comprobarCancelacion(signal);
  // Vite crea un bloque separado; ExcelJS se carga cuando se solicita el Excel.
  const ExcelJS = await import("exceljs");
  comprobarCancelacion(signal);
  const libro = new ExcelJS.default.Workbook();
  libro.creator = "Instituto Tecnológico de Colima";
  libro.title = reporte.titulo;
  libro.created = new Date();
  libro.modified = libro.created;
  const generacion = `Generado: ${new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_HORARIA, dateStyle: "short", timeStyle: "medium",
  }).format(libro.created)} · Ciudad de México`;

  const columnasResumen = [{ titulo: "Indicador o filtro", ancho: 42 }, { titulo: "Valor", ancho: 84 }];
  const resumen = crearHoja(libro, "Resumen", reporte.titulo, generacion, columnasResumen);
  agregarFilas(resumen, columnasResumen, reporte.resumen.map((campo) => [campo.etiqueta, campo.valor]));
  reporte.resumen.forEach((campo, indice) => {
    resumen.getCell(FILA_ENCABEZADOS + 1 + indice, 2).numFmt = campo.formato ?? "General";
  });
  for (const datos of reporte.hojas) {
    comprobarCancelacion(signal);
    const hoja = crearHoja(libro, datos.nombre, reporte.titulo, generacion, datos.columnas);
    agregarFilas(hoja, datos.columnas, datos.filas);
  }

 comprobarCancelacion(signal);

const contenido = await libro.xlsx.writeBuffer();

comprobarCancelacion(signal);

const archivo = new Blob(
  [new Uint8Array(contenido)],
  {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }
);

const url =
  URL.createObjectURL(archivo);

const enlace =
  document.createElement("a");

enlace.href = url;

const nombreSeguro =
  reporte.nombreArchivo
    .replace(/\.xlsx$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();

enlace.download =
  `${nombreSeguro}.xlsx`;

document.body.appendChild(enlace);

try {
  enlace.click();
} finally {
  enlace.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}
}
