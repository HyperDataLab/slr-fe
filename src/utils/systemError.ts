import { isAxiosError } from "axios";

export const SYSTEM_ERROR_EVENT = "slrs:system-error";

export const isSystemAvailabilityError = (error: unknown) => {
  if (!isAxiosError(error)) return false;
  if (error.response) return error.response.status >= 500;

  return (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ERR_NETWORK"
  );
};

export const notifySystemError = () => {
  window.dispatchEvent(new Event(SYSTEM_ERROR_EVENT));
};
