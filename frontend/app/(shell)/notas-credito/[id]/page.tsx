import { NotaCreditoDetalleCliente } from './nota-credito-detalle-cliente';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <NotaCreditoDetalleCliente />;
}
