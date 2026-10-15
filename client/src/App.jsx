import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [email, setEmail] = useState(
    "admin@viek.test"
  );

  const [password, setPassword] = useState(
    "password123"
  );

  const [clients, setClients] = useState([]);

  const [projects, setProjects] = useState([]);

  const [selectedClient, setSelectedClient] =
    useState("");

  const [clientName, setClientName] =
    useState("");

  const [clientEmail, setClientEmail] =
    useState("");

  const [message, setMessage] = useState("");

  function clearSession() {
    localStorage.removeItem("token");
    setToken(null);
    setClients([]);
    setProjects([]);
    setSelectedClient("");
    setMessage("Your session is no longer valid. Please log in again.");
  }

  function handleRequestError(error, requiresAuth = false) {
    if (requiresAuth && error.status === 401) {
      clearSession();
      return;
    }

    setMessage(error.message || "Something went wrong. Please try again.");
  }

  async function requestApi(url, options = {}) {
    let response;

    try {
      response = await fetch(url, options);
    } catch {
      throw new Error(
        "Could not connect to the server. Check that the backend is running and try again."
      );
    }

    let result = {};

    try {
      result = await response.json();
    } catch {
      // Keep a useful status-based message if the server didn't return JSON.
    }

    if (!response.ok) {
      const error = new Error(
        result.message || `The request failed (HTTP ${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    return result;
  }

  async function login(event) {
    event.preventDefault();
    setMessage("");

    try {
      const result = await requestApi(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (typeof result.token !== "string" || !result.token) {
        throw new Error("The server did not return a login token.");
      }

      localStorage.setItem("token", result.token);
      setToken(result.token);
    } catch (error) {
      handleRequestError(error);
    }
  }

  async function loadClients() {
    try {
      const result = await requestApi(`${API_URL}/clients`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!Array.isArray(result.data)) {
        throw new Error("The server returned an invalid client list.");
      }

      setClients(result.data);
    } catch (error) {
      handleRequestError(error, true);
    }
  }

  async function loadProjects() {
    const url = selectedClient
      ? `${API_URL}/projects?clientId=${selectedClient}`
      : `${API_URL}/projects`;

    try {
      const result = await requestApi(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!Array.isArray(result.projects)) {
        throw new Error("The server returned an invalid project list.");
      }

      setProjects(result.projects);
    } catch (error) {
      handleRequestError(error, true);
    }
  }

  async function addClient(event) {
    event.preventDefault();

    try {
      await requestApi(`${API_URL}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: clientName,
          email: clientEmail
        })
      });

      setMessage("Client added successfully");
      setClientName("");
      setClientEmail("");
      await loadClients();
    } catch (error) {
      handleRequestError(error, true);
    }
  }

  async function deleteClient(id) {
    try {
      const result = await requestApi(`${API_URL}/clients/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setMessage(result.message || "Client deleted successfully");
      await loadClients();
    } catch (error) {
      handleRequestError(error, true);
    }
  }

  useEffect(() => {
    if (token) {
      loadClients();
      loadProjects();
    }
  }, [token, selectedClient]);

  if (!token) {
    return (
      <div className="container">
        <div className="card">
          <h1>VIEK Client Management</h1>

          <h2>Login</h2>

          <form onSubmit={login}>
            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email"
            />

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password"
            />

            <button type="submit">
              Login
            </button>
          </form>

          {message && (
            <p className="message">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>VIEK Client Management</h1>

      <div className="card">
        <h2>Add Client</h2>

        <form onSubmit={addClient}>
          <input
            value={clientName}
            onChange={(e) =>
              setClientName(e.target.value)
            }
            placeholder="Client name"
          />

          <input
            type="email"
            value={clientEmail}
            onChange={(e) =>
              setClientEmail(e.target.value)
            }
            placeholder="Client email"
          />

          <button type="submit">
            Add Client
          </button>
        </form>

        {message && (
          <p className="message">
            {message}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Clients</h2>

        {clients.length === 0 ? (
          <p>No clients found.</p>
        ) : (
          <ul>
            {clients.map((client) => (
              <li key={client.id}>
                <strong>{client.name}</strong>
                <span>{client.email}</span>

                <button
                  onClick={() =>
                    deleteClient(client.id)
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Projects</h2>

        <select
          value={selectedClient}
          onChange={(e) =>
            setSelectedClient(e.target.value)
          }
        >
          <option value="">
            All Clients
          </option>

          {clients.map((client) => (
            <option
              key={client.id}
              value={client.id}
            >
              {client.name}
            </option>
          ))}
        </select>

        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <strong>{project.name}</strong>

              <span>
                Client ID: {project.clientId}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
