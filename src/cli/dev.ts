import { installGracefulShutdown, startApp } from "../app.js";

const configPath = process.argv[2] ?? "config.example.yaml";
const runtime = await startApp(configPath);

installGracefulShutdown(runtime);
