export type TErrorSource = {
  path: string | number;
  message: string;
}[];

export type TgenereicErrorResponse = {
  statusCode: number;
  message: string;
  errorSources: TErrorSource;
};