// routes/tenantRoutes.js
import express from "express";
import * as utilController from "../controllers/utilController.js";

const router = express.Router({ mergeParams: true });

router.get("/:unitId", utilController.getAllUtils);

router.get("/add/:unitId", utilController.showAddForm);

router.post("/:unitId", utilController.addUtilityBill);

router.get("/:utilId/pdf", utilController.generateUtilityPdf);

router.get("/edit/:id", utilController.showEditUtilityForm);

router.post("/edit/:id", utilController.updateUtilityBill);

export default router;
