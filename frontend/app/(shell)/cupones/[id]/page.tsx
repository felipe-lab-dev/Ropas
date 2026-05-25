import { CuponDetalleCliente } from './cupon-detalle-cliente';

// SPA detrás de output:'export' — los IDs reales se resuelven en cliente.
// `dynamicParams:true` permite IDs no listados en generateStaticParams.
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <CuponDetalleCliente />;
}
