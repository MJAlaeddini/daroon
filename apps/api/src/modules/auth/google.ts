import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
}
export interface GoogleVerifier {
  verify(credential: string): Promise<GoogleProfile>;
}

/** Verifies a Google Identity Services ID token for our client id. */
export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return {
    async verify(credential) {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      const p = ticket.getPayload();
      if (!p?.sub) throw new Error('no subject');
      return {
        sub: p.sub,
        email: p.email ?? null,
        emailVerified: !!p.email_verified,
        name: p.given_name || p.name || '',
      };
    },
  };
}
