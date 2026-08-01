import { createDecipheriv } from "node:crypto";

/**
 * AES-256-GCM key for the cloud-delivered provider credential. Must match
 * BEIDE_PROVIDER_KEY_HEX in scripts/supabase-secrets.mjs.
 *
 * Being honest about the threat model: this is defence in depth, not a vault.
 * Supabase RLS keeps the ciphertext away from unauthenticated clients, and
 * this key keeps the plaintext out of the database and off the wire — but a
 * determined user of the packaged app can extract it. That is inherent to any
 * client that calls the provider directly; full secrecy needs a server proxy.
 */
const APP_KEY_HEX =
  "5c662bc7e788be2d91984423254a834fa2d74f6e1edfee8e6146457721817c84";

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Decrypt base64(iv || ciphertext || tag). Throws on tampered/garbage input. */
export function decryptProviderKey(ciphertextB64: string): string {
  const blob = Buffer.from(ciphertextB64, "base64");
  if (blob.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Provider key ciphertext too short");
  }
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const data = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(APP_KEY_HEX, "hex"),
    iv,
  );
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  if (!plain.trim()) throw new Error("Provider key decrypted to empty string");
  return plain.trim();
}
