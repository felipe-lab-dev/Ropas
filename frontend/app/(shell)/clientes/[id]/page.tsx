import EditarClientePage from './cliente-editar-cliente';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <EditarClientePage />;
}
