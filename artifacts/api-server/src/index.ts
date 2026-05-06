import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
import app from "./app";

const port = Number(process.env["API_PORT"] || process.env["PORT"] || 3001);
const host = "0.0.0.0";

app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database connected? ${!!process.env.DATABASE_URL}`);
});
