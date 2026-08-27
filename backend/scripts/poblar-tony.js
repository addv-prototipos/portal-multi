#!/usr/bin/env node
// Poblar BD portal_facturacion sin tenant - 4 meses atrás
// Requisitos Tony: 4 meses, inventario, pronóstico positivo utilidades,
// 70% facturado / 30% sin facturar, algunas CxC pendientes
// Directo a BD, transaccional, idempotente con nota marcada.

const { pool } = require('../db');

const NOTA_PRUEBA = 'Poblado Tony - 4 meses';
const RFC_PRUEBA = 'XAXX010101000';
const SEMILLA = 20260826;

// PRNG determinista
function crearPrng(s) { let a=s>>>0; return ()=>{a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; } }
const prng = crearPrng(SEMILLA);
function azarEntre(min,max){ return min+prng()*(max-min); }
function azarEntero(min,max){ return Math.floor(azarEntre(min,max+1)); }
function elegir(arr){ return arr[azarEntero(0,arr.length-1)]; }
function prob(p){ return prng()<p; }
function fechaUtc(a,m,d,h,mi){ return new Date(Date.UTC(a,m,d,h,mi,azarEntero(0,59))); }

const CONCEPTOS = ['Suministro de equipo de cómputo','Servicio de mantenimiento preventivo','Refacción original','Consumibles de oficina','Instalación de red estructurada','Licencia de software anual','Cableado y conectores','Equipo de videovigilancia','Soporte técnico mensual','Mobiliario de oficina','Toners y cartuchos','Instalación eléctrica'];
function montoVenta(){
  const dado=prng();
  if(dado<0.4) return azarEntre(5000,9000);
  if(dado<0.8) return azarEntre(9000,18000);
  if(dado<0.95) return azarEntre(18000,32000);
  return azarEntre(32000,50000);
}
const GASTOS_FIJOS=[
  {categoria:'renta', proveedor:'Inmobiliaria Central', concepto:'Renta mensual de oficinas', min:14000,max:16000, dia:()=>azarEntero(2,5), recurrente:true},
  {categoria:'nomina', proveedor:'Prestaciones de personal', concepto:'Nómina primera quincena', min:26000,max:32000, dia:()=>azarEntero(14,16), recurrente:true},
  {categoria:'nomina', proveedor:'Prestaciones de personal', concepto:'Nómina segunda quincena', min:26000,max:32000, dia:()=>azarEntero(26,28), recurrente:true},
];
const GASTOS_VARIABLES=[
  {categoria:'software', proveedores:['Microsoft México','Adobe'], concepto:'Suscripción de software', min:800,max:3500, veces:[1,2], rec:true},
  {categoria:'hosting', proveedores:['AWS','DigitalOcean'], concepto:'Infraestructura y hosting', min:400,max:2000, veces:[1,2], rec:true},
  {categoria:'servicios', proveedores:['Telmex','CFE'], concepto:'Servicios básicos', min:600,max:2500, veces:[1,2], rec:true},
  {categoria:'papeleria', proveedores:['Office Depot','Lumen'], concepto:'Papelería e insumos', min:300,max:1800, veces:[0,2], rec:false},
  {categoria:'combustible', proveedores:['Pemex','BP'], concepto:'Combustible de unidades', min:700,max:2500, veces:[0,2], rec:false},
  {categoria:'viaticos', proveedores:['Uber','Hotel Vista'], concepto:'Viáticos visita cliente', min:900,max:4000, veces:[0,1], rec:false},
  {categoria:'publicidad', proveedores:['Meta Ads'], concepto:'Campaña digital', min:1000,max:5000, veces:[0,1], rec:false},
  {categoria:'otro', proveedores:['Fletes del Bajío'], concepto:'Gasto operativo varios', min:300,max:2500, veces:[0,1], rec:false},
];

async function main(){
  const [[ex]]=await pool.query('SELECT COUNT(*) n FROM gastos WHERE notas=?',[NOTA_PRUEBA]);
  if(ex.n>0){ console.error(`Ya existen ${ex.n} gastos con nota "${NOTA_PRUEBA}" - limpia antes`); process.exit(1); }
  const hoy=new Date();
  const anio=hoy.getUTCFullYear(), mes=hoy.getUTCMonth();
  // 4 meses atrás: 26 Abr 2026 hasta ayer 25 Ago
  const inicio=new Date(Date.UTC(anio,3,26)); // mes 3 = abril
  const fin=new Date(Date.UTC(anio,mes,hoy.getUTCDate()-1));
  console.log(`Poblando desde ${inicio.toISOString().slice(0,10)} hasta ${fin.toISOString().slice(0,10)}`);

  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    // --- Inventario: categorías + productos ---
    // Crear 3 categorias inventario
    const cats=[{nombre:'Cómputo'},{nombre:'Mobiliario'},{nombre:'Consumibles'}];
    const catIds=[];
    for(const c of cats){
      const slug=c.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60);
      const [exCat]=await conn.query('SELECT id FROM categorias_inventario WHERE slug=? LIMIT 1',[slug]);
      if(exCat.length){ catIds.push(exCat[0].id); } else {
        const [r]=await conn.query('INSERT INTO categorias_inventario (slug,nombre,activa,orden,creado_en,actualizado_en) VALUES (?,?,1,999,?,?)',[slug,c.nombre,new Date(),new Date()]);
        catIds.push(r.insertId);
      }
    }
    // Unidades y almacén
    const [[unidadPieza]]=await conn.query("SELECT id FROM unidades_medida WHERE nombre='Pieza' LIMIT 1");
    const unidadId=unidadPieza.id;
    const [[alm]]=await conn.query("SELECT id FROM almacenes WHERE codigo='ALM-1' LIMIT 1");
    const almacenId=alm.id;

    const productosSeed=[
      {sku:'PROD-LAP-001', nombre:'Laptop Lenovo 15"', categoria:catIds[0], costo:18500, precio:23500, stock:80},
      {sku:'PROD-TON-002', nombre:'Tóner HP Negro', categoria:catIds[2], costo:950, precio:1450, stock:200},
      {sku:'PROD-CAB-003', nombre:'Cable UTP Cat6 305m', categoria:catIds[0], costo:1200, precio:1850, stock:60},
      {sku:'PROD-SIL-004', nombre:'Silla ergonómica', categoria:catIds[1], costo:2100, precio:3200, stock:45},
      {sku:'PROD-MON-005', nombre:'Monitor 24" FHD', categoria:catIds[0], costo:2800, precio:3900, stock:70},
      {sku:'PROD-IMP-006', nombre:'Impresora multifuncional', categoria:catIds[0], costo:4200, precio:5900, stock:30},
      {sku:'PROD-PAP-007', nombre:'Papel A4 caja 10 rec', categoria:catIds[2], costo:850, precio:1150, stock:150},
      {sku:'PROD-EXT-008', nombre:'Disco SSD 1TB', categoria:catIds[0], costo:1650, precio:2400, stock:90},
    ];
    const prodIds=[];
    for(const p of productosSeed){
      const [exP]=await conn.query('SELECT id FROM productos WHERE sku=? LIMIT 1',[p.sku]);
      let pid;
      if(exP.length){ pid=exP[0].id; } else {
        const ahora=new Date();
        const [r]=await conn.query('INSERT INTO productos (sku,nombre,categoria_id,unidad_id,tipo,costo,costo_promedio,ultimo_costo,precio,stock_minimo,stock_maximo,punto_reorden,estado,proveedor_principal,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [p.sku,p.nombre,p.categoria,unidadId,'producto',p.costo,p.costo, p.costo, p.precio, 10, 300, 20, 'activo', 'Proveedor '+p.sku, ahora, ahora]);
        pid=r.insertId;
      }
      prodIds.push({id:pid, ...p});
    }
    // Insertar existencias iniciales + movimientos inventario_inicial si no hay movimientos
    for(const prod of prodIds){
      const [movs]=await conn.query('SELECT id FROM movimientos_inventario WHERE producto_id=? LIMIT 1',[prod.id]);
      if(movs.length===0){
        const ahora = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate(), 9,0,0));
        // asegurar existencias fila
        await conn.query('INSERT IGNORE INTO existencias (producto_id,almacen_id,disponible,actualizado_en) VALUES (?,?,0,?)',[prod.id, almacenId, ahora]);
        const [exF]=await conn.query('SELECT disponible FROM existencias WHERE producto_id=? AND almacen_id=?',[prod.id, almacenId]);
        const ant=Number(exF[0].disponible);
        const cant=prod.stock;
        const post=ant+cant;
        // actualizar costo_promedio (simple)
        await conn.query('UPDATE productos SET costo_promedio=?, ultimo_costo=?, actualizado_en=? WHERE id=?',[prod.costo, prod.costo, ahora, prod.id]);
        const [ins]=await conn.query('INSERT INTO movimientos_inventario (folio,producto_id,almacen_id,tipo,cantidad,costo_unitario,existencia_anterior,existencia_posterior,motivo,usuario,creado_en) VALUES (NULL,?,?,?,?,?,?,?,?,?,?)',
          [prod.id, almacenId, 'inventario_inicial', cant, prod.costo, ant, post, 'Stock inicial poblado Tony', 'admin', ahora]);
        const folio=`EN-${String(ins.insertId).padStart(6,'0')}`;
        await conn.query('UPDATE movimientos_inventario SET folio=? WHERE id=?',[folio, ins.insertId]);
        await conn.query('UPDATE existencias SET disponible=?, actualizado_en=? WHERE producto_id=? AND almacen_id=?',[post, ahora, prod.id, almacenId]);
      }
    }

    let cntVentas=0, cntTickets=0, cntGastos=0, idMinV=null, idMaxV=null, idMinT=null, idMaxT=null;
    const resumen=new Map();
    function acum(llave,campo,monto){ if(!resumen.has(llave)) resumen.set(llave,{ventas:0,tickets:0,gastos:0}); resumen.get(llave)[campo]+=monto; }

    for(let d=new Date(inicio); d<=fin; d.setUTCDate(d.getUTCDate()+1)){
      const a=d.getUTCFullYear(), m=d.getUTCMonth(), day=d.getUTCDate(), dow=d.getUTCDay();
      const llave=`${a}-${String(m+1).padStart(2,'0')}`;
      // Ventas por día: lun-vie 60% 1 venta, 20% 2 ventas, sab 25% 1, dom 0
      let ventasDia=0;
      if(dow>=1 && dow<=5){ if(prob(0.55)) ventasDia=1; if(prob(0.18)) ventasDia+=1; }
      else if(dow===6 && prob(0.28)) ventasDia=1;
      for(let v=0; v<ventasDia; v++){
        const cantidad=Math.round(montoVenta()*100)/100;
        const iva=16; const total=Math.round(cantidad*1.16*100)/100;
        const fechaCompra=fechaUtc(a,m,day, azarEntero(9,18), azarEntero(0,59));
        // Elegir si es pendiente por cobrar 30% de las ventas son pendiente
        const esPendiente=prob(0.30);
        let estadoPago='pagada', montoCobrado=total, fechaVenc=null, fechaCobro=null, notasCobro=null;
        if(esPendiente){
          estadoPago='pendiente';
          const diasVenc=azarEntero(15,30);
          const fv=new Date(fechaCompra); fv.setUTCDate(fv.getUTCDate()+diasVenc);
          fechaVenc=fv.toISOString().slice(0,10);
          // 40% con abono parcial 30-70%, 60% sin abono
          if(prob(0.40)){
            montoCobrado=Math.round(total*azarEntre(0.3,0.7)*100)/100;
            fechaCobro=fechaUtc(a,m,day+azarEntero(2,5),10,0);
            notasCobro='Abono parcial registrado';
          } else {
            montoCobrado=0;
            notasCobro=null;
          }
          // si venta muy vieja y sin abono, marcar vencida (fecha pasada)
          // ya está con fechaVenc en el pasado para abril-mayo
        } else {
          fechaCobro=fechaUtc(a,m,Math.min(day+azarEntero(1,3),28),10,0);
        }

        // decidir producto vinculado 60% de ventas llevan inventario
        let prodId=null, prodCant=null;
        let lineas=[];
        if(prob(0.60)){
          const prodEleg=elegir(prodIds);
          prodId=prodEleg.id;
          prodCant=azarEntero(1,6);
          lineas=[{producto_id:prodEleg.id, cantidad:prodCant}];
        }

        const [rv]=await conn.query(
          `INSERT INTO ordenes_compra (numero_compra,fecha_compra,concepto,cantidad,iva_porcentaje,total,email,estado_pago,fecha_vencimiento,monto_cobrado,fecha_cobro,notas_cobro,producto_id,producto_cantidad,eliminado_en,creado_en,actualizado_en)
           VALUES ('TEMP',?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
          [fechaCompra, elegir(CONCEPTOS), cantidad, iva, total, null, estadoPago, fechaVenc, montoCobrado, fechaCobro, notasCobro, prodId, prodCant, fechaCompra, fechaCompra]
        );
        const idV=rv.insertId;
        await conn.query('UPDATE ordenes_compra SET numero_compra=? WHERE id=?',[`OC-${String(idV).padStart(6,'0')}`, idV]);
        // orden_productos si hay líneas
        for(const lin of lineas){
          await conn.query('INSERT INTO orden_productos (orden_id,producto_id,cantidad,creado_en) VALUES (?,?,?,?)',[idV, lin.producto_id, lin.cantidad, fechaCompra]);
          // registrar movimiento salida venta (manual dentro de transacción)
          // asegurar existencias
          await conn.query('INSERT IGNORE INTO existencias (producto_id,almacen_id,disponible,actualizado_en) VALUES (?,?,0,?)',[lin.producto_id, almacenId, fechaCompra]);
          const [[exRow]]=await conn.query('SELECT disponible FROM existencias WHERE producto_id=? AND almacen_id=? FOR UPDATE',[lin.producto_id, almacenId]);
          const ant=Number(exRow.disponible);
          // permitir negativo para no bloquear siembra (neutro)
          const post=ant - lin.cantidad;
          const [insMov]=await conn.query('INSERT INTO movimientos_inventario (folio,producto_id,almacen_id,tipo,cantidad,costo_unitario,existencia_anterior,existencia_posterior,documento_origen,usuario,creado_en) VALUES (NULL,?,?,?,?,?,?,?,?,?,?)',
            [lin.producto_id, almacenId, 'venta', lin.cantidad, null, ant, post, `OC-${String(idV).padStart(6,'0')}`, 'admin', fechaCompra]);
          const folioMov=`SA-${String(insMov.insertId).padStart(6,'0')}`;
          await conn.query('UPDATE movimientos_inventario SET folio=? WHERE id=?',[folioMov, insMov.insertId]);
          await conn.query('UPDATE existencias SET disponible=?, actualizado_en=? WHERE producto_id=? AND almacen_id=?',[post, fechaCompra, lin.producto_id, almacenId]);
        }

        cntVentas++; idMinV=idMinV===null?idV:idMinV; idMaxV=idV; acum(llave,'ventas',total);

        // Ticket 70% facturado
        const esFacturado=prob(0.70);
        if(esFacturado){
          const fechaTick=fechaUtc(a,m,day, Math.min(fechaCompra.getUTCHours()+2,20), azarEntero(0,59));
          const tipoPago=elegir(['efectivo','transferencia','tarjeta_debito','tarjeta_credito']);
          const [rt]=await conn.query(
            `INSERT INTO tickets (folio,rfc,uso_cfdi,tipo_pago,comentarios,orden_compra_id,imagen_nombre_original,imagen_nombre_guardado,imagen_mime,imagen_tamano_bytes,estatus,factura_nombre_original,factura_nombre_guardado,factura_mime,notas_admin,actualizado_por,eliminado_en,creado_en,actualizado_en)
             VALUES ('TEMP',?,NULL,?,NULL,?,'ticket.jpg',?,'image/jpeg',102400,'listo',NULL,NULL,NULL,'Poblado Tony','admin',NULL,?,?)`,
            [RFC_PRUEBA, tipoPago, idV, `poblado-${idV}.jpg`, fechaTick, fechaTick]
          );
          const idT=rt.insertId;
          await conn.query('UPDATE tickets SET folio=? WHERE id=?',[`TK-${String(idT).padStart(6,'0')}`, idT]);
          cntTickets++; idMinT=idMinT===null?idT:idMinT; idMaxT=idT; acum(llave,'tickets',1);
        } else {
          // 30% sin facturar: crear ticket pendiente/en_curso sin factura
          // solo para ~60% de los no facturados se crea ticket pendiente visible
          if(prob(0.60)){
            const fechaTick=fechaUtc(a,m,day, Math.min(fechaCompra.getUTCHours()+1,20), azarEntero(0,59));
            const est=elegir(['pendiente','en_curso']);
            const tipoPago=elegir(['efectivo','transferencia','tarjeta_debito','tarjeta_credito','otro']);
            const [rt]=await conn.query(
              `INSERT INTO tickets (folio,rfc,uso_cfdi,tipo_pago,tipo_pago_otro,comentarios,orden_compra_id,imagen_nombre_original,imagen_nombre_guardado,imagen_mime,imagen_tamano_bytes,estatus,eliminado_en,creado_en,actualizado_en)
               VALUES ('TEMP',?,NULL,?,?,?,?,'ticket-pend.jpg',?,'image/jpeg',102400,?,NULL,?,?)`,
              [RFC_PRUEBA, tipoPago, tipoPago==='otro'?'Efectivo parcial':null, 'Pendiente de facturar', idV, `pend-${idV}.jpg`, est, fechaTick, fechaTick]
            );
            const idT=rt.insertId;
            await conn.query('UPDATE tickets SET folio=? WHERE id=?',[`TK-${String(idT).padStart(6,'0')}`, idT]);
            // no cuenta como facturado, pero sí como ticket existente
          }
        }
      }

      // Gastos fijos
      for(const gf of GASTOS_FIJOS){
        const diaG=gf.dia();
        if(day!==diaG) continue;
        const fechaG=fechaUtc(a,m,day, azarEntero(9,17), azarEntero(0,59));
        const monto=Math.round(azarEntre(gf.min,gf.max)*100)/100;
        await conn.query(`INSERT INTO gastos (fecha,concepto,proveedor,categoria,monto,iva_incluido,tiene_factura,recurrente,notas,creado_por,eliminado_en,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
          [fechaG.toISOString().slice(0,10), gf.concepto, gf.proveedor, gf.categoria, monto, prob(0.5)?1:0, prob(0.7)?1:0, gf.recurrente?1:0, NOTA_PRUEBA, 'admin', fechaG, fechaG]);
        cntGastos++; acum(llave,'gastos',1);
      }
      if(day===7){
        for(const gv of GASTOS_VARIABLES){
          const veces=azarEntero(gv.veces[0], gv.veces[1]);
          for(let i=0;i<veces;i++){
            const fechaG=fechaUtc(a,m,azarEntero(1,28), azarEntero(9,18), azarEntero(0,59));
            const monto=Math.round(azarEntre(gv.min,gv.max)*100)/100;
            await conn.query(`INSERT INTO gastos (fecha,concepto,proveedor,categoria,monto,iva_incluido,tiene_factura,recurrente,notas,creado_por,eliminado_en,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
              [fechaG.toISOString().slice(0,10), gv.concepto, elegir(gv.proveedores), gv.categoria, monto, prob(0.5)?1:0, prob(0.65)?1:0, gv.rec?1:0, NOTA_PRUEBA, 'admin', fechaG, fechaG]);
            cntGastos++;
            acum(`${a}-${String(m+1).padStart(2,'0')}`,'gastos',1);
          }
        }
      }
    }

    await conn.commit();
    console.log('Poblado completado Tony');
    console.log(` Ventas: ${cntVentas} ids ${idMinV}..${idMaxV}`);
    console.log(` Tickets listo (facturado 70%): ${cntTickets} ids ${idMinT}..${idMaxT}`);
    console.log(` Gastos: ${cntGastos}`);
    for(const k of [...resumen.keys()].sort()){ const r=resumen.get(k); console.log(`  ${k} | ventas ${r.ventas.toFixed(2)} | tickets ${r.tickets} | gastos ${r.gastos}`); }
    console.log(`Inventario: ${prodIds.length} productos, stock inicial + movimientos venta`);
    console.log(`CxC: 30% ventas en estado pendiente, con fecha_vencimiento y abonos parciales`);
  } catch(e){ await conn.rollback(); console.error('Rollback',e); throw e; } finally{ conn.release(); }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
