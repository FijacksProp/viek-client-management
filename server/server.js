import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT === undefined ? 4000 : Number(process.env.PORT);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

app.use(cors());
app.use(express.json());

const users = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test",
    password: "password123"
  }
];

let clients = [
  {
    id: 1,
    name: "Acme Limited",
    email: "contact@acme.test"
  },
  {
    id: 2,
    name: "Bright Solutions",
    email: "hello@bright.test"
  }
];

let nextClientId =
  Math.max(0, ...clients.map((client) => client.id)) + 1;

const projects = [
  {
    id: 1,
    name: "Website Development",
    clientId: 1
  },
  {
    id: 2,
    name: "Mobile Application",
    clientId: 2
  },
  {
    id: 3,
    name: "UI/UX Design",
    clientId: 1
  }
];

// Login
app.post("/api/login", (req, res) => {
  if (!isJsonObject(req.body)) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      message: "Email and password must be strings"
    });
  }

  const user = users.find(
    (item) =>
      item.email === email.trim() &&
      item.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password"
    });
  }

  res.json({
    token: "demo-token",
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader !== "Bearer demo-token") {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  next();
}

// Get clients
app.get("/api/clients", authenticate, (req, res) => {
  res.json({
    data: clients
  });
});

// Add client
app.post("/api/clients", authenticate, (req, res) => {
  if (!isJsonObject(req.body)) {
    return res.status(400).json({
      message: "Request body must be a JSON object"
    });
  }

  const { name, email } = req.body;

  if (typeof name !== "string" || typeof email !== "string") {
    return res.status(400).json({
      message: "Name and email must be strings"
    });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim();

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({
      message: "Name and email are required"
    });
  }

  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({
      message: "Enter a valid email address"
    });
  }

  const newClient = {
    id: nextClientId++,
    name: cleanName,
    email: cleanEmail
  };

  clients.push(newClient);

  res.status(201).json({
    data: newClient
  });
});

// Delete client
app.delete("/api/clients/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);

  const originalLength = clients.length;

  clients = clients.filter(
    (client) => client.id !== id
  );

  if (clients.length === originalLength) {
    return res.status(404).json({
      message: "Client not found"
    });
  }

  res.json({
    message: "Client deleted successfully"
  });
});

// Get projects
app.get("/api/projects", authenticate, (req, res) => {
  const { clientId } = req.query;

  let result = projects;

  if (clientId) {
    result = projects.filter(
      (project) => project.clientId === Number(clientId)
    );
  }

  res.json({
    projects: result
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Request body must be valid JSON"
    });
  }

  res.status(500).json({
    message: "Internal server error"
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${server.address().port}`);
});
