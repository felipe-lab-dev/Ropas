# Estimación de costos — Azure (East US 2)

Para 1-3 usuarios concurrentes, el setup mínimo razonable:

| Recurso | SKU | Costo USD/mes (aprox) |
|---------|-----|------------------------|
| PostgreSQL Flexible Server | Burstable **B1ms** (1 vCPU, 2 GB RAM) | ~$12 |
| Storage | 32 GB SSD P10 | ~$3.50 |
| Backup | 7 días, geo-redundancy off | incluido |
| **Total estimado** | | **~$15 USD/mes** |

> Region: **eastus2**. `eastus` está restringido para PostgreSQL Flexible en esta subscription. East US 2 es la alternativa primaria en Estados Unidos.

## Notas

- **Sin HA**: si la VM se reinicia hay downtime de ~3-5 min. Aceptable para tienda interna.
- **Public access ON al inicio**: para simplificar dev. Migrar a Private Endpoint cuando crezca a más clientes SaaS.
- **Sin réplica**: réplicas cuestan ~$12/mes adicionales. No las activamos hasta tener +50 tenants.
- **Connection pooling**: usar Prisma con `pgbouncer=true` cuando tengamos +10 tenants concurrentes.

## Cuando crezca

Para +20 tenants activos: subir a `Standard_B2s` (~$45/mes) y activar HA zonal (~$45/mes adicional).

Para +100 tenants: separar PostgreSQL del compute (App Service Premium V3) y usar Azure Database con Burstable B2s_v2.
