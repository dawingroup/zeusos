/**
 * Call a Firebase onCall (Gen 2) Cloud Function from a server context.
 * Uses Google OIDC identity tokens which satisfy Cloud Run invoker requirements.
 * In GCP (Cloud Functions), credentials are automatic. Locally, set
 * GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with cloudfunctions.invoker role.
 */
export declare function callCloudFunction<I, O>(name: string, data: I): Promise<O>;
//# sourceMappingURL=callFunction.d.ts.map