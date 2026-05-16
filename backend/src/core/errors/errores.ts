export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export class ErrorAplicacion extends Error {
  constructor(
    public readonly codigo: number,
    mensaje: string,
    public readonly errores?: ErrorCampo[],
  ) {
    super(mensaje);
    this.name = this.constructor.name;
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(mensaje = 'Recurso no encontrado') {
    super(404, mensaje);
  }
}

export class ErrorValidacion extends ErrorAplicacion {
  constructor(mensaje = 'Error de validación', errores?: ErrorCampo[]) {
    super(400, mensaje, errores);
  }
}

export class ErrorNoAutorizado extends ErrorAplicacion {
  constructor(mensaje = 'No autenticado') {
    super(401, mensaje);
  }
}

export class ErrorProhibido extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permiso para esta acción') {
    super(403, mensaje);
  }
}

export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje = 'Conflicto con el estado actual') {
    super(409, mensaje);
  }
}

export class ErrorPagoRequerido extends ErrorAplicacion {
  constructor(mensaje = 'Suscripción inactiva o trial vencido') {
    super(402, mensaje);
  }
}
