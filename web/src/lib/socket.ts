import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

export function connectStaff(token: string): Socket {
  return io(API_BASE, {
    auth: { role: "staff", token },
    transports: ["websocket", "polling"],
  });
}

export function connectCustomer(orderToken: string): Socket {
  return io(API_BASE, {
    auth: { role: "customer", orderToken },
    transports: ["websocket", "polling"],
  });
}
