import { removeServeRoot } from "./static-server.js";

export default function globalTeardown() {
  removeServeRoot();
}
