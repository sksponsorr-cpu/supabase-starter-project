const enc = new TextEncoder();
const env = (n: string) => (process.env[n] ?? "").trim();

const toHex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

async function sha256Hex(d: string | Uint8Array) {
  const bytes = typeof d === "string" ? enc.encode(d) : d;
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey(
    "raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

export function isR2Configured() {
  return ["BUCKET", "ENDPOINT", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "PUBLIC_URL"].every(
    (n) => env(`CLOUDFLARE_R2_${n}`),
  );
}

export async function uploadToR2(key: string, bytes: Uint8Array, contentType: string) {
  const bucket = env("CLOUDFLARE_R2_BUCKET");
  const origin = new URL(env("CLOUDFLARE_R2_ENDPOINT")).origin;
  const host = new URL(origin).host;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const uri = `/${bucket}/${encodedKey}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(bytes);
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonical =
    `PUT\n${uri}\n\ncontent-type:${contentType}\nhost:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonical)}`;

  let k = await hmac(enc.encode("AWS4" + env("CLOUDFLARE_R2_SECRET_ACCESS_KEY")), dateStamp);
  k = await hmac(k, "auto");
  k = await hmac(k, "s3");
  k = await hmac(k, "aws4_request");
  const signature = toHex(await hmac(k, toSign));

  const res = await fetch(`${origin}${uri}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${env("CLOUDFLARE_R2_ACCESS_KEY_ID")}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`Envoi R2 impossible (${res.status})`);

  return `${env("CLOUDFLARE_R2_PUBLIC_URL").replace(/\/+$/, "")}/${encodedKey}`;
                     }
