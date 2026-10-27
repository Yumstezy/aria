// Step 1.5 spike: can a Max for Live device talk to the Aria engine over HTTP?
// Runs in [node.script bridge_spike.js @autostart 1]. Send it the message "health".
const http = require("http");
const Max = require("max-api");

const ENGINE = { host: "127.0.0.1", port: 8765 };

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ ...ENGINE, path, timeout: 3000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("timeout", () => req.destroy(new Error("timed out after 3 s")));
    req.on("error", reject);
  });
}

Max.addHandler("health", async () => {
  const started = Date.now();
  try {
    const res = await get("/health");
    const ms = Date.now() - started;
    Max.post(`1.5 PASS: engine answered HTTP ${res.status} in ${ms} ms: ${res.body}`);
    await Max.outlet("health", res.status, ms);
  } catch (err) {
    Max.post(`1.5 FAIL: ${err.message}. Is the engine running? Start it with engine/run.sh`, Max.POST_LEVELS.ERROR);
    await Max.outlet("health", "fail", err.message);
  }
});

Max.post("bridge_spike.js loaded. Click the [health] message to test.");
