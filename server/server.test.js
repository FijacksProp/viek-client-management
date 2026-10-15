import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const serverFile = fileURLToPath(new URL("./server.js", import.meta.url));

let serverProcess;
let baseUrl;
let token;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error(`Test server did not start. ${errorOutput}`)
      );
      child.kill();
    }, 10000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Server running on http:\/\/localhost:(\d+)/);

      if (match) {
        finish(resolve, `http://127.0.0.1:${match[1]}`);
      }
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });

    child.once("error", (error) => finish(reject, error));

    child.once("exit", (code) => {
      finish(
        reject,
        new Error(`Test server exited before starting (${code}). ${errorOutput}`)
      );
    });
  });
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Some error responses may not contain JSON.
  }

  return { response, data };
}

function jsonBody(value) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  };
}

describe("Client management API", { concurrency: 1 }, () => {
  before(async () => {
    serverProcess = spawn(process.execPath, [serverFile], {
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    baseUrl = await waitForServer(serverProcess);
  });

  after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      const exited = new Promise((resolve) => {
        serverProcess.once("exit", resolve);
      });
      serverProcess.kill();
      await exited;
    }
  });

  it("logs in without returning the stored password", async () => {
    const { response, data } = await request(
      "/api/login",
      {
        method: "POST",
        ...jsonBody({ email: "admin@viek.test", password: "password123" })
      }
    );

    assert.equal(response.status, 200);
    assert.equal(data.token, "demo-token");
    assert.deepEqual(Object.keys(data.user).sort(), ["email", "id", "name"]);
    token = data.token;
  });

  it("rejects invalid login credentials", async () => {
    const { response, data } = await request(
      "/api/login",
      {
        method: "POST",
        ...jsonBody({ email: "admin@viek.test", password: "wrong-password" })
      }
    );

    assert.equal(response.status, 401);
    assert.equal(data.message, "Invalid email or password");
  });

  it("rejects requests without a valid token", async () => {
    const missingToken = await request("/api/clients");
    const invalidToken = await request("/api/projects", {
      token: "invalid-token"
    });

    assert.equal(missingToken.response.status, 401);
    assert.equal(invalidToken.response.status, 401);
  });

  it("returns 400 for invalid client input", async () => {
    const cases = [
      { name: "   ", email: "person@example.test" },
      { name: "Example Client", email: "   " },
      { name: "Example Client", email: "not-an-email" },
      { name: 42, email: "person@example.test" },
      { name: "Example Client", email: null },
      ["Example Client", "person@example.test"]
    ];

    for (const body of cases) {
      const { response } = await request(
        "/api/clients",
        {
          method: "POST",
          token,
          ...jsonBody(body)
        }
      );

      assert.equal(response.status, 400);
    }
  });

  it("returns 400 for malformed JSON", async () => {
    const { response, data } = await request(
      "/api/clients",
      {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: "{"
      }
    );

    assert.equal(response.status, 400);
    assert.equal(data.message, "Request body must be valid JSON");
  });

  it("trims and creates a valid client", async () => {
    const { response, data } = await request(
      "/api/clients",
      {
        method: "POST",
        token,
        ...jsonBody({
          name: "  Test Client  ",
          email: "  test.client@example.test  "
        })
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(data.data, {
      id: 3,
      name: "Test Client",
      email: "test.client@example.test"
    });
  });

  it("filters projects by client", async () => {
    const all = await request("/api/projects", { token });
    const acme = await request("/api/projects?clientId=1", { token });
    const bright = await request("/api/projects?clientId=2", { token });

    assert.equal(all.response.status, 200);
    assert.equal(all.data.projects.length, 3);
    assert.equal(acme.data.projects.length, 2);
    assert.equal(bright.data.projects.length, 1);
  });

  it("deletes clients and assigns unique IDs after deletion", async () => {
    const second = await request(
      "/api/clients",
      {
        method: "POST",
        token,
        ...jsonBody({ name: "Second Test Client", email: "second@example.test" })
      }
    );
    assert.equal(second.data.data.id, 4);

    const deleted = await request("/api/clients/3", {
      method: "DELETE",
      token
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.data.message, "Client deleted successfully");

    const third = await request(
      "/api/clients",
      {
        method: "POST",
        token,
        ...jsonBody({ name: "Third Test Client", email: "third@example.test" })
      }
    );
    assert.equal(third.data.data.id, 5);

    const clients = await request("/api/clients", { token });
    const ids = clients.data.data.map((client) => client.id);
    assert.deepEqual(ids, [1, 2, 4, 5]);
    assert.equal(new Set(ids).size, ids.length);

    const deletedAgain = await request("/api/clients/5", {
      method: "DELETE",
      token
    });
    assert.equal(deletedAgain.response.status, 200);

    const missing = await request("/api/clients/5", {
      method: "DELETE",
      token
    });
    assert.equal(missing.response.status, 404);
  });

  it("leaves a client's projects when that client is deleted", async () => {
    const deleted = await request("/api/clients/1", {
      method: "DELETE",
      token
    });
    const remainingClients = await request("/api/clients", { token });
    const remainingProjects = await request("/api/projects?clientId=1", { token });

    assert.equal(deleted.response.status, 200);
    assert.equal(remainingClients.data.data.some((client) => client.id === 1), false);
    assert.equal(remainingProjects.data.projects.length, 2);
  });
});
