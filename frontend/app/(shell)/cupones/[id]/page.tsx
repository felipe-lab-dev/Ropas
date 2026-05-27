import { CuponDetalleCliente } from './cupon-detalle-cliente';

// SPA detrás de output:'export'. generateStaticParams sólo pre-genera el placeholder `_`;
// los IDs reales se resuelven en cliente vía useParams() + SWA navigationFallback.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <CuponDetalleCliente />;
}
