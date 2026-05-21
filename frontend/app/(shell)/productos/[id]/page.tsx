import { EditarProductoCliente } from './editar-cliente';

// Placeholder para output:export — SPA resuelve el id real desde useParams en runtime.
// SWA's navigationFallback (staticwebapp.config.json) sirve /index.html para cualquier id.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <EditarProductoCliente />;
}
