declare module 'kerberos' {
	export const GSS_MECH_OID_SPNEGO: string;

	export interface KerberosClient {
		step(token: string): Promise<string | null>;
	}

	export function initializeClient(
		service: string,
		options?: { mechOID?: string }
	): Promise<KerberosClient>;
}
