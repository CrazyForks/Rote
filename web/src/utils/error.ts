const MAX_ERROR_MESSAGE_LENGTH = 500;

function normalizeErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const message = value.trim();
  if (!message) {
    return undefined;
  }

  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  const response = 'response' in error ? error.response : undefined;
  if (!response || typeof response !== 'object' || !('status' in response)) {
    return undefined;
  }

  return typeof response.status === 'number' ? response.status : undefined;
}

export function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return normalizeErrorMessage(error);
  }

  const response = 'response' in error ? error.response : undefined;
  const responseData =
    response && typeof response === 'object' && 'data' in response ? response.data : undefined;
  const responseMessage =
    responseData && typeof responseData === 'object' && 'message' in responseData
      ? responseData.message
      : responseData;

  const routeData = 'data' in error ? error.data : undefined;
  const routeMessage =
    routeData && typeof routeData === 'object' && 'message' in routeData
      ? routeData.message
      : routeData;

  const message =
    normalizeErrorMessage(responseMessage) ??
    normalizeErrorMessage(routeMessage) ??
    ('message' in error ? normalizeErrorMessage(error.message) : undefined) ??
    ('statusText' in error ? normalizeErrorMessage(error.statusText) : undefined);

  const code = 'code' in error ? normalizeErrorMessage(error.code) : undefined;
  if (message && code && !message.includes(code)) {
    return `${message} (${code})`;
  }

  return message ?? code;
}

export function isNotFoundError(error: unknown): boolean {
  return getHttpStatus(error) === 404;
}
