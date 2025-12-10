class AppError {
  public readonly error: string;

  public readonly statusCode: number;

  constructor(error: string, statusCode = 400) {
    this.error = error;
    this.statusCode = statusCode;
  }
}

export default AppError;
