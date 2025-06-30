import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import bldgRoutes from "./routes/bldgRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import utilRoutes from "./routes/utilRoutes.js";
import assocRoutes from "./routes/assocRoutes.js";

dotenv.config();

const app = express();
const __dirname = import.meta.dirname;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist"))
);

app.get("/", (req, res) => {
  res.render("index");
});

app.use("/bldgs", bldgRoutes);
app.use("/units", unitRoutes);
app.use("/settings", settingRoutes);
app.use("/tenants", tenantRoutes);
app.use("/utilityBills", utilRoutes);
app.use("/assocBills", assocRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
