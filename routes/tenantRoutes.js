// routes/tenantRoutes.js
import express from "express";
import * as tenantController from "../controllers/tenantController.js";

const router = express.Router({ mergeParams: true });

router.get("/", tenantController.getAllTenantsForUnit);

router.get("/add", tenantController.showAddTenantForm);

router.post("/", tenantController.addTenant);

export default router;
