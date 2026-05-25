#!/usr/bin/env node
/**
 * E2E completo del módulo Ventas + Notas de crédito + Pagos posteriores.
 *
 * Cubre flujos extendidos:
 *  - Crear venta SIN pagos → estado=confirmada
 *  - POST /ventas/:id/pagos: 1er pago parcial → estado=parcial
 *  - POST /ventas/:id/pagos: 2do pago saldo → estado=pagada
 *  - Excesivo: pago > pendiente → 409
 *  - Doble pago sobre venta pagada → 409
 *  - Crear venta con cliente, verificar totalCompras incrementa
 *  - Emitir NC parcial (devolver 1 de 2) → 201, NC-000001
 *  - Stock restaurado parcialmente
 *  - totalCompras decrementado
 *  - Emitir NC con cantidad > disponible → 400
 *  - Emitir NC con motivo vacío → 400
 *  - Anular NC → stock vuelve a salir, totalCompras vuelve a subir
 *  - Doble anulación NC → 409
 *  - Listar NC del cliente
 *  - Detalle venta incluye notasCredito[]
 */
const BASE = 'http://localhost:3001/api/v1';
const TENANT = 'mi-tienda';
const CREDS = { identificador: '70498300', password: process.env.ROPAS_PASS || 'Corona5L@' };

function paso(n, t) { console.log(`\n[${n}] ${t}`); }
function ok(t) { console.log(`  ✔ ${t}`); }
function fail(t) { console.error(`  ✘ ${t}`); process.exitCode = 1; }

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-Code': TENANT };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, body: json };
}

function assert(cond, msg) {
  if (!cond) { fail(msg); throw new Error('ABORT: ' + msg); }
  ok(msg);
}

async function leerStock(token, sucursalId, varianteId, productoNombre) {
  const r = await fetch(BASE + `/productos?buscar=${encodeURIComponent(productoNombre)}&limite=20`, {
    headers: { 'X-Tenant-Code': TENANT, Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  const p = j.datos.find(x => x.variantes?.some(v => v.id === varianteId));
  const v = p?.variantes.find(v => v.id === varianteId);
  return v?.stocks.find(x => x.sucursalId === sucursalId)?.disponible ?? null;
}

(async () => {
  let token, sucursalId, varianteId, productoNombre, precioEsperado, stockAntes, clienteId;

  paso(1, 'Login');
  {
    const r = await call('POST', '/auth/login', { body: CREDS });
    assert(r.status === 201 && r.body?.exito, 'login OK');
    token = r.body.datos.accessToken;
  }

  paso(2, 'Setup: sucursal + variante con stock>=4 (para parcial+devolución)');
  {
    const rs = await call('GET', '/sucursales', { token });
    sucursalId = rs.body.datos[0].id;

    const rp = await call('GET', '/productos?limite=50', { token });
    let pick;
    for (const p of rp.body.datos) {
      for (const v of (p.variantes || [])) {
        const s = v.stocks?.find(x => x.sucursalId === sucursalId);
        const precio = parseFloat(v.precioVenta ?? p.precioVenta ?? '0');
        if (s && s.disponible >= 4 && precio > 0) { pick = { p, v, s, precio }; break; }
      }
      if (pick) break;
    }
    assert(pick, 'hay variante con stock >= 4 y precio > 0');
    varianteId = pick.v.id;
    productoNombre = pick.p.nombre;
    precioEsperado = pick.precio;
    stockAntes = pick.s.disponible;
    console.log(`     ${productoNombre} ${pick.v.talla}/${pick.v.color} · S/${precioEsperado} · stock ${stockAntes}`);
  }

  paso(3, 'Setup: tomar primer cliente (o saltar)');
  {
    const rc = await call('GET', '/clientes?limite=1', { token });
    if (rc.status === 200 && rc.body?.datos?.length > 0) {
      clienteId = rc.body.datos[0].id;
      console.log(`     cliente: ${rc.body.datos[0].nombre} (${clienteId})`);
    } else {
      console.log('     (sin clientes — pruebas con cliente se saltan)');
    }
  }

  // ===================== PAGOS POSTERIORES =====================

  paso(4, 'Crear venta SIN pagos (estado=confirmada)');
  let ventaIdParcial;
  {
    const r = await call('POST', '/ventas', {
      token,
      body: {
        sucursalId,
        items: [{ varianteId, cantidad: 1, precioUnitario: precioEsperado }],
        notas: '__E2E_TEST__ pago posterior',
      },
    });
    assert(r.status === 201 && r.body?.exito, `HTTP ${r.status}`);
    assert(r.body.datos.estado === 'confirmada', `estado=confirmada (real: ${r.body.datos.estado})`);
    assert(parseFloat(r.body.datos.totalPagado) === 0, 'totalPagado = 0');
    ventaIdParcial = r.body.datos.id;
  }

  paso(5, 'Primer pago parcial (50%)');
  {
    const monto = Math.round(precioEsperado * 0.5 * 100) / 100;
    const r = await call('POST', `/ventas/${ventaIdParcial}/pagos`, {
      token,
      body: { medio: 'efectivo', monto },
    });
    assert(r.status === 201, `HTTP ${r.status}`);
    assert(r.body.datos.estado === 'parcial', `estado=parcial (real: ${r.body.datos.estado})`);
    assert(Math.abs(r.body.datos.totalPagado - monto) < 0.01, `totalPagado=${monto}`);
  }

  paso(6, 'Excesivo: monto > pendiente → 409');
  {
    const exceso = precioEsperado * 2;
    const r = await call('POST', `/ventas/${ventaIdParcial}/pagos`, {
      token, body: { medio: 'efectivo', monto: exceso },
    });
    assert(r.status === 409, `HTTP ${r.status} (esperado 409)`);
  }

  paso(7, 'Segundo pago saldo → estado=pagada');
  {
    const restante = precioEsperado - Math.round(precioEsperado * 0.5 * 100) / 100;
    const r = await call('POST', `/ventas/${ventaIdParcial}/pagos`, {
      token,
      body: { medio: 'yape', monto: Math.round(restante * 100) / 100, referencia: 'YAPE-E2E-001' },
    });
    assert(r.status === 201, `HTTP ${r.status}`);
    assert(r.body.datos.estado === 'pagada', `estado=pagada (real: ${r.body.datos.estado})`);
  }

  paso(8, 'Doble pago sobre venta ya pagada → 409');
  {
    const r = await call('POST', `/ventas/${ventaIdParcial}/pagos`, {
      token, body: { medio: 'efectivo', monto: 1 },
    });
    assert(r.status === 409, `HTTP ${r.status} (esperado 409)`);
  }

  paso(9, 'Detalle venta muestra 2 pagos');
  {
    const r = await call('GET', `/ventas/${ventaIdParcial}`, { token });
    assert(r.body.datos.pagos.length === 2, `2 pagos (real: ${r.body.datos.pagos.length})`);
    assert(r.body.datos.pagos[0].medio === 'efectivo' && r.body.datos.pagos[1].medio === 'yape',
      'orden de pagos preservado');
  }

  // ===================== NOTAS DE CRÉDITO =====================

  paso(10, 'Crear venta con CLIENTE y 2 unidades para devolver 1');
  let ventaParaNC, ventaItemParaNC, totalComprasAntes, stockTrasVenta2;
  {
    if (!clienteId) {
      console.log('     (saltado — no hay cliente disponible)');
    } else {
      // Capturar totalCompras del cliente antes
      const rc = await call('GET', `/clientes/${clienteId}`, { token });
      totalComprasAntes = parseFloat(rc.body.datos.totalCompras);

      const r = await call('POST', '/ventas', {
        token,
        body: {
          sucursalId,
          clienteId,
          items: [{ varianteId, cantidad: 2, precioUnitario: precioEsperado }],
          pagos: [{ medio: 'efectivo', monto: precioEsperado * 2 }],
          notas: '__E2E_TEST__ devolucion parcial',
        },
      });
      assert(r.status === 201, `HTTP ${r.status} (body: ${JSON.stringify(r.body).slice(0, 200)})`);
      ventaParaNC = r.body.datos.id;
      ventaItemParaNC = r.body.datos.items[0].id;

      // Verificar increment
      const rc2 = await call('GET', `/clientes/${clienteId}`, { token });
      const tc2 = parseFloat(rc2.body.datos.totalCompras);
      assert(
        Math.abs(tc2 - (totalComprasAntes + precioEsperado * 2)) < 0.01,
        `cliente.totalCompras += ${precioEsperado * 2} (antes ${totalComprasAntes}, después ${tc2})`,
      );

      stockTrasVenta2 = await leerStock(token, sucursalId, varianteId, productoNombre);
      console.log(`     stock tras venta paso 10: ${stockTrasVenta2}`);
    }
  }

  paso(11, 'NC con motivo vacío → 400');
  if (ventaParaNC) {
    const r = await call('POST', '/notas-credito', {
      token,
      body: { ventaId: ventaParaNC, motivo: '   ', items: [{ ventaItemId: ventaItemParaNC, cantidad: 1 }] },
    });
    assert(r.status === 400, `HTTP ${r.status}`);
  } else { console.log('     (saltado)'); }

  paso(12, 'NC con cantidad > vendida → 400');
  if (ventaParaNC) {
    const r = await call('POST', '/notas-credito', {
      token,
      body: { ventaId: ventaParaNC, motivo: 'devolver de más', items: [{ ventaItemId: ventaItemParaNC, cantidad: 99 }] },
    });
    assert(r.status === 400, `HTTP ${r.status}`);
  } else { console.log('     (saltado)'); }

  paso(13, 'Emitir NC parcial: devolver 1 de 2');
  let ncId, ncNumero;
  if (ventaParaNC) {
    const r = await call('POST', '/notas-credito', {
      token,
      body: {
        ventaId: ventaParaNC,
        motivo: 'E2E: cliente devolvió 1 unidad por talla incorrecta',
        items: [{ ventaItemId: ventaItemParaNC, cantidad: 1 }],
      },
    });
    assert(r.status === 201 && r.body?.exito, `HTTP ${r.status}`);
    assert(/^NC-\d{6}$/.test(r.body.datos.numero), `numero NC-NNNNNN (${r.body.datos.numero})`);
    assert(parseFloat(r.body.datos.total) === precioEsperado, `total NC = ${precioEsperado}`);
    assert(r.body.datos.estado === 'emitida', 'estado=emitida');
    ncId = r.body.datos.id;
    ncNumero = r.body.datos.numero;
  } else { console.log('     (saltado)'); }

  paso(14, 'Verificar stock restaurado por NC (volvió +1 respecto al snapshot post-venta)');
  if (ventaParaNC) {
    const ahora = await leerStock(token, sucursalId, varianteId, productoNombre);
    assert(ahora === stockTrasVenta2 + 1,
      `stock = ${stockTrasVenta2 + 1} (snapshot ${stockTrasVenta2} + 1; real: ${ahora})`);
  }

  paso(15, 'Verificar cliente.totalCompras decrementado por NC');
  if (ventaParaNC) {
    const rc = await call('GET', `/clientes/${clienteId}`, { token });
    const tc = parseFloat(rc.body.datos.totalCompras);
    const esperado = totalComprasAntes + precioEsperado * 2 - precioEsperado;
    assert(Math.abs(tc - esperado) < 0.01,
      `cliente.totalCompras = ${esperado} (real: ${tc})`);
  }

  paso(16, 'Detalle venta incluye notasCredito[] y disponible para devolver');
  if (ventaParaNC) {
    const r = await call('GET', `/ventas/${ventaParaNC}`, { token });
    assert(Array.isArray(r.body.datos.notasCredito) && r.body.datos.notasCredito.length === 1,
      'venta incluye 1 NC asociada');
    assert(r.body.datos.notasCredito[0].numero === ncNumero, `NC numero coincide`);
    assert(Array.isArray(r.body.datos.items[0].notasCreditoItems),
      'item incluye notasCreditoItems');
  }

  paso(17, 'NC repetida que excede disponible (ya devolvió 1, quedan 1, intentar 2) → 400');
  if (ventaParaNC) {
    const r = await call('POST', '/notas-credito', {
      token,
      body: {
        ventaId: ventaParaNC,
        motivo: 'segundo intento excesivo',
        items: [{ ventaItemId: ventaItemParaNC, cantidad: 2 }],
      },
    });
    assert(r.status === 400, `HTTP ${r.status}`);
  }

  paso(18, 'GET /notas-credito?ventaId=… devuelve la NC');
  if (ncId) {
    const r = await call('GET', `/notas-credito?ventaId=${ventaParaNC}`, { token });
    assert(r.status === 200, `HTTP ${r.status}`);
    assert(r.body.datos.find(x => x.id === ncId), 'NC encontrada en listado');
  }

  paso(19, 'Anular NC → stock vuelve a -2, cliente totalCompras vuelve a +2 unidades');
  if (ncId) {
    const r = await call('POST', `/notas-credito/${ncId}/anular`, {
      token, body: { motivo: 'E2E: NC emitida por error' },
    });
    assert(r.status === 201, `HTTP ${r.status}`);
    assert(r.body.datos.estado === 'anulada', 'estado=anulada');

    // stock vuelve al snapshot post-venta (NC anulada saca de nuevo)
    const ahora = await leerStock(token, sucursalId, varianteId, productoNombre);
    assert(ahora === stockTrasVenta2,
      `stock vuelve a ${stockTrasVenta2} tras anular NC (real: ${ahora})`);

    // cliente
    const rc = await call('GET', `/clientes/${clienteId}`, { token });
    const tc = parseFloat(rc.body.datos.totalCompras);
    const esperado = totalComprasAntes + precioEsperado * 2;
    assert(Math.abs(tc - esperado) < 0.01,
      `cliente.totalCompras = ${esperado} (real: ${tc})`);
  }

  paso(20, 'Doble anulación NC → 409');
  if (ncId) {
    const r = await call('POST', `/notas-credito/${ncId}/anular`, {
      token, body: { motivo: 'segundo intento' },
    });
    assert(r.status === 409, `HTTP ${r.status}`);
  }

  // ===================== CLEANUP =====================

  paso(21, 'Limpieza: anular ventas de prueba');
  for (const id of [ventaIdParcial, ventaParaNC].filter(Boolean)) {
    const r = await call('POST', `/ventas/${id}/anular`, {
      token, body: { motivo: 'E2E limpieza automática' },
    });
    if (r.status === 201) ok(`anulada ${id}`);
    else if (r.status === 409) ok(`${id} ya estaba anulada`);
    else fail(`HTTP ${r.status} al anular ${id}`);
  }

  console.log('\n' + (process.exitCode ? '❌ E2E con fallos' : '✅ E2E AMPLIADO PASS'));
  process.exit(process.exitCode ?? 0);
})().catch(e => {
  console.error('\n💥 EXCEPCIÓN', e.message);
  process.exit(1);
});
