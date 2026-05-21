import { KardexCliente } from './kardex-cliente';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <KardexCliente />;
}
