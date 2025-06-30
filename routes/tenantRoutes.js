import express from "express";
import * as tenantController from "../controllers/tenantController.js";

const router = express.Router({ mergeParams: true });

router.get("/", tenantController.getAllTenants);

router.get("/add", tenantController.showAddTenantForm);

router.post("/", tenantController.addTenant);

router.get("/edit/:id", tenantController.showEditTenantForm);

router.post("/edit/:id", tenantController.updateTenant);

export default router;
