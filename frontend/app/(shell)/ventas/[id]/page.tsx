import { VentaDetalleCliente } from './venta-detalle-cliente';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <VentaDetalleCliente />;
}
