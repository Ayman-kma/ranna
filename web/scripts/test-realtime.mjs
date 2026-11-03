// End-to-end realtime check: a customer socket must receive the "called"
// status broadcast when staff trigger the call. Run from web/ so
// socket.io-client resolves: `node scripts/test-realtime.mjs`.
import { io } from "socket.io-client";

const API = process.env.API_BASE || "http://localhost:4000";

const login = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "staff@ranna.app", password: "ranna12345" }),
}).then((r) => r.json());

const token = login.token;
if (!token) throw new Error("login failed");

const order = await fetch(`${API}/api/orders`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ customerLabel: "Realtime test" }),
}).then((r) => r.json());

console.log("created order", order.number, order.token);

const socket = io(API, {
  auth: { role: "customer", orderToken: order.token },
  transports: ["websocket", "polling"],
});

let done = false;
const timeout = setTimeout(() => {
  if (!done) {
    console.log("REALTIME_FAIL: timed out waiting for order:status");
    process.exit(1);
  }
}, 8000);

socket.on("connect", async () => {
  console.log("customer socket connected:", socket.id);
  const res = await fetch(`${API}/api/orders/${order.id}/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  console.log("call endpoint status:", res.status);
});

socket.on("order:status", (o) => {
  console.log("order:status ->", o.status, "#" + o.number);
  if (o.status === "called" && !done) {
    done = true;
    clearTimeout(timeout);
    socket.disconnect();
    console.log("REALTIME_OK");
    process.exit(0);
  }
});

socket.on("connect_error", (err) => {
  console.log("connect_error", err.message);
});
