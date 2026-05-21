import { SesionDetalleCliente } from './historial-cliente';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <SesionDetalleCliente />;
}
