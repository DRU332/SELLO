// SOLO DESARROLLO LOCAL: genera las llaves anon y service_role firmadas con JWT_SECRET.
import crypto from "node:crypto";

const secret = process.argv[2];
const role = process.argv[3];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ iss: "supabase-local", role, iat: 1700000000, exp: 2000000000 });
const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
process.stdout.write(`${header}.${payload}.${sig}`);
